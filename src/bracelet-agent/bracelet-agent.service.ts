import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeneratedBraceletCandidate } from '../ai/ai.types';
import { ImageAssetsService } from '../ai/image-assets.service';
import { CodexCliProviderService } from '../ai/codex-cli-provider.service';
import { BraceletCodeService } from '../bracelet-code/bracelet-code.service';
import { Material } from '../materials/entities/material.entity';
import { MaterialsService } from '../materials/materials.service';
import { BraceletRenderService } from './bracelet-render.service';
import { CreateAgentFeedbackDto, CreateAgentGenerationDto } from './dto/agent.dto';
import { RenderAgentBraceletDto } from './dto/agent.dto';
import { AgentFeedback } from './entities/agent-feedback.entity';
import { AgentGeneration } from './entities/agent-generation.entity';
import { parseBoolean } from '../config/environment';

@Injectable()
export class BraceletAgentService implements OnModuleInit {
  private readonly logger = new Logger(BraceletAgentService.name);
  private queue: Promise<void> = Promise.resolve();
  private admissionQueue: Promise<void> = Promise.resolve();
  private readonly enabled: boolean;

  constructor(
    @InjectRepository(AgentGeneration) private readonly generations: Repository<AgentGeneration>,
    @InjectRepository(AgentFeedback) private readonly feedback: Repository<AgentFeedback>,
    private readonly materials: MaterialsService,
    private readonly ai: CodexCliProviderService,
    private readonly images: ImageAssetsService,
    private readonly code: BraceletCodeService,
    private readonly renderer: BraceletRenderService,
    config: ConfigService,
  ) {
    this.enabled = parseBoolean(config.get('BRACELET_AGENT_ENABLED'), false);
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) return;
    const rows = await this.generations.find({ where: [{ status: 'queued' }, { status: 'analyzing' }, { status: 'retrieving' }, { status: 'generating' }, { status: 'rendering' }] });
    for (const row of rows) {
      row.status = 'failed';
      row.error = '服务重启中断任务；为避免重复调用模型，系统未自动重试，请重新提交';
      await this.generations.save(row);
    }
  }

  create(dto: CreateAgentGenerationDto): Promise<AgentGeneration> {
    const task = this.admissionQueue.then(() => this.createOne(dto));
    this.admissionQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  private async createOne(dto: CreateAgentGenerationDto): Promise<AgentGeneration> {
    if (!this.enabled) throw new ServiceUnavailableException('搭配 Agent 默认关闭，请由运维显式设置 BRACELET_AGENT_ENABLED=true');
    if (!dto.referenceImage && !dto.colors?.length) throw new BadRequestException('请上传参考图片或至少选择一种颜色');
    if (!this.ai.configured) throw new ServiceUnavailableException('本地 Codex CLI 不可用，请检查 CODEX_CLI_PATH');
    const active = await this.generations.createQueryBuilder('generation')
      .where('generation.status IN (:...statuses)', { statuses: ['queued', 'analyzing', 'retrieving', 'generating', 'rendering'] })
      .getCount();
    if (active > 0) throw new ConflictException('已有搭配任务正在执行，请等待完成后再提交');
    const row = await this.generations.save(this.generations.create({
      status: 'queued', input: { colors: dto.colors || [], referenceImage: dto.referenceImage, wristCm: dto.wristCm || 16 }, candidates: null,
    }));
    this.schedule(row.id);
    return row;
  }

  async findOne(id: string): Promise<AgentGeneration> {
    const row = await this.generations.findOne({ where: { id } });
    if (!row) throw new NotFoundException('搭配任务不存在');
    return row;
  }

  list(limit?: string): Promise<AgentGeneration[]> {
    const take = Math.max(1, Math.min(100, Number.parseInt(limit || '30', 10) || 30));
    return this.generations.find({ order: { createdAt: 'DESC' }, take });
  }

  providerStatus() {
    const provider = this.ai.status();
    const ready = this.enabled && provider.configured;
    return {
      ...provider,
      enabled: this.enabled,
      ready,
      reason: ready ? '' : !this.enabled
        ? '搭配 Agent 未启用（BRACELET_AGENT_ENABLED=false）'
        : 'Codex CLI 不可用，请检查 CODEX_CLI_PATH',
    };
  }

  private schedule(id: string): void { this.queue = this.queue.then(() => this.process(id)).catch((error) => this.logger.error(error)); }

  private colorVector(color: string): [number, number, number] | null {
    const named: Record<string, string> = { 红: '#d75a65', 粉: '#efa0b7', 橙: '#e28a45', 黄: '#d8b84e', 绿: '#68a67b', 蓝: '#668fbd', 紫: '#8a6bb4', 白: '#e9e9e9', 黑: '#333333', 茶: '#9a725b' };
    const value = /^#[0-9a-f]{6}$/i.test(color) ? color : Object.entries(named).find(([name]) => color.includes(name))?.[1];
    if (!value) return null;
    return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
  }

  private colorScore(material: Material, colors: string[]): number {
    if (!colors.length) return 0.5;
    const targets = colors.map((color) => this.colorVector(color)).filter(Boolean) as [number, number, number][];
    const values = (material.dominantColors || []).map((color) => this.colorVector(color)).filter(Boolean) as [number, number, number][];
    const textMatch = colors.some((color) => `${material.name} ${(material.dominantColors || []).join(' ')}`.includes(color.replace('色', '')));
    if (!targets.length || !values.length) return textMatch ? 1 : 0.25;
    const minDistance = Math.min(...targets.flatMap((a) => values.map((b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2))));
    return Math.max(0, 1 - minDistance / 441);
  }

  private retrieve(inventory: Material[], colors: string[]): Material[] {
    return [...inventory].sort((a, b) => this.colorScore(b, colors) - this.colorScore(a, colors)).slice(0, Math.min(12, inventory.length));
  }

  private heuristic(materials: Material[], wristCm: number): GeneratedBraceletCandidate[] {
    const choices = materials.filter((m) => m.specs.length).slice(0, 6);
    if (!choices.length) return [];
    const average = choices.reduce((sum, item) => sum + (item.specs[0]?.size || 8), 0) / choices.length;
    const count = Math.max(12, Math.min(36, Math.round(wristCm * 10 / average)));
    const make = (title: string, rationale: string, picker: (index: number) => Material): GeneratedBraceletCandidate => ({
      title, rationale, beads: Array.from({ length: count }, (_, index) => {
        const material = picker(index);
        return { materialId: material.id, specId: material.specs[0].specId };
      }),
    });
    return [
      make('柔和对称', '主色与辅色交替，形成稳定的对称节奏。', (i) => choices[i % Math.min(2, choices.length)]),
      make('水晶渐变', '按色彩和通透度渐变排列，整体更轻盈。', (i) => choices[Math.min(choices.length - 1, Math.floor((Math.min(i, count - 1 - i) / Math.max(1, count / 2)) * choices.length))]),
      make('色段呼吸', '使用连续色段和短重复周期，让重点水晶更突出。', (i) => choices[Math.floor(i / 3) % choices.length]),
    ];
  }

  private validateCandidate(candidate: GeneratedBraceletCandidate, inventory: Material[], wristCm: number): GeneratedBraceletCandidate | null {
    const map = new Map(inventory.map((item) => [item.id, item]));
    const valid = candidate.beads.filter((bead) => map.get(bead.materialId)?.specs.some((spec) => spec.specId === bead.specId));
    if (valid.length < 8) return null;
    let totalMm = valid.reduce((sum, bead) => sum + (map.get(bead.materialId)?.specs.find((spec) => spec.specId === bead.specId)?.size || 8), 0);
    const target = wristCm * 10;
    while (valid.length > 8 && totalMm > target + 8) {
      const removed = valid.pop()!;
      totalMm -= map.get(removed.materialId)?.specs.find((spec) => spec.specId === removed.specId)?.size || 8;
    }
    while (valid.length < 40 && totalMm < target - 8) {
      const next = valid[valid.length % Math.max(1, valid.length)];
      valid.push({ ...next }); totalMm += map.get(next.materialId)?.specs.find((spec) => spec.specId === next.specId)?.size || 8;
    }
    return { ...candidate, beads: valid };
  }

  private async process(id: string): Promise<void> {
    const row = await this.findOne(id);
    try {
      let colors = [...row.input.colors];
      if (row.input.referenceImage) {
        row.status = 'analyzing'; await this.generations.save(row);
        const image = await this.images.load(row.input.referenceImage);
        const description = await this.ai.describeReference(image.buffer, image.mime);
        colors = [...new Set([...colors, ...description.colors])]; row.referenceDescription = description.description;
      }
      row.status = 'retrieving'; await this.generations.save(row);
      const inventory = await this.materials.findPublished();
      if (!inventory.length) throw new Error('没有可用的已发布水晶珠素材');
      const retrieved = this.retrieve(inventory, colors);
      row.status = 'generating'; await this.generations.save(row);
      const raw = await this.ai.generateBracelets({ colors, wristCm: row.input.wristCm, referenceDescription: row.referenceDescription || undefined, inventory: retrieved.map((item) => ({
        materialId: item.id, name: item.name, colors: item.dominantColors || [], transparency: item.transparency, pattern: item.pattern, specs: item.specs,
      })) });
      const fallback = this.heuristic(retrieved, row.input.wristCm);
      const candidates = [...raw.map((item) => this.validateCandidate(item, retrieved, row.input.wristCm)).filter(Boolean), ...fallback]
        .slice(0, 3) as GeneratedBraceletCandidate[];
      if (candidates.length < 3) throw new Error('无法生成三套有效搭配');
      row.status = 'rendering'; await this.generations.save(row);
      const materialMap = new Map(retrieved.map((item) => [item.id, item]));
      row.candidates = await Promise.all(candidates.map(async (candidate, index) => {
        const code = this.code.encode({ v: 1, wristCm: row.input.wristCm, beads: candidate.beads, styleRef: row.id });
        const previewImage = await this.renderer.render(row.id, index, candidate.beads.map((bead) => ({ material: materialMap.get(bead.materialId)!, specId: bead.specId })));
        const totalPrice = candidate.beads.reduce((sum, bead) => sum + (materialMap.get(bead.materialId)?.specs.find((spec) => spec.specId === bead.specId)?.price || 0), 0);
        return { ...candidate, code, previewImage, totalPrice: Number(totalPrice.toFixed(2)) };
      }));
      row.status = 'complete'; row.error = null; await this.generations.save(row);
    } catch (error) {
      row.status = 'failed'; row.error = error instanceof Error ? error.message : String(error); await this.generations.save(row);
    }
  }

  async addFeedback(dto: CreateAgentFeedbackDto): Promise<AgentFeedback> {
    await this.findOne(dto.generationId);
    return this.feedback.save(this.feedback.create({ generationId: dto.generationId, action: dto.action, candidateIndex: dto.candidateIndex ?? null, finalBeads: dto.finalBeads ?? null, note: dto.note || '' }));
  }

  async renderBracelet(dto: RenderAgentBraceletDto) {
    const rows = await this.materials.findByIds([...new Set(dto.beads.map((bead) => bead.materialId))]);
    const map = new Map(rows.map((row) => [row.id, row]));
    const resolved = dto.beads.map((bead) => {
      const material = map.get(bead.materialId);
      if (!material || material.status !== 'published' || !material.isAvailable || !material.specs.some((spec) => spec.specId === bead.specId)) {
        throw new BadRequestException(`素材或规格不可用: ${bead.materialId}/${bead.specId}`);
      }
      return { material, specId: bead.specId };
    });
    const renderId = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previewImage = await this.renderer.render(renderId, 0, resolved);
    const code = this.code.encode({ v: 1, wristCm: dto.wristCm, beads: dto.beads, styleRef: dto.styleRef });
    const totalPrice = resolved.reduce((sum, entry) => sum + (entry.material.specs.find((spec) => spec.specId === entry.specId)?.price || 0), 0);
    return { code, previewImage, totalPrice: Number(totalPrice.toFixed(2)) };
  }
}
