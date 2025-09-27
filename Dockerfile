FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install --silent
WORKDIR /app/server
RUN npm install --silent

# Copy source code and build
WORKDIR /app
COPY . .
WORKDIR /app/server
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Copy built application
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/templates ./server/templates
COPY --from=builder /app/server/prisma ./server/prisma

# Install production dependencies
WORKDIR /app/server
RUN npm install --production --silent

EXPOSE 4000
CMD ["node", "dist/index.js"]
