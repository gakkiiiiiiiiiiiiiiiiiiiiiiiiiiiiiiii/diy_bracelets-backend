# 多阶段构建：与 docker-compose 联用时使用 PostgreSQL；单镜像部署可设 PORT=80（如微信云托管）
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
ENV TZ=Asia/Shanghai
WORKDIR /app
RUN apk add --no-cache chromium dumb-init ffmpeg \
    && addgroup -S app \
    && adduser -S app -G app
COPY package*.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force
COPY --from=builder --chown=app:app /app/dist ./dist
RUN mkdir -p uploads data \
    && chown -R app:app /app/uploads /app/data
# 微信云托管默认访问 80 端口，可通过环境变量 PORT 覆盖
EXPOSE 80
ENV PORT=80
ENV NODE_ENV=production
ENV CHROME_PATH=/usr/bin/chromium-browser
ENV FFMPEG_PATH=/usr/bin/ffmpeg
USER app
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||80)+'/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/main.js"]
