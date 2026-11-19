FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=6001

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node index.js ./
COPY --chown=node:node src ./src

USER node

EXPOSE 6001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:6001/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "index.js"]
