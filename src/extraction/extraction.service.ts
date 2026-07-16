import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { CrystalCandidate } from '../ai/ai.types';
import { ImageAssetsService } from '../ai/image-assets.service';
import { OpenAiProviderService } from '../ai/openai-provider.service';
import { MaterialsService } from '../materials/materials.service';
import { CreateExtractionJobDto } from './dto/create-extraction-job.dto';
import { ExtractionJob, ExtractionJobStatus } from './entities/extraction-job.entity';
import { ExtractionResult } from './entities/extraction-result.entity';

@Injectable()
export class ExtractionService implements OnModuleInit {
  private readonly logger = new Logger(ExtractionService.name);
  private queue: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(ExtractionJob) private readonly jobs: Repository<ExtractionJob>,
    @InjectRepository(ExtractionResult) private readonly results: Repository<ExtractionResult>,
    private readonly ai: OpenAiProviderService,
    private readonly images: ImageAssetsService,
    private readonly materials: MaterialsService,
    private readonly categories: CategoriesService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const unfinished = await this.jobs.find({ where: [
      { status: 'queued' }, { status: 'recognizing' }, { status: 'deduplicating' }, { status: 'extracting' },
      { status: 'removing_background' }, { status: 'validating' }, { status: 'publishing' },
    ] });
    for (const job of unfinished) {
      job.status = 'queued'; job.error = null; await this.jobs.save(job); this.schedule(job.id);
    }
  }

  async create(dto: CreateExtractionJobDto): Promise<ExtractionJob> {
    const sourceRefs = dto.sourceRefs?.filter(Boolean) ?? [];
    if (!sourceRefs.length) throw new BadRequestException('请先上传需要提取的手串图片');
    const job = await this.jobs.save(this.jobs.create({ status: 'queued', sourceRefs, totalSources: sourceRefs.length }));
    this.schedule(job.id);
    return job;
  }

  findOne(id: string): Promise<ExtractionJob | null> { return this.jobs.findOne({ where: { id } }); }

  async listResults(jobId?: string): Promise<ExtractionResult[]> {
    return this.results.find({ where: jobId ? { jobId } : {}, order: { createdAt: 'DESC' }, take: 500 });
  }

  private schedule(jobId: string): void {
    this.queue = this.queue.then(() => this.process(jobId)).catch((error) => this.logger.error(error));
  }

  private async setStatus(job: ExtractionJob, status: ExtractionJobStatus): Promise<void> {
    job.status = status;
    await this.jobs.save(job);
  }

  private errorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
    return String(error);
  }

  private async process(jobId: string): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) return;
    if (!this.ai.configured) {
      job.status = 'failed'; job.error = 'OPENAI_API_KEY 未配置，无法运行 Imagegen 提取'; await this.jobs.save(job); return;
    }
    try {
      for (let index = job.currentIndex; index < job.sourceRefs.length; index += 1) {
        job.currentIndex = index;
        const sourceRef = job.sourceRefs[index];
        try {
          await this.setStatus(job, 'recognizing');
          const loaded = await this.images.load(sourceRef);
          const candidates = await this.ai.detectCrystals(loaded.buffer, loaded.mime);
          for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
            const result = await this.results.save(this.results.create({ jobId, sourceRef, candidateIndex, detection: candidates[candidateIndex], status: 'detected' }));
            await this.processCandidate(job, result, loaded.buffer, loaded.mime);
          }
        } catch (error) {
          job.failedCount += 1;
          this.logger.warn(`提取源图失败 ${sourceRef}: ${this.errorMessage(error)}`);
        }
        job.currentIndex = index + 1;
        await this.recount(job);
      }
      job.status = 'complete'; job.error = null; await this.recount(job);
    } catch (error) {
      job.status = 'failed'; job.error = this.errorMessage(error); await this.jobs.save(job);
    }
  }

  private attributeText(candidate: CrystalCandidate): string {
    return [candidate.label, candidate.crystalFamily, ...candidate.aliases, ...candidate.dominantColors, candidate.transparency, candidate.pattern, candidate.inclusions].filter(Boolean).join(' ');
  }

  private sameAppearance(candidate: CrystalCandidate, material: Awaited<ReturnType<MaterialsService['findOne']>>): boolean {
    const colors = new Set((material.dominantColors || []).map((color) => color.toLowerCase()));
    const colorMatches = candidate.dominantColors.some((color) => colors.has(color.toLowerCase()));
    return colorMatches && candidate.transparency === material.transparency && candidate.pattern === material.pattern;
  }

  private buildPrompt(candidate: CrystalCandidate, keyColor: 'green' | 'magenta'): string {
    const color = keyColor === 'green' ? '#00ff00' : '#ff00ff';
    return [
      'Use case: background-extraction',
      'Asset type: standardized crystal bead material for a bracelet configurator',
      `Primary request: Extract and reconstruct only one representative ${candidate.label} round crystal bead from the input image.`,
      `Target location: normalized bbox x=${candidate.bbox.x}, y=${candidate.bbox.y}, width=${candidate.bbox.width}, height=${candidate.bbox.height}.`,
      `Preserve exactly: ${candidate.dominantColors.join('、')} color, ${candidate.transparency} transparency, ${candidate.pattern} pattern, ${candidate.inclusions} inclusions.`,
      `Scene/backdrop: perfectly flat solid ${color} chroma-key background for background removal.`,
      'Composition: one complete spherical bead, centered, front-facing, generous equal padding, no hole visible.',
      `Constraints: the background must be uniform ${color} with no shadows, gradients, texture, reflections, floor plane, or lighting variation.`,
      `Avoid: adjacent beads, string, metal, pearl, wood, glass imitation, charms, spacers, irregular shapes, text, watermark, cast shadow; do not use ${color} inside the bead.`,
    ].join('\n');
  }

  private async processCandidate(job: ExtractionJob, result: ExtractionResult, sourceBuffer: Buffer, mime: string): Promise<void> {
    const candidate = result.detection;
    result.attempts += 1;
    try {
      await this.setStatus(job, 'deduplicating');
      const crop = await this.images.representativeCrop(sourceBuffer, candidate.bbox);
      result.sourceHash = this.images.sha256(crop);
      result.sourceCrop = this.images.save(job.id, `${result.id}-source.png`, crop).publicPath;
      const cropPHash = await this.images.perceptualHash(crop);
      result.embedding = await this.ai.createEmbedding(this.attributeText(candidate));
      const existingResults = await this.results.find({ where: { sourceHash: result.sourceHash } });
      const exact = existingResults.find((item) => item.id !== result.id && item.materialId);
      if (exact) {
        result.status = 'duplicate'; result.materialId = exact.materialId; result.duplicateOf = exact.materialId; await this.results.save(result); return;
      }
      const published = await this.materials.findPublished();
      const duplicate = published.find((material) => {
        const hash = material.assetBundle?.perceptualHash;
        const visualMatch = this.images.hammingDistance(cropPHash, hash) <= 4;
        const semanticMatch = this.images.cosineSimilarity(result.embedding, material.embedding) >= 0.94 && this.sameAppearance(candidate, material);
        return visualMatch || semanticMatch;
      });
      if (duplicate) {
        const sourceRefs = [...new Set([...(duplicate.sourceRefs || []), result.sourceRef])];
        await this.materials.update(duplicate.id, { sourceRefs });
        result.status = 'merged'; result.materialId = duplicate.id; result.duplicateOf = duplicate.id; await this.results.save(result); return;
      }

      const hasGreen = candidate.dominantColors.some((color) => /绿|green|#0[0-9a-f]{3,5}/i.test(color));
      result.keyColor = hasGreen ? 'magenta' : 'green';
      result.prompt = this.buildPrompt(candidate, result.keyColor);
      await this.setStatus(job, 'extracting');
      let keyBuffer = await this.ai.extractCrystalBead(sourceBuffer, mime, result.prompt);
      await this.setStatus(job, 'removing_background');
      let transparent = await this.images.removeChromaKey(keyBuffer, result.keyColor);
      let validation = await this.images.validateTransparentBead(transparent);
      if (!validation.valid && result.attempts < 2) {
        result.attempts += 1;
        keyBuffer = await this.ai.extractCrystalBead(sourceBuffer, mime, `${result.prompt}\nPrevious output failed validation: ${validation.reasons.join('、')}. Correct only these issues.`);
        transparent = await this.images.removeChromaKey(keyBuffer, result.keyColor);
        validation = await this.images.validateTransparentBead(transparent);
      }
      const baseName = `${result.id}`;
      result.keyImage = this.images.save(job.id, `${baseName}-key.png`, keyBuffer).publicPath;
      if (!validation.valid) throw new Error(`透明素材验证失败: ${validation.reasons.join('、')}`);
      await this.setStatus(job, 'validating');
      result.perceptualHash = await this.images.perceptualHash(transparent);
      result.image = this.images.save(job.id, `${baseName}.png`, transparent).publicPath;
      const postDuplicate = (await this.materials.findPublished()).find((material) =>
        this.images.hammingDistance(result.perceptualHash, material.assetBundle?.perceptualHash) <= 4
        || (this.images.cosineSimilarity(result.embedding, material.embedding) >= 0.94 && this.sameAppearance(candidate, material)),
      );
      if (postDuplicate) {
        const sourceRefs = [...new Set([...(postDuplicate.sourceRefs || []), result.sourceRef])];
        await this.materials.update(postDuplicate.id, { sourceRefs });
        result.status = 'merged'; result.materialId = postDuplicate.id; result.duplicateOf = postDuplicate.id; await this.results.save(result); return;
      }
      await this.setStatus(job, 'publishing');
      result.materialId = await this.publishMaterial(result);
      result.status = 'published'; result.error = null;
      await this.results.save(result);
    } catch (error) {
      result.status = 'failed'; result.error = this.errorMessage(error); await this.results.save(result);
    }
  }

  private slug(value: string): string {
    const ascii = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return ascii || `crystal-${Buffer.from(value).toString('hex').slice(0, 12)}`;
  }

  private async publishMaterial(result: ExtractionResult): Promise<string> {
    const candidate = result.detection;
    const categoryName = candidate.crystalFamily ? `${candidate.crystalFamily}水晶` : '其他水晶珠';
    const categoryId = candidate.crystalFamily ? `crystal-${this.slug(candidate.crystalFamily)}` : 'other-crystals';
    const categoryExists = (await this.categories.findAll()).some((category) => category.id === categoryId);
    if (!categoryExists) await this.categories.create({ id: categoryId, name: categoryName });
    const size = [6, 8, 10, 12, 14].includes(candidate.estimatedSizeMm) ? candidate.estimatedSizeMm : 8;
    const sameCategory = (await this.materials.findAll()).filter((material) => material.categoryId === categoryId);
    const prices = sameCategory.flatMap((material) => material.specs.filter((spec) => spec.size === size).map((spec) => spec.price)).sort((a, b) => a - b);
    const defaults: Record<number, number> = { 6: 1.8, 8: 2.8, 10: 4.2, 12: 6.8, 14: 9.8 };
    const configuredDefault = Number(this.config.get<string>(`DEFAULT_CRYSTAL_PRICE_${size}MM`, String(defaults[size])));
    const price = prices.length ? prices[Math.floor(prices.length / 2)] : configuredDefault;
    const feature = candidate.transparency || candidate.pattern || '天然纹理';
    const name = `${candidate.crystalFamily || `${candidate.dominantColors[0]}水晶珠`}·${feature}`;
    const materialId = `${this.slug(candidate.crystalFamily || candidate.label)}-${result.perceptualHash.slice(0, 8)}`;
    await this.materials.create({
      id: materialId, name, image: result.image, categoryId,
      specs: [{ specId: `${materialId}-${size}mm`, size, price }],
      status: 'published', isAvailable: true, crystalFamily: candidate.crystalFamily,
      aliases: candidate.aliases, dominantColors: candidate.dominantColors,
      transparency: candidate.transparency, pattern: candidate.pattern, inclusions: candidate.inclusions,
      sourceRefs: [result.sourceRef], confidence: candidate.confidence,
      generatedBy: 'imagegen', embedding: result.embedding || undefined,
      assetBundle: { keyImage: result.keyImage, transparentImage: result.image, sourceHash: result.sourceHash, perceptualHash: result.perceptualHash, prompt: result.prompt },
    });
    return materialId;
  }

  private async recount(job: ExtractionJob): Promise<void> {
    const rows = await this.results.find({ where: { jobId: job.id } });
    job.processedCandidates = rows.length;
    job.publishedCount = rows.filter((row) => row.status === 'published').length;
    job.duplicateCount = rows.filter((row) => row.status === 'duplicate' || row.status === 'merged').length;
    job.failedCount = Math.max(job.failedCount, rows.filter((row) => row.status === 'failed').length);
    await this.jobs.save(job);
  }

  async retry(resultId: string): Promise<ExtractionResult> {
    const result = await this.results.findOne({ where: { id: resultId } });
    if (!result) throw new NotFoundException('提取结果不存在');
    const job = await this.jobs.findOne({ where: { id: result.jobId } });
    if (!job) throw new NotFoundException('提取任务不存在');
    result.status = 'detected'; result.error = null; result.attempts = 0; await this.results.save(result);
    this.queue = this.queue.then(async () => {
      const loaded = await this.images.load(result.sourceRef);
      await this.processCandidate(job, result, loaded.buffer, loaded.mime);
      job.status = 'complete'; await this.recount(job);
    });
    return result;
  }
}
