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
| `UPLOAD_DIR` | 上传文件目录（可选，默认 `./uploads`） | `/app/uploads` |

生产环境请勿使用默认密码，并确保数据库允许云托管所在 VPC/公网访问。

### 4. 发布

版本状态为 **正常** 后，在 **版本管理** 中对该版本做 **全量发布**，即可通过服务提供的公网/内网地址访问 API。

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
docker run --rm -p 3008:80 \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=5432 \
  -e DB_USERNAME=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_DATABASE=diy_bracelets \
  diy-bracelets-api
```

浏览器访问 `http://localhost:3008/api/...` 验证接口。

---

## 四、注意事项

1. **数据库**：云托管仅运行容器，不提供 PostgreSQL。请使用腾讯云 PostgreSQL、云开发扩展或其它可被云托管访问的数据库，并在环境变量中正确配置。
2. **上传目录**：容器内 `uploads` 为临时目录，重启后丢失。若需持久化文件，请使用对象存储（如 COS）并在代码中改为上传到 COS。
3. **synchronize**：当前在 `NODE_ENV !== 'production'` 时会开启 TypeORM `synchronize`；生产环境为 `production` 时不会自动建表，请自行执行迁移或建表。
4. **端口**：Dockerfile 中已设置 `PORT=80`，与微信云托管默认容器端口一致，无需在控制台再改监听端口（除非你自定义了端口）。
5. **首次建表**：生产环境 `NODE_ENV=production` 时 TypeORM 不会自动建表。可选：首次部署时临时将 `NODE_ENV` 设为 `development` 让表自动创建（仅限空库），或使用 TypeORM 迁移脚本建表后再改回 `production`。
