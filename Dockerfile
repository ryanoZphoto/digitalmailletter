FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install --production=false --silent
WORKDIR /app/server
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
EXPOSE 4000
CMD ["node", "server/dist/index.js"]
