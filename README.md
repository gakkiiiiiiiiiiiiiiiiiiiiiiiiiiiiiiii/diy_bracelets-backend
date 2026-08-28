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
# 必须修改 DB_PASSWORD、CORS_ORIGINS，并配置管理端账号和密码哈希
# 安全读取密码并生成哈希（密码不会写入 shell 历史）：
read -s "ADMIN_PASSWORD?Admin password: "
printf %s "$ADMIN_PASSWORD" | npm run --silent auth:hash-password
# 将输出写入 .env 的 ADMIN_PASSWORD_HASH，然后清除临时变量：unset ADMIN_PASSWORD
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
| `DB_POOL_MAX` | 10 | 单实例数据库连接池上限；按数据库总连接预算分配 |
| `DB_CONNECTION_TIMEOUT_MS` | 5000 | 建立数据库连接的超时 |
| `DB_STATEMENT_TIMEOUT_MS` | 15000 | PostgreSQL 查询与空闲事务超时 |
| `DB_SSL_MODE` | disable | PostgreSQL TLS：`disable`、`require` 或 `verify-full` |
| `DB_SSL_CA_PATH` | - | `verify-full` 时必填的只读 CA 证书路径 |
| `DB_SSL_CA` | - | 无法挂载文件时使用的 PEM CA 文本，可用 `\n` 表示换行 |
| `PORT` | 3000 | API 端口 |
| `CORS_ORIGINS` | - | 生产必填，逗号分隔的前端/管理端 Origin，禁止 `*` |
| `CORS_ALLOW_CREDENTIALS` | true | 生产必须开启，用于管理端 HttpOnly 会话 Cookie |
| `TRUST_PROXY` | false | 代理跳数或命名子网；禁止直接配置为 `true` |
| `RATE_LIMIT_TTL_MS` | 60000 | 全局限流窗口（毫秒） |
| `RATE_LIMIT_MAX` | 120 | 单客户端每窗口最大请求数 |
| `ADMIN_USERNAME` | - | 生产必填，管理端登录账号 |
| `ADMIN_PASSWORD_HASH` | - | 生产必填，由 `npm run auth:hash-password` 生成的 scrypt 哈希 |
| `ADMIN_SESSION_TTL_SECONDS` | 28800 | 管理端可撤销会话有效期 |
| `ADMIN_COOKIE_SAME_SITE` | strict | 管理端 Cookie 的 SameSite 策略；跨站部署才改为 `none` |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | - | 微信小程序登录配置，必须成对配置且仅保存在后端 |
| `USER_SESSION_TTL_SECONDS` | 2592000 | 微信用户自定义登录态有效期 |
| `OPENAI_API_KEY` | - | 水晶识别、Imagegen 提取与图片参考搭配所需密钥 |
| `OPENAI_VISION_MODEL` | gpt-5-mini | 视觉识别与结构化搭配模型 |
| `OPENAI_IMAGE_MODEL` | gpt-image-2 | 单颗水晶珠提取模型 |
| `OPENAI_EMBEDDING_MODEL` | text-embedding-3-small | 素材视觉语义去重模型 |
| `EXTRACTION_SOURCE_DIR` | ../downloads/douyin-wufang-bracelets/carousel-originals | 已爬取轮播原图目录 |
| `EXTRACTION_OUTPUT_DIR` | ./uploads/extractions | 可追溯提取产物目录 |

## 认证与权限

- 管理端：`POST /api/admin/auth/login` 校验账号密码后设置 `HttpOnly + Secure + __Host-` 会话 Cookie；所有写接口和 `/api/admin/**` 均要求管理会话，Cookie 写请求还必须携带登录响应中的 `X-CSRF-Token`。
- 微信端：小程序通过 `wx.login` 取得一次性 code，提交到 `POST /api/auth/wechat`；后端调用微信 `code2Session`，只返回本系统可撤销会话，不会向客户端下发 `session_key` 或 OpenID。
- 用户资源：`/api/my-designs` 与过程视频任务按当前用户 ID 查询；跨用户访问返回 404。
- 默认策略：未显式声明为公开或用户接口的新路由自动按管理端权限保护，避免新增接口漏加鉴权。

## API

- 公开分类：`GET /api/categories`；分类写操作仍使用 `/api/categories`，需管理会话
- 公开材料：`GET /api/materials`（仅已发布且可用）
- 管理材料：`GET/POST/PATCH/DELETE /api/admin/materials`
- 上传：`POST /api/admin/materials/upload`（form-data 字段 `file`）
- 公开内容：`GET /api/content/:key`（不返回草稿）；草稿管理：`/api/admin/content`
- 提取任务：`POST /api/admin/extraction-jobs`、`GET /api/admin/extraction-jobs/:id`
- 提取结果：`GET /api/admin/extraction-results`、`POST /api/admin/extraction-results/:id/retry`
- 搭配 Agent：`POST /api/admin/agent/generations`、`GET /api/admin/agent/generations/:id`
- 手串代码：`POST /api/bracelet-code/encode`、`POST /api/bracelet-code/resolve`
- 用户购物车：`GET/PUT /api/cart`；服务端按商品目录或已发布材料重新计价，单行最多 99 件
- 用户地址：`GET/POST/PATCH/DELETE /api/addresses`；仅允许访问当前用户数据，并保证至多一个默认地址
- 用户订单：`GET/POST /api/orders`、订单详情、提醒发货、确认收货与申请售后
- 管理订单：`GET /api/admin/orders`、`PATCH /api/admin/orders/:id/status`；发货必须提供承运方和物流单号

下单使用用户级幂等键防止重复订单，并在同一数据库事务中保存价格/地址/商品快照、移除已结算购物车项目。客户端提交的价格、名称和金额不会作为结算依据。当前订单是“客服确认后制作”的人工履约流程，不包含在线支付；接入微信支付前不得在客户端展示“已付款”。

订单地址快照包含个人信息。生产数据库、备份和运维账号必须启用静态加密、最小权限与访问审计，日志不得输出完整地址、手机号、会话令牌或微信凭据。

未配置 `OPENAI_API_KEY` 时，Imagegen 提取任务会以明确错误结束且不会发布素材；颜色搭配仍可通过本地确定性回退生成三套仅引用已发布素材的方案。

## 生产健康检查

- `GET /health/live`：进程存活，不探测外部依赖
- `GET /health/ready`：检查数据库连接和上传目录读写权限

生产镜像和 Compose 都使用 `/health/ready`。响应同时带有 `X-Request-Id`；API 默认启用 Helmet 安全头、严格 DTO 白名单和全局限流。

非健康检查请求会输出不含查询参数和个人信息的结构化 `http_request` 日志，包含 requestId、方法、路径、状态码和耗时，便于聚合 5xx 与延迟指标。

## 数据库迁移

生产启动时自动执行 `dist/database/migrations` 中尚未应用的 migration，并记录到 `app_migrations`。禁止在生产开启 `synchronize`。首次基线 migration 会创建缺失表，并可安全接管由旧版开发同步创建的已有表。

多实例首次发布时先只启动一个实例完成 migration，确认 readiness 后再扩容。备份、隔离恢复演练、发布冒烟、监控与回滚步骤见 [生产运行手册](./docs/OPERATIONS.md)。

## 微信云托管部署

1. 构建：`npm run build`
2. 使用项目根目录 `Dockerfile`，在云托管中配置 `PORT`（如 80）及 `DB_HOST`、`DB_USERNAME`、`DB_PASSWORD`、`DB_DATABASE`（云数据库地址）。
