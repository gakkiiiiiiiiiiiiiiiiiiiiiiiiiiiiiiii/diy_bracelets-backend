import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { ImageAssetsService } from '../ai/image-assets.service';
import { BraceletRenderService } from '../bracelet-agent/bracelet-render.service';
import { Material } from '../materials/entities/material.entity';
import { MaterialsService } from '../materials/materials.service';
import { CreateDesignProcessVideoDto, DesignProcessBeadDto, DesignProcessPaletteItemDto, DesignProcessStepDto } from './dto/design-process-video.dto';
import { DesignProcessVideo } from './entities/design-process-video.entity';

const WIDTH = 720;
const HEIGHT = 1280;
const SOURCE_FPS = 6;
const FRAMES_PER_STEP = 4;
const INTRO_FRAMES = 6;
const OUTRO_FRAMES = 8;

const actionLabels: Record<DesignProcessStepDto['action'], string> = {
  start: '从空白工作台开始', add: '添加一颗水晶珠', move: '调整珠子顺序', remove: '删除一颗珠子',
  replace: '替换珠子材质', clear: '清空当前设计', apply: '载入一套设计',
};

function escapeXml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
}

function clampText(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

@Injectable()
export class DesignProcessVideosService implements OnModuleInit {
  private readonly logger = new Logger(DesignProcessVideosService.name);
  private readonly outputDir: string;
  private readonly ffmpegPath: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(DesignProcessVideo) private readonly jobs: Repository<DesignProcessVideo>,
    private readonly materials: MaterialsService,
    private readonly braceletRenderer: BraceletRenderService,
    private readonly images: ImageAssetsService,
    config: ConfigService,
  ) {
    this.outputDir = resolve(this.images.uploadDir, 'design-process-videos');
    this.ffmpegPath = config.get<string>('FFMPEG_PATH', 'ffmpeg');
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

  private materialCards(palette: DesignProcessPaletteItemDto[], finalStep: DesignProcessStepDto): string {
    const cards: DesignProcessPaletteItemDto[] = palette.slice(0, 6);
    while (cards.length < 6) cards.push({
      materialId: `placeholder-${cards.length}`, name: '水晶素材', image: '', size: 8, price: 0,
    });
    return cards.map((bead, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = 136 + column * 186;
      const y = 897 + row * 174;
      const count = finalStep.beads.filter((entry) => entry.materialId === bead.materialId).length;
      return `<g>
        <rect x="${x}" y="${y}" width="168" height="158" rx="18" fill="#ffffff" stroke="#e7e4df"/>
        <circle cx="${x + 84}" cy="${y + 53}" r="38" fill="#f1efeb"/>
        <text x="${x + 84}" y="${y + 111}" text-anchor="middle" class="card-name">${escapeXml(clampText(bead.name, 8))}</text>
        <text x="${x + 84}" y="${y + 137}" text-anchor="middle" class="card-meta">${bead.size}mm · ¥${bead.price.toFixed(0)}${count ? ` · ${count}颗` : ''}</text>
      </g>`;
    }).join('');
  }

  private workspaceSvg(
    step: DesignProcessStepDto,
    stepIndex: number,
    stepCount: number,
    wristCm: number,
    finalStep: DesignProcessStepDto,
    palette: DesignProcessPaletteItemDto[],
  ): Buffer {
    const circumference = step.beads.reduce((sum, bead) => sum + bead.size / 10, 0);
    const totalPrice = step.beads.reduce((sum, bead) => sum + bead.price, 0);
    const status = circumference + 0.05 < wristCm ? '珠子数量不足' : '尺寸已合适';
    const used = [...new Set(step.beads.map((bead) => bead.materialId))].length;
    const cards = this.materialCards(palette, finalStep);
    return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="page" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fbfaf7"/><stop offset="1" stop-color="#f0ede7"/></linearGradient>
        <radialGradient id="stage" cx="38%" cy="24%" r="78%"><stop stop-color="#fff"/><stop offset=".58" stop-color="#f7f4ef"/><stop offset="1" stop-color="#e8e5df"/></radialGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#71808a" flood-opacity=".12"/></filter>
      </defs>
      <style>
        text { font-family: -apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif; fill:#20252b; }
        .tag { font-size:20px; font-weight:700; } .muted { fill:#8d969b; font-size:17px; font-weight:600; }
        .card-name { font-size:17px; font-weight:800; } .card-meta { fill:#81898f; font-size:13px; font-weight:650; }
      </style>
      <rect width="720" height="1280" fill="url(#page)"/>
      <rect x="0" y="0" width="720" height="82" fill="#fff" fill-opacity=".9"/>
      <text x="30" y="52" font-size="32" font-weight="400">‹</text>
      <text x="360" y="50" text-anchor="middle" font-size="23" font-weight="900">珠岛设计台</text>
      <rect x="580" y="22" width="112" height="42" rx="22" fill="#fff" stroke="#d4d5d3"/>
      <circle cx="606" cy="43" r="4" fill="#59636a"/><circle cx="620" cy="43" r="4" fill="#59636a"/><circle cx="634" cy="43" r="4" fill="#59636a"/>
      <path d="M651 31v24" stroke="#d7d8d6"/><circle cx="672" cy="43" r="10" fill="none" stroke="#59636a" stroke-width="4"/>
      <rect x="20" y="99" width="116" height="42" rx="13" fill="#d85f58"/><text x="78" y="127" text-anchor="middle" fill="#fff" class="tag">使用须知</text>
      <rect x="148" y="99" width="184" height="42" rx="13" fill="#e9e8e4"/><text x="240" y="127" text-anchor="middle" class="tag">手围 ${wristCm.toFixed(1)}cm</text>
      <rect x="344" y="99" width="190" height="42" rx="13" fill="${status === '尺寸已合适' ? '#e5eee9' : '#ece9e4'}"/><text x="439" y="127" text-anchor="middle" class="tag">${status}</text>
      <rect x="546" y="99" width="154" height="42" rx="13" fill="#e9e8e4"/><text x="623" y="127" text-anchor="middle" class="tag">总价 ¥${totalPrice.toFixed(1)}</text>
      <rect x="20" y="158" width="680" height="530" rx="28" fill="url(#stage)" filter="url(#shadow)"/>
      <rect x="548" y="176" width="132" height="38" rx="19" fill="#fff" stroke="#d8d6d0"/><text x="614" y="201" text-anchor="middle" font-size="16" font-weight="800">俯视视角</text>
      <text x="360" y="405" text-anchor="middle" font-size="25" font-weight="900" fill="#7897a0">珠岛</text>
      <text x="360" y="429" text-anchor="middle" font-size="15" font-weight="900" fill="#d3a3a0">ZHUDAO</text>
      <rect x="42" y="621" width="636" height="50" rx="16" fill="#fff" fill-opacity=".88"/>
      <text x="62" y="653" font-size="17" font-weight="800">步骤 ${stepIndex + 1}/${stepCount}</text>
      <text x="195" y="653" class="muted">${escapeXml(actionLabels[step.action])}</text>
      <text x="654" y="653" text-anchor="end" class="muted">${step.beads.length}颗 · ${used}种材质</text>
      <g>
        <rect x="20" y="706" width="104" height="48" rx="24" fill="#fff" stroke="#cfd4d4"/><text x="72" y="737" text-anchor="middle" font-size="18" font-weight="800">功能</text>
        <rect x="136" y="706" width="104" height="48" rx="24" fill="#fff" stroke="#cfd4d4"/><text x="188" y="737" text-anchor="middle" font-size="18" font-weight="800">灵感</text>
        <rect x="252" y="706" width="104" height="48" rx="24" fill="#d7a19d"/><text x="304" y="737" text-anchor="middle" fill="#fff" font-size="18" font-weight="800">保存</text>
        <rect x="520" y="706" width="180" height="48" rx="24" fill="#527985"/><text x="610" y="737" text-anchor="middle" fill="#fff" font-size="18" font-weight="900">完成设计</text>
      </g>
      <rect x="0" y="774" width="720" height="506" rx="28" fill="#f6f4f0"/>
      <rect x="22" y="794" width="676" height="60" rx="30" fill="#fff" stroke="#e2dfda"/>
      <text x="52" y="831" font-size="19" font-weight="750" fill="#8a9296">搜索水晶珠素材</text><text x="661" y="831" text-anchor="end" font-size="24">⌕</text>
      <rect x="20" y="876" width="96" height="360" rx="18" fill="#ebe9e5"/>
      <rect x="24" y="886" width="88" height="58" rx="15" fill="#fff"/><text x="68" y="921" text-anchor="middle" font-size="17" font-weight="900">正在使用</text>
      <text x="68" y="990" text-anchor="middle" class="muted">白水晶</text><text x="68" y="1050" text-anchor="middle" class="muted">紫水晶</text><text x="68" y="1110" text-anchor="middle" class="muted">黄水晶</text><text x="68" y="1170" text-anchor="middle" class="muted">更多</text>
      ${cards}
      <rect x="22" y="1246" width="676" height="8" rx="4" fill="#ddd9d3"/><rect x="22" y="1246" width="${Math.max(12, Math.round(((stepIndex + 1) / stepCount) * 676))}" height="8" rx="4" fill="#7897a0"/>
    </svg>`);
  }

  private materialForBead(bead: DesignProcessBeadDto, materialMap: Map<string, Material>): Material {
    const existing = materialMap.get(bead.materialId);
    if (existing && (!bead.image || existing.image === bead.image)) return existing;
    return {
      id: bead.materialId,
      name: bead.name,
      image: bead.image || existing?.image || '',
      categoryId: existing?.categoryId || 'crystal-video',
      specs: [{ specId: bead.specId, size: bead.size, price: bead.price }],
      status: 'published', isAvailable: true,
      crystalFamily: existing?.crystalFamily || '', aliases: existing?.aliases || [],
      dominantColors: existing?.dominantColors || [], transparency: existing?.transparency || '',
      pattern: existing?.pattern || '', inclusions: existing?.inclusions || '', sourceRefs: [], confidence: {},
      generatedBy: existing?.generatedBy || 'manual', manualOverrides: [], embedding: null, assetBundle: {},
      createdAt: existing?.createdAt || new Date(), updatedAt: existing?.updatedAt || new Date(),
    };
  }

  private async paletteOverlays(palette: DesignProcessPaletteItemDto[]) {
    const overlays: Array<{ input: Buffer; left: number; top: number }> = [];
    for (let index = 0; index < Math.min(6, palette.length); index += 1) {
      if (!palette[index].image) continue;
      try {
        const loaded = await this.images.load(palette[index].image);
        const input = await sharp(loaded.buffer)
          .ensureAlpha()
          .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
          .resize(76, 76, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .composite([{
            input: Buffer.from('<svg width="76" height="76" xmlns="http://www.w3.org/2000/svg"><circle cx="38" cy="38" r="37" fill="#fff"/></svg>'),
            blend: 'dest-in',
          }])
          .png().toBuffer();
        overlays.push({ input, left: 182 + (index % 3) * 186, top: 912 + Math.floor(index / 3) * 174 });
      } catch (error) {
        this.logger.warn(`无法载入视频素材卡图片 ${palette[index].image}: ${error instanceof Error ? error.message : error}`);
      }
    }
    return overlays;
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

      const ids = [...new Set(job.steps.flatMap((step) => step.beads.map((bead) => bead.materialId)))];
      const materialRows = await this.materials.findByIds(ids);
      const materialMap = new Map(materialRows.map((material) => [material.id, material]));
      const steps = job.steps.length && job.steps[0].action === 'start'
        ? job.steps
        : [{ id: 'server-start', action: 'start' as const, at: Date.now(), beads: [] }, ...job.steps];
      const finalStep = [...steps].reverse().find((step) => step.beads.length) || steps[steps.length - 1];
      const palette = job.palette?.length
        ? job.palette
        : [...new Map(finalStep.beads.map((bead) => [bead.materialId, bead])).values()].map((bead) => ({
          materialId: bead.materialId, name: bead.name, image: bead.image, size: bead.size, price: bead.price,
        }));
      const paletteOverlays = await this.paletteOverlays(palette);
      const rendered: Buffer[] = [];

      for (let index = 0; index < steps.length; index += 1) {
        const validBeads = steps[index].beads.map((bead) => ({
          material: this.materialForBead(bead, materialMap), specId: bead.specId,
        }));
        const publicPath = await this.braceletRenderer.render(`process-${id}`, index, validBeads);
        rendered.push((await this.images.load(publicPath)).buffer);
        job.progress = 3 + Math.round(((index + 1) / steps.length) * 40);
        await this.jobs.save(job);
      }

      let frameIndex = 0;
      const writeFrame = async (stepIndex: number, usePrevious: boolean) => {
        const step = steps[stepIndex];
        const workspace = this.workspaceSvg(step, stepIndex, steps.length, job.wristCm, finalStep, palette);
        const bracelet = rendered[usePrevious && stepIndex > 0 ? stepIndex - 1 : stepIndex];
        const output = await sharp(workspace)
          .composite([
            { input: await sharp(bracelet).resize(720, 720, { fit: 'contain' }).png().toBuffer(), left: 0, top: 105 },
            ...paletteOverlays,
          ])
          .png({ compressionLevel: 4 }).toBuffer();
        writeFileSync(join(frameDir, `${String(frameIndex).padStart(5, '0')}.png`), output);
        frameIndex += 1;
      };

      for (let index = 0; index < INTRO_FRAMES; index += 1) await writeFrame(0, false);
      for (let stepIndex = 1; stepIndex < steps.length; stepIndex += 1) {
        for (let part = 0; part < FRAMES_PER_STEP; part += 1) {
          await writeFrame(stepIndex, part < Math.floor(FRAMES_PER_STEP / 2));
        }
        job.progress = 45 + Math.round((stepIndex / Math.max(1, steps.length - 1)) * 40);
        await this.jobs.save(job);
      }
      for (let index = 0; index < OUTRO_FRAMES; index += 1) await writeFrame(steps.length - 1, false);

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
