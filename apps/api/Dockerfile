FROM node:24-bookworm-slim
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost/build npm run db:generate && npm run build && npx playwright install --with-deps chromium
ENV NODE_ENV=production
ENV SERVE_WEB=true
WORKDIR /app/apps/api
USER node
CMD ["node","dist/server.js"]
