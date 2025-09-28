# Digital Mail Letter - Quick Reference Guide

## 🚀 Quick Start
1. Open `DOCUMENTATION_INDEX.html` in your browser for interactive navigation
2. Read `COMPLETE_DOCUMENTATION.md` for detailed technical information
3. Use this file for quick file lookups

## 📁 File Purpose Quick Reference

### Frontend Files
| File | Purpose | Key Functions |
|------|---------|---------------|
| `web/src/App.tsx` | Main application UI | Form handling, template selection, Stripe checkout |
| `web/src/SuccessPage.tsx` | Payment confirmation | Job status polling, tracking display |
| `web/src/main.tsx` | React entry point | App initialization |

### Backend Core Files
| File | Purpose | Key Functions |
|------|---------|---------------|
| `server/src/index.ts` | Main server | API routes, Stripe webhooks, email sending |
| `server/src/worker.ts` | Background processor | Job processing, PDF generation, Lob API calls |
| `server/src/db.ts` | Database layer | Prisma setup, connection handling |
| `server/src/store.ts` | File storage | JSON file read/write for jobs and config |

### Integration Files
| File | Purpose | Key Functions |
|------|---------|---------------|
| `server/src/providers/lob.ts` | Lob API integration | Send letters, address validation |
| `server/src/pdf.ts` | PDF generation | HTML to PDF conversion |
| `server/src/address.ts` | Address utilities | Country codes, validation |

### Configuration Files
| File | Purpose |
|------|---------|
| `Dockerfile` | Container configuration |
| `docker-compose.yml` | Local development setup |
| `railway.json` | Railway deployment config |
| `server/prisma/schema.prisma` | Database schema |
| `RAILWAY_VARIABLES.txt` | Environment variables reference |

### Template Files
| File | Purpose |
|------|---------|
| `server/templates/tpl-default.hbs` | Standard business letter |
| `server/templates/tpl-formal.hbs` | Formal/legal letter |
| `server/templates/tpl-personal.hbs` | Personal correspondence |
| `server/templates/tpl-invoice.hbs` | Invoice/billing template |

## 🔧 Key Commands

### Development
```bash
# Frontend
cd web && npm run dev

# Backend
cd server && npm run dev

# Database
cd server && npx prisma migrate dev
```

### Production
```bash
# Deploy to Railway
railway up --detach

# Check logs
railway logs

# Database migration
railway run npx prisma migrate deploy
```

## 🌐 Important URLs

| URL | Purpose |
|-----|---------|
| `https://digitalmailletter.com/` | Main application |
| `https://digitalmailletter.com/admin` | Admin dashboard |
| `https://digitalmailletter.com/api/health` | Health check |

## 🔑 Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `STRIPE_SECRET_KEY` | Stripe API key | Yes |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | Yes |
| `LOB_API_KEY` | Lob API key | Yes |
| `EMAIL_USER` | Gmail username | Yes |
| `EMAIL_PASS` | Gmail app password | Yes |
| `ADMIN_PASSWORD` | Admin dashboard password | Yes |
| `DATABASE_URL` | PostgreSQL connection | Yes |

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Email timeouts | Check Gmail app password, verify SMTP settings |
| Lob API 422 errors | Verify state codes are 2-character (AL, CA, NY, etc.) |
| Database connection | Check DATABASE_URL, verify Prisma schema |
| Stripe webhook fails | Verify webhook secret, check endpoint URL |
| Jobs not processing | Check Railway logs, verify worker is running |

## 📊 Admin Dashboard Features

- **System Health**: Real-time job statistics
- **Job Management**: View, requeue, delete jobs
- **Error Monitoring**: Failed job details and error messages
- **Authentication**: Password-based login

## 🔄 Job Processing Flow

1. User fills form → Stripe checkout
2. Stripe webhook → Create job
3. Background worker → Process job
4. Generate PDF → Send to Lob API
5. Update status → Send confirmation email
6. User sees success page with tracking

## 📞 Support Resources

- **Railway Logs**: Real-time application monitoring
- **Admin Dashboard**: Job status and error tracking
- **Stripe Dashboard**: Payment monitoring
- **Lob Dashboard**: Mail delivery tracking
