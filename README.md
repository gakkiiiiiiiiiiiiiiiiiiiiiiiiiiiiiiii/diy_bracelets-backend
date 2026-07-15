# DIY Bracelets 后端 API

NestJS 服务，提供材料/分类 CRUD 与图片上传。**本地开发与生产均使用 PostgreSQL**。

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

首次运行会按实体自动建表（`synchronize: true`）。

## Docker 部署（PostgreSQL + API）

一键启动数据库与 API：

```bash
cp .env.example .env   # 可选，改 DB_PASSWORD 等
docker compose up -d
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

## 微信云托管部署

1. 构建：`npm run build`
2. 使用项目根目录 `Dockerfile`，在云托管中配置 `PORT`（如 80）及 `DB_HOST`、`DB_USERNAME`、`DB_PASSWORD`、`DB_DATABASE`（云数据库地址）。
