FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache openssl1.1-libs

# Build server
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --silent
COPY server/ ./
RUN npm run build

# Build web (React app)
WORKDIR /app
COPY web/package*.json ./web/
WORKDIR /app/web
RUN npm install --silent
COPY web/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Install runtime dependencies for Prisma
RUN apk add --no-cache openssl1.1-libs

# Copy built application
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/package.json ./package.json
COPY --from=builder /app/server/templates ./templates
COPY --from=builder /app/server/prisma ./prisma
COPY --from=builder /app/web/dist ./public

# Install production dependencies
RUN npm install --production --silent

EXPOSE 8080
CMD ["node", "dist/index.js"]
