/**
 * 微信云托管 CLI 部署配置（wxcloud deploy）
 * 文档：https://cloud.weixin.qq.com/cli/features/config.html
 */
module.exports = {
  type: 'run',
  server: {
    dockerfile: 'Dockerfile',
    port: 80,
    buildDir: '.',
  },
}
