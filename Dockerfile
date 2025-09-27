FROM node:20-alpine AS builder
WORKDIR /app

# Copy server package files and install dependencies
COPY server/package*.json ./
RUN npm install --silent

# Copy source code and build
COPY server/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/prisma ./prisma

# Create start script
RUN echo 'const { spawn } = require("child_process"); \
console.log("🚀 Starting Digital Mail Letter server..."); \
console.log("📂 Working directory:", process.cwd()); \
console.log("🌍 Environment:", process.env.NODE_ENV || "development"); \
console.log("🔗 Database URL:", process.env.DATABASE_URL ? "Set ✅" : "Missing ❌"); \
console.log("🚪 Port:", process.env.PORT || 4000); \
const server = spawn("node", ["dist/index.js"], { stdio: "inherit", env: process.env }); \
server.on("error", (err) => { console.error("❌ Failed to start server:", err); process.exit(1); }); \
server.on("exit", (code) => { console.log(`🔄 Server exited with code ${code}`); process.exit(code); });' > start.js

# Install production dependencies
RUN npm install --production --silent

EXPOSE 4000
CMD ["node", "start.js"]
