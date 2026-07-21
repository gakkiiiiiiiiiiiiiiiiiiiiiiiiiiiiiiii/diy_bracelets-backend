import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { Repository } from 'typeorm';
import WebSocket from 'ws';
import { ImageAssetsService } from '../ai/image-assets.service';
import { CreateDesignProcessVideoDto } from './dto/design-process-video.dto';
import { DesignProcessVideo } from './entities/design-process-video.entity';

const WIDTH = 720;
const HEIGHT = 1280;
const SOURCE_FPS = 6;
const FRAMES_PER_STEP = 4;
const INTRO_FRAMES = 6;
const OUTRO_FRAMES = 8;

@Injectable()
export class DesignProcessVideosService implements OnModuleInit {
  private readonly logger = new Logger(DesignProcessVideosService.name);
  private readonly outputDir: string;
  private readonly ffmpegPath: string;
  private readonly chromePath: string;
  private readonly webRenderUrl: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(DesignProcessVideo) private readonly jobs: Repository<DesignProcessVideo>,
    private readonly images: ImageAssetsService,
    config: ConfigService,
  ) {
    this.outputDir = resolve(this.images.uploadDir, 'design-process-videos');
    this.ffmpegPath = config.get<string>('FFMPEG_PATH', 'ffmpeg');
    this.chromePath = config.get<string>('CHROME_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    this.webRenderUrl = config.get<string>('VIDEO_WEB_RENDER_URL', 'http://127.0.0.1:5173/#/pages/design/design');
    if (!existsSync(this.outputDir)) mkdirSync(this.outputDir, { recursive: true });
  }

  async onModuleInit(): Promise<void> {
    const interrupted = await this.jobs.find({ where: [{ status: 'queued' }, { status: 'rendering' }, { status: 'encoding' }] });
    for (const job of interrupted) {
      job.status = 'queued';
      job.progress = 0;
      await this.jobs.save(job);
      this.schedule(job.id);
    }
  }

  async create(dto: CreateDesignProcessVideoDto): Promise<DesignProcessVideo> {
    const meaningful = dto.steps.filter((step) => step.action !== 'start');
    if (!meaningful.length) throw new BadRequestException('至少完成一次珠子操作后才能生成视频');
    const row = await this.jobs.save(this.jobs.create({
      status: 'queued', progress: 0, steps: dto.steps, palette: dto.palette || null, wristCm: dto.wristCm || 16,
      videoUrl: null, durationMs: null, width: WIDTH, height: HEIGHT, error: null,
    }));
    this.schedule(row.id);
    return row;
  }

  async findOne(id: string): Promise<DesignProcessVideo> {
    const row = await this.jobs.findOne({ where: { id } });
    if (!row) throw new NotFoundException('设计过程视频任务不存在');
    return row;
  }

  private schedule(id: string): void {
    this.queue = this.queue.then(() => this.process(id)).catch((error) => this.logger.error(error));
  }

  /** 使用 DevTools 直接截取实际 DIY 页面，保证视频与网页的布局和 WebGL 完全同源。 */
  private async renderWithWebClient(job: DesignProcessVideo): Promise<Buffer[]> {
    if (!existsSync(this.chromePath)) throw new Error(`找不到 Chrome，请配置 CHROME_PATH: ${this.chromePath}`);
    const profileDir = join(this.outputDir, job.id, 'chrome-profile');
    const devToolsPortFile = join(profileDir, 'DevToolsActivePort');
    const url = `${this.webRenderUrl}${this.webRenderUrl.includes('?') ? '&' : '?'}videoRenderJobId=${encodeURIComponent(job.id)}`;
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
    const deadline = Date.now() + 4 * 60 * 1000;
    const wait = (ms: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
    let socket: any = null;
    try {
      while (!existsSync(devToolsPortFile) && Date.now() < deadline && !exited) await wait(80);
      if (!existsSync(devToolsPortFile)) throw new Error(`Chrome 调试端口启动失败${chromeError ? `: ${chromeError.slice(-500)}` : ''}`);
      const port = Number(readFileSync(devToolsPortFile, 'utf8').split(/\r?\n/)[0]);
      let target: { webSocketDebuggerUrl?: string; url?: string } | undefined;
      while (!target?.webSocketDebuggerUrl && Date.now() < deadline && !exited) {
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

      const frames: Buffer[] = [];
      while (frames.length < job.steps.length && Date.now() < deadline) {
        if (exited) throw new Error(`网页渲染器提前退出${chromeError ? `: ${chromeError.slice(-500)}` : ''}`);
        const state = await call('Runtime.evaluate', {
          expression: 'document.documentElement.dataset.videoFrameIndex || ""',
          returnByValue: true,
        });
        const readyIndex = Number(state?.result?.value);
        if (String(state?.result?.value) !== '' && readyIndex === frames.length) {
          const screenshot = await call('Page.captureScreenshot', {
            format: 'png', fromSurface: true, captureBeyondViewport: false,
          });
          frames.push(Buffer.from(screenshot.data, 'base64'));
          await call('Runtime.evaluate', {
            expression: `document.documentElement.dataset.videoFrameAck = ${JSON.stringify(String(readyIndex))}`,
          });
          job.progress = 3 + Math.round((frames.length / job.steps.length) * 40);
          await this.jobs.save(job);
        } else {
          await wait(80);
        }
      }
      if (frames.length < job.steps.length) throw new Error(`网页渲染超时，仅截取 ${frames.length}/${job.steps.length} 帧`);
      return frames;
    } finally {
      if (socket?.readyState === 1) socket.close();
      if (!exited) chrome.kill('SIGTERM');
      rmSync(profileDir, { recursive: true, force: true });
    }
  }

  private async runFfmpeg(framePattern: string, output: string): Promise<void> {
    await new Promise<void>((resolvePromise, reject) => {
      const child = spawn(this.ffmpegPath, [
        '-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(SOURCE_FPS), '-i', framePattern,
        '-vf', 'fps=24,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', output,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      let errorText = '';
      child.stderr.on('data', (chunk) => { errorText += String(chunk); });
      child.once('error', reject);
      child.once('close', (code) => code === 0 ? resolvePromise() : reject(new Error(errorText || `ffmpeg exited ${code}`)));
    });
  }

  private async process(id: string): Promise<void> {
    const job = await this.findOne(id);
    const jobDir = join(this.outputDir, id);
    const frameDir = join(jobDir, 'frames');
    try {
      if (existsSync(jobDir)) rmSync(jobDir, { recursive: true, force: true });
      mkdirSync(frameDir, { recursive: true });
      job.status = 'rendering'; job.progress = 2; job.error = null; await this.jobs.save(job);

      const steps = job.steps;
      const rendered = await this.renderWithWebClient(job);

      let frameIndex = 0;
      const writeFrame = (stepIndex: number, usePrevious: boolean) => {
        const sourceIndex = usePrevious && stepIndex > 0 ? stepIndex - 1 : stepIndex;
        writeFileSync(join(frameDir, `${String(frameIndex).padStart(5, '0')}.png`), rendered[sourceIndex]);
        frameIndex += 1;
      };

      for (let index = 0; index < INTRO_FRAMES; index += 1) writeFrame(0, false);
      for (let stepIndex = 1; stepIndex < steps.length; stepIndex += 1) {
        for (let part = 0; part < FRAMES_PER_STEP; part += 1) {
          writeFrame(stepIndex, part < Math.floor(FRAMES_PER_STEP / 2));
        }
        job.progress = 45 + Math.round((stepIndex / Math.max(1, steps.length - 1)) * 40);
        await this.jobs.save(job);
      }
      for (let index = 0; index < OUTRO_FRAMES; index += 1) writeFrame(steps.length - 1, false);

      job.status = 'encoding'; job.progress = 88; await this.jobs.save(job);
      const outputPath = join(jobDir, 'design-process.mp4');
      await this.runFfmpeg(join(frameDir, '%05d.png'), outputPath);
      rmSync(frameDir, { recursive: true, force: true });
      job.status = 'complete'; job.progress = 100;
      job.videoUrl = `/uploads/design-process-videos/${id}/design-process.mp4`;
      job.durationMs = Math.round((frameIndex / SOURCE_FPS) * 1000);
      await this.jobs.save(job);
    } catch (error) {
      job.status = 'failed'; job.error = error instanceof Error ? error.message : String(error);
      await this.jobs.save(job);
      this.logger.error(`design process video ${id} failed: ${job.error}`);
    }
  }
}
