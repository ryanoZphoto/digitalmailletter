# Digital Mail Letter - Complete Technical Documentation

## 📋 Table of Contents

- [🏗️ Project Overview](#project-overview)
- [📁 File Structure](#file-structure)
- [🔧 Core Components](#core-components)
- [🌐 Frontend (React)](#frontend-react)
- [⚙️ Backend (Node.js/Express)](#backend-nodejsexpress)
- [🗄️ Database & Storage](#database--storage)
- [📧 Email System](#email-system)
- [💳 Payment Integration](#payment-integration)
- [📮 Mail Service (Lob API)](#mail-service-lob-api)
- [🐳 Deployment](#deployment)
- [🔍 API Endpoints](#api-endpoints)
- [📊 Admin Dashboard](#admin-dashboard)
- [🚀 Getting Started](#getting-started)
- [🛠️ Development Workflow](#development-workflow)
- [🐛 Troubleshooting](#troubleshooting)

---

## 🏗️ Project Overview

**Digital Mail Letter** is a full-stack web application that allows users to send physical letters through a digital interface. Users fill out a form, pay via Stripe, and the system automatically prints and mails their letters using the Lob API.

### Key Features:
- 📝 Professional letter templates
- 💳 Stripe payment integration
- 📧 Email confirmations and tracking
- 🖨️ Automatic printing and mailing via Lob API
- 📊 Admin dashboard for monitoring
- 🔄 Real-time job processing

---

## 📁 File Structure

```
mail-my-forms/
├── 📁 web/                          # React Frontend
│   ├── src/
│   │   ├── App.tsx                  # Main application component
│   │   ├── SuccessPage.tsx          # Payment success page
│   │   └── main.tsx                 # React entry point
│   ├── dist/                        # Built frontend files
│   └── package.json                 # Frontend dependencies
├── 📁 server/                       # Node.js Backend
│   ├── src/
│   │   ├── index.ts                 # Main server file
│   │   ├── db.ts                    # Database configuration
│   │   ├── worker.ts                # Background job processor
│   │   ├── pdf.ts                   # PDF generation
│   │   ├── address.ts               # Address validation
│   │   ├── store.ts                 # File-based storage
│   │   └── providers/
│   │       └── lob.ts               # Lob API integration
│   ├── templates/                   # Letter templates
│   ├── prisma/                      # Database schema
│   └── data/                        # File storage
├── 📁 Dockerfile                    # Container configuration
├── 📁 docker-compose.yml            # Local development
└── 📁 railway.json                  # Railway deployment config
```

---

## 🔧 Core Components

### 1. **Frontend (React)**
- **Location**: `web/src/`
- **Purpose**: User interface for letter creation
- **Key Files**:
  - `App.tsx` - Main form and template selection
  - `SuccessPage.tsx` - Payment confirmation and tracking

### 2. **Backend (Node.js/Express)**
- **Location**: `server/src/`
- **Purpose**: API server, payment processing, job management
- **Key Files**:
  - `index.ts` - Main server with all API routes
  - `worker.ts` - Background job processor
  - `db.ts` - Database connection and Prisma setup

### 3. **Mail Service Integration**
- **Location**: `server/src/providers/lob.ts`
- **Purpose**: Integration with Lob API for physical mail
- **Features**: PDF generation, address validation, tracking

---

## 🌐 Frontend (React)

### Main Application (`web/src/App.tsx`)

**Purpose**: Main user interface for creating and sending letters

**Key Features**:
- Template selection with live preview
- Sender and recipient address forms with validation
- Message composition
- Stripe payment integration
- Form validation and error handling

**State Management**:
```typescript
// Form data states
const [senderName, setSenderName] = useState('');
const [recipientName, setRecipientName] = useState('');
const [messageContent, setMessageContent] = useState('');
const [customerEmail, setCustomerEmail] = useState('');

// UI states
const [isSubmitting, setIsSubmitting] = useState(false);
const [showPreview, setShowPreview] = useState(false);
```

**Key Functions**:
- `submit()` - Handles form submission and Stripe checkout
- `fillDemoData()` - Populates form with sample data
- `openPreview()` - Shows template preview modal

### Success Page (`web/src/SuccessPage.tsx`)

**Purpose**: Displays confirmation after successful payment

**Key Features**:
- Real-time job status polling
- Dynamic status display (processing, completed, failed)
- Tracking information display
- Email confirmation details

**Polling Logic**:
```typescript
const startPolling = (sessionId: string) => {
  const pollInterval = setInterval(async () => {
    // Fetch job updates every 5 seconds
    const response = await fetch(`/api/jobs/by-session/${sessionId}`);
    // Update UI with latest status
  }, 5000);
};
```

---

## ⚙️ Backend (Node.js/Express)

### Main Server (`server/src/index.ts`)

**Purpose**: Central API server handling all requests

**Key Sections**:

#### 1. **Server Setup**
```typescript
const app = express();
app.use(cors(CORS_OPTIONS));
app.use(bodyParser.json({ limit: '2mb' }));
```

#### 2. **Stripe Integration**
- Checkout session creation (`/api/checkout`)
- Webhook handling (`/api/stripe/webhook`)
- Payment processing and job creation

#### 3. **API Routes**
- `/api/health` - Health check
- `/api/jobs` - Job management
- `/api/templates/*` - Template previews
- `/api/admin/*` - Admin dashboard

#### 4. **Email System**
```typescript
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});
```

### Background Worker (`server/src/worker.ts`)

**Purpose**: Processes letter jobs in the background

**Key Functions**:
- `processJobFromFile()` - Processes individual jobs
- `htmlToPdfBuffer()` - Converts HTML to PDF
- `sendLetterPDF()` - Sends letters via Lob API

**Job Processing Flow**:
1. Read job from file/database
2. Generate PDF from template
3. Send to Lob API
4. Update job status
5. Send confirmation email

### Database Layer (`server/src/db.ts`)

**Purpose**: Database connection and Prisma setup

**Features**:
- Conditional Prisma import (prevents crashes if DB unavailable)
- File storage fallback
- Connection health checking

---

## 🗄️ Database & Storage

### Prisma Schema (`server/prisma/schema.prisma`)

**Purpose**: Database schema definition

**Key Models**:
```prisma
model Job {
  id            String   @id @default(cuid())
  templateId    String?
  body          String?
  sender        Json
  recipient     Json
  service       String?
  options       Json?
  status        String
  tracking      Json?
  stripeSessionId String?
  customerEmail String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### File Storage (`server/src/store.ts`)

**Purpose**: Fallback storage when database unavailable

**Functions**:
- `readJobs()` - Read jobs from JSON file
- `writeJobs()` - Write jobs to JSON file
- `readConfig()` - Read configuration
- `writeConfig()` - Write configuration

---

## 📧 Email System

### Configuration
```typescript
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  connectionTimeout: 30000,
  greetingTimeout: 15000,
  socketTimeout: 30000
});
```

### Email Templates
- **Receipt Email**: Sent after successful payment
- **Tracking Updates**: Sent when job status changes
- **Error Notifications**: Sent to admin on failures

### Email Content
- Professional HTML templates
- Job details and tracking information
- Sender/recipient information
- Delivery timeline

---

## 💳 Payment Integration

### Stripe Checkout (`/api/checkout`)

**Process**:
1. Validate form data
2. Create Stripe checkout session
3. Include job data in metadata
4. Return checkout URL

**Configuration**:
```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: { name: 'Physical Letter' },
      unit_amount: 250 // $2.50
    },
    quantity: 1
  }],
  success_url: `${req.protocol}://${req.get('host')}?success=1&session_id={CHECKOUT_SESSION_ID}`,
  metadata: { payload: JSON.stringify(payload) }
});
```

### Webhook Handler (`/api/stripe/webhook`)

**Process**:
1. Verify webhook signature
2. Parse job data from metadata
3. Create job record
4. Trigger immediate processing
5. Send confirmation email

---

## 📮 Mail Service (Lob API)

### Integration (`server/src/providers/lob.ts`)

**Purpose**: Send physical letters via Lob API

**Key Functions**:
- `sendLetterPDF()` - Main function to send letters
- Address normalization and validation
- PDF attachment handling
- Error handling and retry logic

**API Configuration**:
```typescript
const form = new FormData();
form.append('to[name]', to.name);
form.append('to[address_line1]', to.address_line1);
// ... other address fields
form.append('use_type', 'operational'); // Required by Lob
form.append('file', pdfBuffer, { filename: 'letter.pdf' });
```

### PDF Generation (`server/src/pdf.ts`)

**Purpose**: Convert HTML templates to PDF

**Features**:
- Custom PDF generation (no Puppeteer dependency)
- Template rendering with Handlebars
- Fallback mechanisms for reliability

---

## 🐳 Deployment

### Docker Configuration

**Main Dockerfile**:
```dockerfile
FROM node:20-alpine AS builder
# Build server and web
FROM node:20-alpine
# Runtime configuration
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

### Railway Deployment

**Configuration** (`railway.json`):
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Environment Variables

**Required Variables**:
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Webhook verification
- `LOB_API_KEY` - Lob API key
- `EMAIL_USER` - Gmail username
- `EMAIL_PASS` - Gmail app password
- `ADMIN_PASSWORD` - Admin dashboard password
- `DATABASE_URL` - PostgreSQL connection string

---

## 🔍 API Endpoints

### Public Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Main application |
| `/api/health` | GET | Health check |
| `/api/checkout` | POST | Create Stripe session |
| `/api/jobs/by-session/:id` | GET | Get job by session ID |
| `/api/templates/:id/preview` | GET/POST | Template preview |

### Admin Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin` | GET | Admin dashboard |
| `/api/admin/login` | POST | Admin authentication |
| `/api/admin/jobs` | GET | List all jobs |
| `/api/admin/health` | GET | System health stats |
| `/api/admin/errors` | GET | Error monitoring |

---

## 📊 Admin Dashboard

### Features
- **System Health**: Real-time statistics
- **Job Management**: View, requeue, delete jobs
- **Error Monitoring**: Failed job details
- **Authentication**: Password-based login

### Access
- URL: `https://yourdomain.com/admin`
- Password: Set via `ADMIN_PASSWORD` environment variable

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Docker (optional)
- Railway account (for deployment)
- Stripe account
- Lob account
- Gmail account (for emails)

### Local Development

1. **Clone and Install**:
```bash
git clone <repository>
cd mail-my-forms
npm install
```

2. **Environment Setup**:
```bash
cp server/.env.example server/.env
# Edit .env with your API keys
```

3. **Database Setup**:
```bash
cd server
npx prisma migrate dev
npx prisma generate
```

4. **Start Development**:
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd web
npm run dev
```

### Production Deployment

1. **Railway Setup**:
```bash
railway login
railway init
railway add postgresql
```

2. **Environment Variables**:
```bash
railway variables set STRIPE_SECRET_KEY=sk_live_...
railway variables set LOB_API_KEY=live_...
# ... set all required variables
```

3. **Deploy**:
```bash
railway up --detach
```

---

## 🛠️ Development Workflow

### Making Changes

1. **Frontend Changes**:
   - Edit files in `web/src/`
   - Run `npm run build` in `web/`
   - Deploy with `railway up`

2. **Backend Changes**:
   - Edit files in `server/src/`
   - Run `npm run build` in `server/`
   - Deploy with `railway up`

3. **Database Changes**:
   - Edit `server/prisma/schema.prisma`
   - Run `npx prisma migrate dev`
   - Deploy migration with `railway run npx prisma migrate deploy`

### Testing

1. **Local Testing**:
   - Use Stripe test mode
   - Use Lob test mode
   - Check logs in Railway dashboard

2. **Production Testing**:
   - Use small test amounts
   - Monitor admin dashboard
   - Check email delivery

---

## 🐛 Troubleshooting

### Common Issues

1. **Email Timeouts**:
   - Check Gmail app password
   - Verify SMTP settings
   - Check Railway logs

2. **Lob API Errors**:
   - Verify API key
   - Check address format
   - Ensure PDF generation works

3. **Database Connection**:
   - Check `DATABASE_URL`
   - Verify Prisma schema
   - Check Railway PostgreSQL status

4. **Stripe Webhook Issues**:
   - Verify webhook secret
   - Check endpoint URL
   - Monitor webhook logs

### Debugging Tools

- **Railway Logs**: Real-time application logs
- **Admin Dashboard**: Job status and errors
- **Browser DevTools**: Frontend debugging
- **Stripe Dashboard**: Payment monitoring

---

## 📞 Support

For technical support or questions:
- Check Railway logs first
- Use admin dashboard for job monitoring
- Review this documentation
- Check GitHub issues

---

*Last Updated: September 28, 2025*
*Version: 1.0.0*
