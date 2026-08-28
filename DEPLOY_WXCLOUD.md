# 微信云托管部署指南

将后端 API（NestJS）部署到微信云托管的步骤说明。

## 前置条件

- 已开通 [微信云托管](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloudrun/index.html)
- 小程序/公众号已关联云托管环境
- 已准备 **PostgreSQL 数据库**（云托管不包含数据库，需使用腾讯云 PostgreSQL、云开发数据库或自建并开放公网/内网访问）

## 一、控制台部署（推荐）

### 1. 创建服务

1. 登录 [微信云托管控制台](https://cloud.weixin.qq.com/)
2. 选择对应环境 → **服务列表** → **新建服务**
3. 服务名称可填：`diy-bracelets-api`
4. 开启 **公网访问**（小程序请求需能访问到 API）

### 2. 创建版本（上传代码构建）

1. 进入该服务 → **版本管理** → **新建版本**
2. 选择 **上传文件夹** 或 **从代码库拉取**
3. **上传文件夹** 时，请上传本目录（`backend/`）下的全部内容，确保包含：
   - `Dockerfile`
   - `package.json`、`package-lock.json`
   - `src/`、`nest-cli.json`、`tsconfig.json` 等
   - 不要包含 `node_modules`、`.env`（已通过 `.dockerignore` 排除）
4. **容器端口** 填：`80`（与 Dockerfile 中 `PORT=80` 一致）
5. **CPU / 内存** 按需选择（例如 0.25 核、0.5G 起）
6. 构建方式选择 **Dockerfile 构建**，构建路径为 `.` 或留空
7. 提交构建并等待镜像构建、部署完成

### 3. 配置环境变量

在 **版本配置** 或 **服务配置** 中增加环境变量，必填项示例：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `PORT` | 容器内监听端口（云托管一般固定 80） | `80` |
| `NODE_ENV` | 运行环境 | `production` |
| `DB_HOST` | 数据库主机（腾讯云/自建地址） | 云数据库内网或公网地址 |
| `DB_PORT` | 数据库端口 | `5432` |
| `DB_USERNAME` | 数据库用户名 | 你的用户名 |
| `DB_PASSWORD` | 数据库密码 | 你的密码 |
| `DB_DATABASE` | 数据库名 | `diy_bracelets` |
| `UPLOAD_DIR` | 上传文件目录（仅在服务提供持久卷时使用） | `/app/uploads` |
| `UPLOAD_STORAGE_MODE` | 已确认目录是持久存储；生产必须填写 | `persistent` |
| `CORS_ORIGINS` | 管理端/H5 的明确 HTTPS Origin，禁止 `*` | `https://admin.example.com` |
| `CORS_ALLOW_CREDENTIALS` | 管理端 Cookie 会话必需 | `true` |
| `ADMIN_USERNAME` | 管理账号 | 不使用默认值 |
| `ADMIN_PASSWORD_HASH` | `npm run auth:hash-password` 生成的 scrypt 哈希 | 不填写明文密码 |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 微信登录凭据，必须成对配置 | 仅放服务端 Secret 配置 |
| `DB_SSL_MODE` | 跨主机 PostgreSQL 建议使用 | `verify-full` |
| `DB_SSL_CA_PATH` | 云数据库 CA 的只读挂载路径 | 由数据库平台提供 |
| `DB_SSL_CA` | 无法挂载 CA 文件时使用的 PEM 文本 | 可用 `\n` 表示换行 |

生产环境请勿使用默认密码。数据库优先使用同地域私网与最小权限账号；若跨主机连接，启用证书校验，避免把数据库直接暴露到公网。

### 4. 发布

版本状态为 **正常** 后，先保持单实例和小流量，确认 migration、`/health/ready` 与生产冒烟检查通过，再逐步全量发布和扩容。

### 5. 小程序侧配置

- 将请求域名配置为云托管服务的 **公网域名**（在服务详情中查看）
- 小程序 **开发管理 → 开发设置 → 服务器域名** 中，把该域名加入 **request 合法域名**

---

## 二、CLI 部署（可选）

若已安装 [微信云托管 CLI](https://cloud.weixin.qq.com/cli/features/deployment.html)：

```bash
cd backend
# 登录与关联环境
wxcloud login
wxcloud env:use <环境ID>

# 部署（会读取 wxcloud.config.js，使用当前目录 Dockerfile 构建并发布）
wxcloud deploy
```

CLI 会按 `wxcloud.config.js` 中的 `server.port`（80）和 `dockerfile` 路径进行构建与部署。环境变量仍需在控制台或 CLI 中单独配置。

---

## 三、本地验证 Docker 构建

部署前可在本地确认镜像能正常启动（需已安装 Docker）：

```bash
cd backend
docker build -t diy-bracelets-api .
# 按需传入数据库等环境变量
docker run --rm -p 3008:80 -v diy-bracelets-uploads:/app/uploads \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=5432 \
  -e DB_USERNAME=bracelets \
  -e DB_PASSWORD='<strong-random-password>' \
  -e DB_DATABASE=diy_bracelets \
  -e UPLOAD_STORAGE_MODE=persistent \
  -e CORS_ORIGINS=https://admin.example.com \
  -e CORS_ALLOW_CREDENTIALS=true \
  -e ADMIN_USERNAME=production-admin \
  -e ADMIN_PASSWORD_HASH='<generated-scrypt-hash>' \
  -e WECHAT_APP_ID=wx1234567890abcdef \
  -e WECHAT_APP_SECRET='<32-hex-secret>' \
  diy-bracelets-api
```

启动成功后执行只读冒烟检查：

```bash
API_BASE=http://127.0.0.1:3008 npm run smoke:production
```

---

## 四、注意事项

1. **数据库**：云托管仅运行容器，不提供 PostgreSQL。请使用腾讯云 PostgreSQL、云开发扩展或其它可被云托管访问的数据库，并在环境变量中正确配置。
2. **上传目录**：云容器内 `uploads` 通常是临时目录，重启或扩容后可能丢失/分叉。服务会要求生产环境设置 `UPLOAD_STORAGE_MODE=persistent`，但该声明不能替代真实的持久卷挂载。正式启用上传前必须选择持久卷或对象存储。对象存储属于按量计费资源，需先审批费用与请求架构，禁止用高频逐对象 HEAD 扫描。
3. **migration**：生产启动会自动运行受版本控制的 migration，绝不能临时改成 `development` 或依赖 `synchronize` 建表。首次升级先单实例执行并确认成功，再扩容。
4. **端口**：Dockerfile 中已设置 `PORT=80`，与微信云托管默认容器端口一致，无需在控制台再改监听端口（除非你自定义了端口）。
5. **交易边界**：当前没有微信支付，订单是客服确认后的人工履约流程；支付接入和商户配置完成前不得把提交成功展示为“已支付”。
6. **运行手册**：发布、备份、隔离恢复、监控和回滚步骤见 [`docs/OPERATIONS.md`](./docs/OPERATIONS.md)。
