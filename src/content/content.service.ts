import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ADDITIVE_PAGE_DEFAULTS,
  DEFAULT_PAGE_CONFIGS,
  LEGACY_DEFAULT_PAGE_CONFIGS,
  PageContent,
} from './content.defaults';
import { UpdatePageConfigDto } from './dto/update-page-config.dto';
import { PageConfig } from './entities/page-config.entity';

@Injectable()
export class ContentService implements OnApplicationBootstrap {
  private defaultsReady?: Promise<void>;

  constructor(
    @InjectRepository(PageConfig)
    private readonly repository: Repository<PageConfig>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureDefaults();
  }

  async findAll(): Promise<PageConfig[]> {
    await this.ensureDefaults();
    return this.repository.find({ order: { key: 'ASC' } });
  }

  async findOne(key: string): Promise<PageConfig> {
    this.assertValidKey(key);
    await this.ensureDefaults();
    const config = await this.repository.findOne({ where: { key } });
    if (!config) {
      throw new NotFoundException(`Page config ${key} not found`);
    }
    return config;
  }

  async update(key: string, dto: UpdatePageConfigDto): Promise<PageConfig> {
    this.assertValidKey(key);
    await this.ensureDefaults();

    const existing = await this.repository.findOne({ where: { key } });
    const config = existing ?? this.repository.create({
      key,
      name: dto.name?.trim() || key,
      draftContent: {},
      publishedContent: null,
      isPublished: false,
      hasUnpublishedChanges: true,
      publishedAt: null,
    });

    config.name = dto.name?.trim() || config.name;
    config.draftContent = this.cloneContent(dto.content);

    if (dto.publish) {
      config.publishedContent = this.cloneContent(dto.content);
      config.isPublished = true;
      config.hasUnpublishedChanges = false;
      config.publishedAt = new Date().toISOString();
    } else {
      config.hasUnpublishedChanges =
        !config.isPublished ||
        !this.isSameContent(config.draftContent, config.publishedContent);
    }

    return this.repository.save(config);
  }

  async getPublishedContent<T extends object>(
    key: string,
    fallback: T,
  ): Promise<T> {
    await this.ensureDefaults();
    const config = await this.repository.findOne({ where: { key } });
    if (!config?.isPublished || !config.publishedContent) {
      return this.cloneContent(fallback);
    }
    return this.cloneContent(config.publishedContent) as unknown as T;
  }

  private ensureDefaults(): Promise<void> {
    if (!this.defaultsReady) {
      this.defaultsReady = this.createMissingDefaults();
    }
    return this.defaultsReady;
  }

  private async createMissingDefaults(): Promise<void> {
    for (const item of DEFAULT_PAGE_CONFIGS) {
      const existing = await this.repository.findOne({ where: { key: item.key } });
      if (existing) {
        await this.migrateLegacyDefault(existing, item.content);
        await this.addMissingDefaultFields(existing);
        continue;
      }

      const content = this.cloneContent(item.content);
      await this.repository.save(
        this.repository.create({
          key: item.key,
          name: item.name,
          draftContent: content,
          publishedContent: this.cloneContent(content),
          isPublished: true,
          hasUnpublishedChanges: false,
          publishedAt: new Date().toISOString(),
        }),
      );
    }
  }

  private async addMissingDefaultFields(config: PageConfig): Promise<void> {
    const additions = ADDITIVE_PAGE_DEFAULTS[config.key];
    if (!additions) return;

    const draftChanged = this.assignMissingFields(config.draftContent, additions);
    const publishedChanged = config.publishedContent
      ? this.assignMissingFields(config.publishedContent, additions)
      : false;
    if (!draftChanged && !publishedChanged) return;

    config.hasUnpublishedChanges =
      !config.isPublished ||
      !this.isSameContent(config.draftContent, config.publishedContent);
    await this.repository.save(config);
  }

  private assignMissingFields(
    content: PageContent,
    additions: PageContent,
  ): boolean {
    let changed = false;
    for (const [key, value] of Object.entries(additions)) {
      if (content[key] !== undefined) continue;
      content[key] = this.cloneContent(value);
      changed = true;
    }
    return changed;
  }

  private async migrateLegacyDefault(
    config: PageConfig,
    nextDefault: PageContent,
  ): Promise<void> {
    const legacy = LEGACY_DEFAULT_PAGE_CONFIGS.find(
      (item) => item.key === config.key,
    );
    if (!legacy) return;

    let changed = false;
    if (this.isSameContent(config.draftContent, legacy.content)) {
      config.draftContent = this.cloneContent(nextDefault);
      changed = true;
    }
    if (this.isSameContent(config.publishedContent ?? {}, legacy.content)) {
      config.publishedContent = this.cloneContent(nextDefault);
      changed = true;
    }
    if (!changed) return;

    config.hasUnpublishedChanges =
      !config.isPublished ||
      !this.isSameContent(config.draftContent, config.publishedContent);
    await this.repository.save(config);
  }

  private assertValidKey(key: string): void {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(key)) {
      throw new BadRequestException('Invalid page config key');
    }
  }

  private cloneContent<T>(content: T): T {
    return JSON.parse(JSON.stringify(content)) as T;
  }

  private isSameContent(
    first: PageContent,
    second: PageContent | null,
  ): boolean {
    return second !== null && JSON.stringify(first) === JSON.stringify(second);
  }
}
