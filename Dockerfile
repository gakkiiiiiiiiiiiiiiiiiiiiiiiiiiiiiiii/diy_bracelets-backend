# 多阶段构建：与 docker-compose 联用时使用 PostgreSQL；单镜像部署可设 PORT=80（如微信云托管）
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
ENV TZ=Asia/Shanghai
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
RUN mkdir -p uploads data
# 微信云托管默认访问 80 端口，可通过环境变量 PORT 覆盖
EXPOSE 80
ENV PORT=80
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
