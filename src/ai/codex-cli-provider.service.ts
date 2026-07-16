import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { accessSync, constants, existsSync } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { delimiter, isAbsolute, join } from 'path';
import { BraceletCandidateInput, GeneratedBraceletCandidate } from './ai.types';

type JsonSchema = Record<string, unknown>;

@Injectable()
export class CodexCliProviderService {
  private readonly executable: string | null;
  private readonly configuredPath: string;
  private readonly model: string;
  private readonly profile: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.configuredPath = config.get<string>('CODEX_CLI_PATH', 'codex');
    this.executable = this.resolveExecutable(this.configuredPath);
    this.model = config.get<string>('CODEX_CLI_MODEL', '');
    this.profile = config.get<string>('CODEX_CLI_PROFILE', '');
    this.timeoutMs = Math.max(10_000, config.get<number>('CODEX_CLI_TIMEOUT_MS', 180_000));
  }

  get configured(): boolean {
    return Boolean(this.executable);
  }

  status(): { provider: 'codex-cli'; configured: boolean; executable: string; model: string } {
    return {
      provider: 'codex-cli',
      configured: this.configured,
      executable: this.executable || this.configuredPath,
      model: this.model || 'Codex CLI 默认模型',
    };
  }

  private resolveExecutable(value: string): string | null {
    const candidates = isAbsolute(value) || value.includes('/')
      ? [value]
      : (process.env.PATH || '').split(delimiter).filter(Boolean).map((dir) => join(dir, value));
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Continue looking for an executable candidate in PATH.
      }
    }
    return null;
  }

  private async run<T>(prompt: string, schema: JsonSchema, image?: { buffer: Buffer; mime: string }): Promise<T> {
    if (!this.executable) {
      throw new ServiceUnavailableException(`找不到本地 Codex CLI：${this.configuredPath}`);
    }

    const dir = await mkdtemp(join(tmpdir(), 'diy-bracelets-codex-'));
    const schemaPath = join(dir, 'output.schema.json');
    const outputPath = join(dir, 'output.json');
    try {
      await writeFile(schemaPath, JSON.stringify(schema), 'utf8');
      const args = [
        'exec',
        '--ephemeral',
        '--skip-git-repo-check',
        '--sandbox', 'read-only',
        '--color', 'never',
        '--output-schema', schemaPath,
        '--output-last-message', outputPath,
        '-C', dir,
      ];
      if (this.profile) args.push('--profile', this.profile);
      if (this.model) args.push('--model', this.model);
      if (image) {
        const extension = image.mime === 'image/jpeg' ? 'jpg' : image.mime === 'image/webp' ? 'webp' : 'png';
        const imagePath = join(dir, `reference.${extension}`);
        await writeFile(imagePath, image.buffer);
        args.push('--image', imagePath);
      }
      args.push('-');

      await this.execute(args, prompt);
      const raw = (await readFile(outputPath, 'utf8')).trim();
      try {
        return JSON.parse(raw) as T;
      } catch {
        throw new BadGatewayException('Codex CLI 返回的内容不是有效 JSON');
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private execute(args: string[], prompt: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.executable!, args, {
        env: this.cliEnvironment(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stderr = '';
      let settled = false;
      let timedOut = false;
      let killTimer: NodeJS.Timeout | undefined;
      const timeout = setTimeout(() => {
        if (settled) return;
        timedOut = true;
        child.kill('SIGTERM');
        killTimer = setTimeout(() => child.kill('SIGKILL'), 1_000);
      }, this.timeoutMs);

      child.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length < 16_000) stderr += chunk.toString('utf8');
      });
      child.stdout.resume();
      child.on('error', (error) => {
        settled = true;
        clearTimeout(timeout);
        if (killTimer) clearTimeout(killTimer);
        reject(new ServiceUnavailableException(`无法启动 Codex CLI：${error.message}`));
      });
      child.on('close', (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (killTimer) clearTimeout(killTimer);
        if (timedOut || signal) {
          reject(new ServiceUnavailableException(`Codex CLI 调用超时（${this.timeoutMs}ms）`));
          return;
        }
        if (code !== 0) {
          const detail = stderr.trim().split('\n').slice(-6).join('\n');
          reject(new BadGatewayException(detail || `Codex CLI 退出码 ${code}`));
          return;
        }
        resolve();
      });
      child.stdin.on('error', () => undefined);
      child.stdin.end(prompt);
    });
  }

  private cliEnvironment(): NodeJS.ProcessEnv {
    const allowed = [
      'HOME', 'PATH', 'CODEX_HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'TERM',
      'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
    ];
    return Object.fromEntries(allowed.flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []));
  }

  async describeReference(buffer: Buffer, mime: string): Promise<{ colors: string[]; description: string }> {
    const schema: JsonSchema = {
      type: 'object', additionalProperties: false, required: ['colors', 'description'],
      properties: {
        colors: { type: 'array', items: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' }, minItems: 1, maxItems: 6 },
        description: { type: 'string' },
      },
    };
    const prompt = [
      '你是水晶手串搭配分析器。仅分析附带图片，不要调用工具，也不要修改文件。',
      '提取主要配色，并描述适合复现的配色比例、渐变、对称、重复周期、连续色段、尺寸节奏和主珠位置。',
      '颜色必须输出为十六进制值，最终严格按 JSON Schema 返回。',
    ].join('\n');
    return this.run(prompt, schema, { buffer, mime });
  }

  async generateBracelets(input: BraceletCandidateInput): Promise<GeneratedBraceletCandidate[]> {
    const schema: JsonSchema = {
      type: 'object', additionalProperties: false, required: ['candidates'],
      properties: { candidates: { type: 'array', minItems: 3, maxItems: 3, items: {
        type: 'object', additionalProperties: false, required: ['title', 'rationale', 'beads'],
        properties: {
          title: { type: 'string' }, rationale: { type: 'string' }, beads: { type: 'array', minItems: 8, maxItems: 40, items: {
            type: 'object', additionalProperties: false, required: ['materialId', 'specId'],
            properties: { materialId: { type: 'string' }, specId: { type: 'string' } },
          } },
        },
      } } },
    };
    const prompt = [
      '你是水晶圆珠手串搭配师。不要调用工具，也不要修改文件。',
      '只允许使用 inventory 中存在的 materialId 和 specId，不得虚构。',
      '生成三套明显不同但风格统一的有序方案，重视色彩比例、渐变、对称、重复周期、连续色段和珠径节奏。',
      '最终严格按 JSON Schema 返回，不要包含 Markdown。',
      `输入：${JSON.stringify(input)}`,
    ].join('\n');
    const result = await this.run<{ candidates: GeneratedBraceletCandidate[] }>(prompt, schema);
    return result.candidates;
  }
}
