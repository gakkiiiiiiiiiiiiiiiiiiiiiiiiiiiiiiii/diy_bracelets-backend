# 生产运行手册

本文定义发布、检查、备份和恢复的最低操作基线。它不会自动创建数据库、对象存储、告警服务或定时任务。

## 发布前闸门

1. 使用 Node.js 24，执行 `npm ci && npm test && npm audit --omit=dev --audit-level=moderate`。
2. 使用独立生产数据库账号，不使用超级用户；限制来源网络，并在跨主机连接时配置 `DB_SSL_MODE=verify-full` 与只读 CA 文件。
3. 确认 `CORS_ORIGINS`、管理账号哈希、微信 AppID/Secret、Cookie 策略和代理跳数均为目标环境值。
4. 将 `UPLOAD_DIR` 挂载到已备份的持久卷，并设置 `UPLOAD_STORAGE_MODE=persistent`；该变量是部署责任确认，不会自动把临时目录变成持久存储。
5. 发布前执行一次手工备份，并记录备份文件、SHA-256、数据库版本和恢复演练日期。
6. 首次运行 migration 时只启动一个 API 实例；确认 migration 和 `/health/ready` 成功后再扩容，避免多个新实例竞争迁移。
7. 过程视频保持 `DESIGN_PROCESS_VIDEO_ENABLED=false`，直到 Chromium、FFmpeg、持久存储和容器可访问的 `VIDEO_WEB_RENDER_URL` 均通过手工小批量验证；渲染页 Origin 必须加入 `CORS_ORIGINS`，前端入口也需单独显式开启。
8. 搭配 Agent 与自动素材提取保持 `BRACELET_AGENT_ENABLED=false`、`AI_EXTRACTION_ENABLED=false`。若专项验收后启用，先确认单次批量、模型请求次数和预算告警，再设置 `AI_TASKS_SINGLE_INSTANCE=true` 并维持恰好一个任务执行实例；启动或重启不会自动重试中断任务。

## 发布与回滚

1. 先部署新镜像，但保持流量切换和自动扩容受控。
2. 查看启动日志，确认 migration 完成且没有循环重启。
3. 执行：`API_BASE=https://api.example.com EXPECTED_ORIGIN=https://admin.example.com npm run smoke:production`。
4. 小批量切流，检查 HTTP 5xx、P95 延迟、数据库连接数和容器重启次数，再完成全量切换。
5. 代码回滚不能盲目执行向下 migration。若新版本已写入新结构，应先停止写流量，评估数据兼容性，再恢复旧镜像或从备份恢复到新数据库。

## 备份

安装与生产 PostgreSQL 主版本兼容的客户端工具后执行：

```bash
mkdir -p ./private-backups
DB_HOST=... DB_USERNAME=... DB_PASSWORD=... DB_DATABASE=... \
  scripts/backup-postgres.sh ./private-backups
```

脚本生成 PostgreSQL custom-format dump 和相邻 SHA-256 文件，权限受 `umask 077` 保护，不会自动删除旧备份。备份仍包含订单和地址个人信息，必须加密存放、限制访问，并按合规保留期人工清理。

不要只验证“备份命令成功”。至少每季度把最新备份恢复到隔离空库，并对表数量、关键订单数量和随机样本做核对。

## 恢复演练

先创建隔离空库，确保目标库名不是当前 `DB_DATABASE`：

```bash
DB_HOST=... DB_USERNAME=... DB_PASSWORD=... DB_DATABASE=production_name \
  scripts/restore-postgres.sh ./private-backups/example.dump \
  --target-db diy_bracelets_restore_test \
  --confirm-target diy_bracelets_restore_test
```

恢复脚本强制校验 SHA-256、目标库名二次确认和空库状态，并拒绝原地覆盖生产库。验证完成后，由数据库平台的受控切换流程决定是否提升恢复库；不要直接修改脚本绕过保护。

## 监控与告警

- 可用性：外部探测 `/health/live` 与 `/health/ready`；连续失败、容器重启或 readiness 超时立即告警。
- API：按结构化 `http_request` 日志聚合状态码、路径和耗时，告警建议从 5xx 比例、P95 延迟与异常请求量开始。
- 数据库：监控连接占用、慢查询、锁等待、存储空间和备份失败。连接池由 `DB_POOL_MAX` 限制。
- 业务：监控待确认/制作中订单积压、发货超时和售后积压，不记录完整手机号或地址到指标标签。
- 成本：任何对象存储、CDN、短信、AI API 或定时任务在启用前单独估算请求量与费用；空闲轮次必须零对象存储请求。

## 已知上线边界

- 当前没有微信支付，订单是客服确认的人工履约单，不能宣传为“已支付订单”。
- 云容器的本地上传目录可能随重启丢失。服务现在会拒绝以 `UPLOAD_STORAGE_MODE=ephemeral` 启动生产模式，但运维仍必须确保 `UPLOAD_DIR` 确实挂载到持久卷。正式启用多实例前还需选择共享存储或对象存储；对象存储属于按量计费资源，需单独审批、预算和请求量设计。
- H5 当前是演示构建，不具备生产用户登录和跨设备交易能力。
- 真实发布仍需微信 AppID/Secret、合法 HTTPS 域名、真机登录及下单验收。
- 过程视频是单进程内队列；虽然已限制每用户一个、全局十个活动任务，但多 API 实例仍会竞争恢复中的任务。未引入分布式租约前，启用该功能时必须保持一个任务执行实例。
- 搭配 Agent 和素材提取也是单进程内队列，默认关闭且不会自动恢复中断任务。它们尚未使用分布式租约；启用时必须保持单任务执行实例，单次素材提取不得超过 30 张，并只允许管理员手动重试失败项。
