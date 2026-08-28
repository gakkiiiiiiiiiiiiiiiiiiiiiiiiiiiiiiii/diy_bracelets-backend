# DIY Bracelets 后端 API

NestJS 服务，提供材料/分类 CRUD、图片上传、内容管理与设计生成。生产默认使用 PostgreSQL，并通过 TypeORM migration 管理结构。

## 运行要求

- Node.js 24 LTS（见 `.nvmrc`）
- PostgreSQL 16（推荐生产配置）
- 需要过程视频时配置可访问的 H5 渲染页；Docker 镜像已包含 Chromium 与 FFmpeg

## 本地开发（PostgreSQL）

需先有可用的 PostgreSQL（默认连接 `localhost:5432`，用户/库：`postgres` / `diy_bracelets`）。

**方式一：仅用 Docker 起数据库**

```bash
# 只启动 Postgres
docker compose up -d postgres

# 复制环境变量（可选，默认即连本地 postgres）
cp .env.example .env

npm install
npm run start:dev
```

**方式二：本机已安装 PostgreSQL**

创建库并配置 `.env`：

```bash
createdb diy_bracelets   # 或 psql 里 CREATE DATABASE diy_bracelets;
cp .env.example .env    # 按需修改 DB_PASSWORD 等
npm install
npm run start:dev
```

开发环境首次运行会按实体自动建表（`synchronize: true`）；生产环境始终关闭自动同步并执行受版本控制的 migration。

## Docker 部署（PostgreSQL + API）

一键启动数据库与 API：

```bash
cp .env.example .env
# 必须修改 DB_PASSWORD，并把 CORS_ORIGINS 改为真实的前端和管理端 HTTPS Origin
docker compose config --quiet
docker compose up -d --build
```

- API：<http://localhost:3000>
- PostgreSQL：端口 `5432`，数据与上传文件持久化在 volume。

环境变量（可在 `.env` 或 `docker-compose.yml` 中覆盖）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DB_HOST` | localhost | 数据库主机（Docker 内为 postgres） |
| `DB_PORT` | 5432 | 端口 |
| `DB_USERNAME` | postgres | 用户名 |
| `DB_PASSWORD` | postgres | 密码 |
| `DB_DATABASE` | diy_bracelets | 数据库名 |
| `PORT` | 3000 | API 端口 |
| `CORS_ORIGINS` | - | 生产必填，逗号分隔的前端/管理端 Origin，禁止 `*` |
| `TRUST_PROXY` | false | 代理跳数或命名子网；禁止直接配置为 `true` |
| `RATE_LIMIT_TTL_MS` | 60000 | 全局限流窗口（毫秒） |
| `RATE_LIMIT_MAX` | 120 | 单客户端每窗口最大请求数 |
| `OPENAI_API_KEY` | - | 水晶识别、Imagegen 提取与图片参考搭配所需密钥 |
| `OPENAI_VISION_MODEL` | gpt-5-mini | 视觉识别与结构化搭配模型 |
| `OPENAI_IMAGE_MODEL` | gpt-image-2 | 单颗水晶珠提取模型 |
| `OPENAI_EMBEDDING_MODEL` | text-embedding-3-small | 素材视觉语义去重模型 |
| `EXTRACTION_SOURCE_DIR` | ../downloads/douyin-wufang-bracelets/carousel-originals | 已爬取轮播原图目录 |
| `EXTRACTION_OUTPUT_DIR` | ./uploads/extractions | 可追溯提取产物目录 |

## API

- 分类：`GET/POST/PATCH/DELETE /api/categories`
- 材料：`GET/POST/PATCH/DELETE /api/materials`
- 上传：`POST /api/materials/upload`（form-data 字段 `file`）
- 提取任务：`POST /api/admin/extraction-jobs`、`GET /api/admin/extraction-jobs/:id`
- 提取结果：`GET /api/admin/extraction-results`、`POST /api/admin/extraction-results/:id/retry`
- 搭配 Agent：`POST /api/admin/agent/generations`、`GET /api/admin/agent/generations/:id`
- 手串代码：`POST /api/bracelet-code/encode`、`POST /api/bracelet-code/resolve`

未配置 `OPENAI_API_KEY` 时，Imagegen 提取任务会以明确错误结束且不会发布素材；颜色搭配仍可通过本地确定性回退生成三套仅引用已发布素材的方案。

## 生产健康检查

- `GET /health/live`：进程存活，不探测外部依赖
- `GET /health/ready`：检查数据库连接和上传目录读写权限

生产镜像和 Compose 都使用 `/health/ready`。响应同时带有 `X-Request-Id`；API 默认启用 Helmet 安全头、严格 DTO 白名单和全局限流。

## 数据库迁移

生产启动时自动执行 `dist/database/migrations` 中尚未应用的 migration，并记录到 `app_migrations`。禁止在生产开启 `synchronize`。首次基线 migration 会创建缺失表，并可安全接管由旧版开发同步创建的已有表。

## 微信云托管部署

1. 构建：`npm run build`
2. 使用项目根目录 `Dockerfile`，在云托管中配置 `PORT`（如 80）及 `DB_HOST`、`DB_USERNAME`、`DB_PASSWORD`、`DB_DATABASE`（云数据库地址）。
