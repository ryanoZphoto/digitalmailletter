# Local Postgres for development

This project uses Postgres in production. For local development you can run Postgres with Docker Compose and then run Prisma migrations.

Start Postgres (requires Docker Desktop / Docker Engine):

```powershell
cd server
docker-compose up -d
```

Set the `DATABASE_URL` environment variable (the `.env` file in `server/` contains an example):

```
postgresql://postgres:password@localhost:5432/mail_my_forms
```

Run Prisma migrate & generate:

```powershell
cd server
npx prisma migrate dev --name init
npx prisma generate
```

If you prefer not to use Docker, you can point `DATABASE_URL` to any hosted Postgres instance.
