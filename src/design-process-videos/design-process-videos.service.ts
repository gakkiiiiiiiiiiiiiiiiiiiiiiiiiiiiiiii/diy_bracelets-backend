import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { spawn } from 'child_process';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { In, Repository } from 'typeorm';
import WebSocket from 'ws';
import { ImageAssetsService } from '../ai/image-assets.service';
import { Material } from '../materials/entities/material.entity';
import { MaterialsService } from '../materials/materials.service';
import { CreateDesignProcessVideoDto } from './dto/design-process-video.dto';
import { DesignProcessVideo } from './entities/design-process-video.entity';

const WIDTH = 720;
const HEIGHT = 1280;
const CAPTURE_FPS = 24;
const OUTPUT_FPS = 30;
const INTRO_FRAMES = 12;
const OUTRO_FRAMES = 18;
const WEB_RENDER_STARTUP_TIMEOUT_MS = 60_000;
const WEB_RENDER_MIN_CAPTURE_TIMEOUT_MS = 5 * 60_000;
const WEB_RENDER_CAPTURE_TIMEOUT_PER_FRAME_MS = 1_000;
const WEB_RENDER_CAPTURE_GRACE_MS = 90_000;
const ACTIVE_STATUSES: DesignProcessVideo['status'][] = ['queued', 'rendering', 'encoding'];
const MAX_ACTIVE_VIDEO_JOBS = 10;

@Injectable()
export class DesignProcessVideosService implements OnModuleInit {
  private readonly logger = new Logger(DesignProcessVideosService.name);
  private readonly outputDir: string;
  private readonly ffmpegPath: string;
  private readonly chromePath: string;
  private readonly webRenderUrl: string;
  private readonly enabled: boolean;
  private queue: Promise<void> = Promise.resolve();
  private admissionQueue: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(DesignProcessVideo) private readonly jobs: Repository<DesignProcessVideo>,
    private readonly images: ImageAssetsService,
    private readonly materials: MaterialsService,
    config: ConfigService,
  ) {
    this.outputDir = resolve(this.images.uploadDir, 'design-process-videos');
    this.ffmpegPath = config.get<string>('FFMPEG_PATH', 'ffmpeg');
    this.chromePath = config.get<string>('CHROME_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    this.webRenderUrl = config.get<string>('VIDEO_WEB_RENDER_URL', '');
    this.enabled = config.get<boolean>('DESIGN_PROCESS_VIDEO_ENABLED', false);
    if (!existsSync(this.outputDir)) mkdirSync(this.outputDir, { recursive: true });
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) return;
    const interrupted = await this.jobs.find({ where: [{ status: 'queued' }, { status: 'rendering' }, { status: 'encoding' }] });
    for (const job of interrupted) {
      job.status = 'failed';
      job.error = '服务重启中断任务；为避免重复渲染，系统未自动重试，请重新生成';
      job.renderTokenHash = null;
      await this.jobs.save(job);
    }
  }

  create(userId: string, dto: CreateDesignProcessVideoDto): Promise<DesignProcessVideo> {
    const task = this.admissionQueue.then(() => this.createOne(userId, dto));
    this.admissionQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  private async createOne(userId: string, dto: CreateDesignProcessVideoDto): Promise<DesignProcessVideo> {
    if (!this.enabled) throw new ServiceUnavailableException('过程视频功能尚未启用');
    const meaningful = dto.steps.filter((step) => step.action !== 'start');
    if (!meaningful.length) throw new BadRequestException('至少完成一次珠子操作后才能生成视频');
    const [userActive, totalActive] = await Promise.all([
      this.jobs.count({ where: { ownerId: userId, status: In(ACTIVE_STATUSES) } }),
      this.jobs.count({ where: { status: In(ACTIVE_STATUSES) } }),
    ]);
    if (userActive > 0) throw new ConflictException('已有过程视频正在生成，请等待完成');
    if (totalActive >= MAX_ACTIVE_VIDEO_JOBS) {
      throw new ServiceUnavailableException('过程视频队列已满，请稍后重试');
    }
    const canonical = await this.canonicalize(dto);
    const row = await this.jobs.save(this.jobs.create({
      ownerId: userId, status: 'queued', progress: 0, steps: canonical.steps, palette: canonical.palette, wristCm: dto.wristCm || 16,
      videoUrl: null, durationMs: null, width: WIDTH, height: HEIGHT, error: null,
    }));
    this.schedule(row.id);
    return row;
  }

  async findOne(userId: string, id: string): Promise<DesignProcessVideo> {
    const row = await this.jobs.findOne({ where: { id, ownerId: userId } });
    if (!row) throw new NotFoundException('设计过程视频任务不存在');
    return row;
  }

  async findForRender(id: string, token: string): Promise<Omit<DesignProcessVideo, 'renderTokenHash'>> {
    if (!this.enabled || !/^[A-Za-z0-9_-]{40,128}$/.test(token)) {
      throw new ForbiddenException('渲染令牌无效');
    }
    const row = await this.jobs.createQueryBuilder('job')
      .addSelect('job.renderTokenHash')
      .where('job.id = :id', { id })
      .getOne();
    if (!row?.renderTokenHash || !ACTIVE_STATUSES.includes(row.status)) {
      throw new ForbiddenException('渲染令牌无效');
    }
    const actual = Buffer.from(this.hashToken(token), 'hex');
    const expected = Buffer.from(row.renderTokenHash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new ForbiddenException('渲染令牌无效');
    }
    const { renderTokenHash: _renderTokenHash, ...safe } = row;
    return safe;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private resolveSpec(
    material: Material,
    requested: { specId?: string; size: number },
  ) {
    return material.specs.find((spec) => requested.specId && spec.specId === requested.specId)
      ?? material.specs.find((spec) => Math.abs(Number(spec.size) - requested.size) < 0.001);
  }

  private async canonicalize(dto: CreateDesignProcessVideoDto): Promise<{
    steps: CreateDesignProcessVideoDto['steps'];
    palette: NonNullable<CreateDesignProcessVideoDto['palette']> | null;
  }> {
    const ids = [...new Set([
      ...dto.steps.flatMap((step) => step.beads.map((bead) => bead.materialId)),
      ...(dto.palette ?? []).map((item) => item.materialId),
    ])];
    const rows = await this.materials.findByIds(ids);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const canonicalItem = <T extends { materialId: string; specId?: string; size: number }>(item: T) => {
      const material = byId.get(item.materialId);
      if (!material || material.status !== 'published' || !material.isAvailable) {
        throw new BadRequestException(`素材不可用: ${item.materialId}`);
      }
      const spec = this.resolveSpec(material, item);
      if (!spec) throw new BadRequestException(`${material.name} 的规格不可用`);
      return {
        ...item,
        materialId: material.id,
        specId: spec.specId,
        name: material.name,
        image: material.image,
        size: Number(spec.size),
        price: Number(spec.price),
      };
    };

    return {
      steps: dto.steps.map((step) => ({
        ...step,
        beads: step.beads.map((bead, orderIndex) => ({ ...canonicalItem(bead), orderIndex })),
      })),
      palette: dto.palette?.map((item) => canonicalItem(item)) ?? null,
    };
  }

  private async findJob(id: string): Promise<DesignProcessVideo> {
    const row = await this.jobs.findOne({ where: { id } });
    if (!row) throw new NotFoundException('设计过程视频任务不存在');
    return row;
  }

  private schedule(id: string): void {
    this.queue = this.queue.then(() => this.process(id)).catch((error) => this.logger.error(error));
  }

  /** 使用 DevTools 直接截取实际 DIY 页面，保证视频与网页的布局和 WebGL 完全同源。 */
  private async renderWithWebClient(
    job: DesignProcessVideo,
    renderToken: string,
    onFrame: (frame: Buffer, index: number, total: number) => void,
  ): Promise<number> {
    if (!existsSync(this.chromePath)) throw new Error(`找不到 Chrome，请配置 CHROME_PATH: ${this.chromePath}`);
    const profileDir = join(this.outputDir, job.id, 'chrome-profile');
    const devToolsPortFile = join(profileDir, 'DevToolsActivePort');
    const url = `${this.webRenderUrl}${this.webRenderUrl.includes('?') ? '&' : '?'}videoRenderJobId=${encodeURIComponent(job.id)}&videoRenderToken=${encodeURIComponent(renderToken)}`;
    const chrome = spawn(this.chromePath, [
      '--headless=new', '--no-sandbox', '--no-first-run', '--disable-background-networking', '--disable-sync',
      '--no-proxy-server', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
      '--hide-scrollbars', '--force-device-scale-factor=1', '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`, `--window-size=${WIDTH},${HEIGHT}`, url,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let chromeError = '';
    let exited = false;
    chrome.stderr.on('data', (chunk) => { chromeError += String(chunk); });
    chrome.once('exit', () => { exited = true; });
    const startupDeadline = Date.now() + WEB_RENDER_STARTUP_TIMEOUT_MS;
    const wait = (ms: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
    let socket: any = null;
    try {
      while (!existsSync(devToolsPortFile) && Date.now() < startupDeadline && !exited) await wait(80);
      if (!existsSync(devToolsPortFile)) throw new Error(`Chrome 调试端口启动失败${chromeError ? `: ${chromeError.slice(-500)}` : ''}`);
      const port = Number(readFileSync(devToolsPortFile, 'utf8').split(/\r?\n/)[0]);
      let target: { webSocketDebuggerUrl?: string; url?: string } | undefined;
      while (!target?.webSocketDebuggerUrl && Date.now() < startupDeadline && !exited) {
        try {
          const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json()) as Array<{ webSocketDebuggerUrl?: string; url?: string }>;
          target = targets.find((item) => item.url?.includes('/pages/design/design'));
        } catch {
          // Chrome may expose the HTTP endpoint a few milliseconds after the port file.
        }
        if (!target?.webSocketDebuggerUrl) await wait(80);
      }
      if (!target?.webSocketDebuggerUrl) throw new Error('未找到 DIY 网页渲染目标');

      socket = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise<void>((resolvePromise, reject) => {
        socket.onopen = () => resolvePromise();
        socket.onerror = () => reject(new Error('无法连接 Chrome DevTools'));
      });
      let commandId = 0;
      const pending = new Map<number, { resolve: (value: any) => void; reject: (reason: Error) => void }>();
      socket.onclose = () => {
        pending.forEach((task) => task.reject(new Error('Chrome DevTools 连接已关闭')));
        pending.clear();
      };
      socket.onmessage = (event: { data: string }) => {
        const message = JSON.parse(String(event.data));
        if (!message.id || !pending.has(message.id)) return;
        const task = pending.get(message.id)!;
        pending.delete(message.id);
        if (message.error) task.reject(new Error(message.error.message || 'Chrome DevTools 命令失败'));
        else task.resolve(message.result);
      };
      const call = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolvePromise, reject) => {
        const id = ++commandId;
        pending.set(id, { resolve: resolvePromise, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
      await call('Page.enable');
      await call('Runtime.enable');
      await call('Emulation.setDeviceMetricsOverride', {
        width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
        screenWidth: WIDTH, screenHeight: HEIGHT,
      });

      let capturedFrames = 0;
      let totalFrames = 0;
      while (!totalFrames && Date.now() < startupDeadline && !exited) {
        const state = await call('Runtime.evaluate', {
          expression: 'Number(document.documentElement.dataset.videoFrameTotal || 0)',
          returnByValue: true,
        });
        totalFrames = Number(state?.result?.value || 0);
        if (!totalFrames) await wait(20);
      }
      if (exited) throw new Error(`网页渲染器提前退出${chromeError ? `: ${chromeError.slice(-500)}` : ''}`);
      if (!totalFrames) throw new Error('网页渲染器未提供视频帧总数');
      const captureTimeout = Math.max(
        WEB_RENDER_MIN_CAPTURE_TIMEOUT_MS,
        totalFrames * WEB_RENDER_CAPTURE_TIMEOUT_PER_FRAME_MS + WEB_RENDER_CAPTURE_GRACE_MS,
      );
      const captureDeadline = Date.now() + captureTimeout;
      let savedProgress = job.progress;
      while (capturedFrames < totalFrames && Date.now() < captureDeadline) {
        if (exited) throw new Error(`网页渲染器提前退出${chromeError ? `: ${chromeError.slice(-500)}` : ''}`);
        const state = await call('Runtime.evaluate', {
          expression: 'document.documentElement.dataset.videoFrameSerial || ""',
          returnByValue: true,
        });
        const readyIndex = Number(state?.result?.value);
        if (String(state?.result?.value) !== '' && readyIndex === capturedFrames) {
          const screenshot = await call('Page.captureScreenshot', {
            format: 'png', fromSurface: true, captureBeyondViewport: false,
          });
          onFrame(Buffer.from(screenshot.data, 'base64'), capturedFrames, totalFrames);
          capturedFrames += 1;
          await call('Runtime.evaluate', {
            expression: `document.documentElement.dataset.videoFrameAck = ${JSON.stringify(String(readyIndex))}`,
          });
          const nextProgress = 3 + Math.round((capturedFrames / totalFrames) * 72);
          if (nextProgress !== savedProgress) {
            job.progress = nextProgress;
            await this.jobs.save(job);
            savedProgress = nextProgress;
          }
        } else {
          await wait(8);
        }
      }
      if (capturedFrames < totalFrames) throw new Error(`网页渲染超时，仅截取 ${capturedFrames}/${totalFrames} 帧`);
      return capturedFrames;
    } finally {
      if (socket?.readyState === 1) socket.close();
      if (!exited) chrome.kill('SIGTERM');
      rmSync(profileDir, { recursive: true, force: true });
    }
  }

  private async runFfmpeg(framePattern: string, output: string): Promise<void> {
    await new Promise<void>((resolvePromise, reject) => {
      const child = spawn(this.ffmpegPath, [
        '-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(CAPTURE_FPS), '-i', framePattern,
        '-vf', `fps=${OUTPUT_FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', output,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      let errorText = '';
      child.stderr.on('data', (chunk) => { errorText += String(chunk); });
      child.once('error', reject);
      child.once('close', (code) => code === 0 ? resolvePromise() : reject(new Error(errorText || `ffmpeg exited ${code}`)));
    });
  }

  private async process(id: string): Promise<void> {
    const job = await this.findJob(id);
    const jobDir = join(this.outputDir, id);
    const frameDir = join(jobDir, 'frames');
    try {
      if (existsSync(jobDir)) rmSync(jobDir, { recursive: true, force: true });
      mkdirSync(frameDir, { recursive: true });
      const renderToken = randomBytes(32).toString('base64url');
      job.status = 'rendering'; job.progress = 2; job.error = null;
      job.renderTokenHash = this.hashToken(renderToken);
      await this.jobs.save(job);

      let frameIndex = 0;
      let lastFrame: Buffer | null = null;
      const writeFrame = (frame: Buffer) => {
        writeFileSync(join(frameDir, `${String(frameIndex).padStart(5, '0')}.png`), frame);
        frameIndex += 1;
      };

      await this.renderWithWebClient(job, renderToken, (frame, index) => {
        if (index === 0) {
          for (let intro = 0; intro < INTRO_FRAMES; intro += 1) writeFrame(frame);
        }
        writeFrame(frame);
        lastFrame = frame;
      });
      if (!lastFrame) throw new Error('网页渲染器没有返回视频帧');
      for (let outro = 0; outro < OUTRO_FRAMES; outro += 1) writeFrame(lastFrame!);

      job.status = 'encoding'; job.progress = 88; job.renderTokenHash = null; await this.jobs.save(job);
      const outputPath = join(jobDir, 'design-process.mp4');
      await this.runFfmpeg(join(frameDir, '%05d.png'), outputPath);
      rmSync(frameDir, { recursive: true, force: true });
      job.status = 'complete'; job.progress = 100; job.renderTokenHash = null;
      job.videoUrl = `/uploads/design-process-videos/${id}/design-process.mp4`;
      job.durationMs = Math.round((frameIndex / CAPTURE_FPS) * 1000);
      await this.jobs.save(job);
    } catch (error) {
      job.status = 'failed'; job.error = error instanceof Error ? error.message : String(error); job.renderTokenHash = null;
      await this.jobs.save(job);
      this.logger.error(`design process video ${id} failed: ${job.error}`);
    }
  }
}
