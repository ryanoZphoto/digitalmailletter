# Mail My Forms — Scaffold

This repository contains an opinionated, production-minded scaffold for the Mail My Forms project.

What's included
- TypeScript Node.js backend (Express)
- Prisma + PostgreSQL schema
- React + Vite frontend scaffold
- Docker Compose for local development

Quick start (requires Docker)

```pwsh
cd "c:\Users\ryano\OneDrive\Desktop\edie\sites\mail-my-forms"
docker compose up --build
```

Server will be at http://localhost:4000 and web at http://localhost:3001

Next steps
- Install dependencies inside `server` and `web` using pnpm or npm.
- Run `pnpm prisma migrate dev` inside `server` to create DB schema.
- Implement full API validation, authentication, PDF generation, payment, and mail provider integration.
