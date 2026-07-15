import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BraceletCandidateInput, CrystalCandidate, GeneratedBraceletCandidate } from './ai.types';

type JsonObject = Record<string, unknown>;

@Injectable()
export class OpenAiProviderService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly visionModel: string;
  private readonly imageModel: string;
  private readonly agentModel: string;
  private readonly embeddingModel: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('OPENAI_API_KEY', '');
    this.baseUrl = config.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/$/, '');
    this.visionModel = config.get<string>('OPENAI_VISION_MODEL', 'gpt-5-mini');
    this.imageModel = config.get<string>('OPENAI_IMAGE_MODEL', 'gpt-image-2');
    this.agentModel = config.get<string>('OPENAI_AGENT_MODEL', 'gpt-5-mini');
    this.embeddingModel = config.get<string>('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small');
  }

  get configured(): boolean {
    return Boolean(this.apiKey);
  }

  private headers(json = true): Record<string, string> {
    if (!this.apiKey) throw new ServiceUnavailableException('OPENAI_API_KEY 未配置');
    return {
      Authorization: `Bearer ${this.apiKey}`,
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    };
  }

  private async request(path: string, init: RequestInit): Promise<JsonObject> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(180_000),
    });
    const requestId = response.headers.get('x-request-id') || '';
    const body = await response.json().catch(() => ({})) as JsonObject;
    if (!response.ok) {
      const error = body.error as JsonObject | undefined;
      throw new BadGatewayException({
        message: String(error?.message || `OpenAI API ${response.status}`),
        requestId,
        statusCode: response.status,
      });
    }
    return body;
  }

  private outputText(body: JsonObject): string {
    if (typeof body.output_text === 'string') return body.output_text;
    const output = Array.isArray(body.output) ? body.output as JsonObject[] : [];
    for (const item of output) {
      const content = Array.isArray(item.content) ? item.content as JsonObject[] : [];
      for (const part of content) {
        if (part.type === 'output_text' && typeof part.text === 'string') return part.text;
      }
    }
    throw new BadGatewayException('OpenAI 响应缺少结构化文本');
  }

  private async structuredResponse<T>(model: string, prompt: string, schemaName: string, schema: JsonObject, image?: { buffer: Buffer; mime: string }): Promise<T> {
    const content: JsonObject[] = [{ type: 'input_text', text: prompt }];
    if (image) content.push({ type: 'input_image', image_url: `data:${image.mime};base64,${image.buffer.toString('base64')}` });
    const body = await this.request('/responses', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model,
        input: [{ role: 'user', content }],
        text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } },
      }),
    });
    return JSON.parse(this.outputText(body)) as T;
  }

  async detectCrystals(buffer: Buffer, mime: string): Promise<CrystalCandidate[]> {
    const prompt = [
      '识别图片中重复出现的不同水晶圆珠类型，只保留天然或人工水晶材质的圆形珠子。',
      '必须排除金属、珍珠、木珠、菩提、琉璃、塑料、吊坠、隔片、方珠和其他异形件。',
      '同色、同透明度、同纹理的重复实物只返回一次。bbox 使用 0 到 1 的归一化坐标，并框住最清晰的一颗代表珠。',
      '无法确认矿物学名称时使用外观描述；estimatedSizeMm 只能为 6、8、10、12、14，无法判断时为 8。',
    ].join('\n');
    const schema: JsonObject = {
      type: 'object', additionalProperties: false, required: ['candidates'],
      properties: {
        candidates: {
          type: 'array', maxItems: 12, items: {
            type: 'object', additionalProperties: false,
            required: ['label', 'isCrystalRound', 'crystalFamily', 'aliases', 'dominantColors', 'transparency', 'pattern', 'inclusions', 'estimatedSizeMm', 'bbox', 'confidence'],
            properties: {
              label: { type: 'string' }, isCrystalRound: { type: 'boolean' }, crystalFamily: { type: 'string' },
              aliases: { type: 'array', items: { type: 'string' } }, dominantColors: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
              transparency: { type: 'string' }, pattern: { type: 'string' }, inclusions: { type: 'string' },
              estimatedSizeMm: { type: 'number', enum: [6, 8, 10, 12, 14] },
              bbox: { type: 'object', additionalProperties: false, required: ['x', 'y', 'width', 'height'], properties: { x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' } } },
              confidence: {
                type: 'object', additionalProperties: false,
                required: ['overall', 'category', 'size', 'color', 'bbox'],
                properties: { overall: { type: 'number' }, category: { type: 'number' }, size: { type: 'number' }, color: { type: 'number' }, bbox: { type: 'number' } },
              },
            },
          },
        },
      },
    };
    const result = await this.structuredResponse<{ candidates: CrystalCandidate[] }>(this.visionModel, prompt, 'crystal_candidates', schema, { buffer, mime });
    return result.candidates.filter((candidate) => candidate.isCrystalRound);
  }

  async extractCrystalBead(buffer: Buffer, mime: string, prompt: string): Promise<Buffer> {
    this.headers(false);
    const form = new FormData();
    form.append('model', this.imageModel);
    const bytes = new Uint8Array(buffer.byteLength);
    bytes.set(buffer);
    form.append('image[]', new Blob([bytes], { type: mime }), `bracelet.${mime.split('/')[1] || 'png'}`);
    form.append('prompt', prompt);
    form.append('size', '1024x1024');
    form.append('quality', 'high');
    form.append('output_format', 'png');
    const body = await this.request('/images/edits', { method: 'POST', headers: this.headers(false), body: form });
    const data = Array.isArray(body.data) ? body.data as JsonObject[] : [];
    const encoded = data[0]?.b64_json;
    if (typeof encoded !== 'string') throw new BadGatewayException('Imagegen 响应缺少图片');
    return Buffer.from(encoded, 'base64');
  }

  async createEmbedding(text: string): Promise<number[]> {
    const body = await this.request('/embeddings', {
      method: 'POST', headers: this.headers(), body: JSON.stringify({ model: this.embeddingModel, input: text }),
    });
    const data = Array.isArray(body.data) ? body.data as JsonObject[] : [];
    return Array.isArray(data[0]?.embedding) ? data[0].embedding as number[] : [];
  }

  async describeReference(buffer: Buffer, mime: string): Promise<{ colors: string[]; description: string }> {
    const schema: JsonObject = {
      type: 'object', additionalProperties: false, required: ['colors', 'description'],
      properties: { colors: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 6 }, description: { type: 'string' } },
    };
    return this.structuredResponse(this.visionModel, '提取这张参考图的主要配色和适合水晶手串搭配的节奏描述。颜色使用十六进制值。', 'bracelet_reference', schema, { buffer, mime });
  }

  async generateBracelets(input: BraceletCandidateInput): Promise<GeneratedBraceletCandidate[]> {
    const schema: JsonObject = {
      type: 'object', additionalProperties: false, required: ['candidates'],
      properties: { candidates: { type: 'array', minItems: 3, maxItems: 3, items: {
        type: 'object', additionalProperties: false, required: ['title', 'rationale', 'beads'],
        properties: { title: { type: 'string' }, rationale: { type: 'string' }, beads: { type: 'array', minItems: 8, maxItems: 40, items: {
          type: 'object', additionalProperties: false, required: ['materialId', 'specId'], properties: { materialId: { type: 'string' }, specId: { type: 'string' } },
        } } },
      } } },
    };
    const prompt = [
      '你是水晶圆珠手串搭配师。只允许使用 inventory 中存在的 materialId 和 specId，不得虚构。',
      '生成三套明显不同但风格统一的有序方案。重视色彩比例、渐变、对称、重复周期、连续色段和珠径节奏。',
      `输入：${JSON.stringify(input)}`,
    ].join('\n');
    const result = await this.structuredResponse<{ candidates: GeneratedBraceletCandidate[] }>(this.agentModel, prompt, 'bracelet_candidates', schema);
    return result.candidates;
  }
}
