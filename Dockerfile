FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache openssl

# Install Chrome and dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Puppeteer to use installed Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

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

# Install runtime dependencies for Prisma and Puppeteer
RUN apk add --no-cache openssl chromium nss freetype harfbuzz ca-certificates ttf-freefont

# Set Puppeteer to use installed Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

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
