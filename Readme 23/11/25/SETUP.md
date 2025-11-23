# SIGMENT Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Docker (for Redis)
- Supabase account
- OpenAI API key

## 1. Database Setup (Supabase)

### Create a Supabase Project

1. Go to https://app.supabase.com
2. Create a new project
3. Wait for the database to be ready

### Apply the Schema

```bash
# Get your database connection string from Supabase Settings > Database
# Then run:
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" -f database/schema.sql
```

Or use the Supabase SQL Editor:
- Go to SQL Editor in Supabase Dashboard
- Copy the contents of `database/schema.sql`
- Execute the script

### Enable pgvector Extension

In Supabase SQL Editor, run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## 2. Environment Variables

Create a `.env` file in the **root directory**:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# FastAPI Configuration
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000

# Next.js Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## 4. Start Redis (Using Docker)

```bash
# From the root directory
docker-compose up -d
```

Or manually:
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

## 5. Start Celery Worker

```bash
cd backend

# Make sure virtual environment is activated
celery -A app.workers.celery_app worker --loglevel=info
```

Keep this terminal running.

## 6. Start FastAPI Backend

Open a new terminal:

```bash
cd backend

# Activate virtual environment
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Start the API server
uvicorn main:app --reload --port 8000
```

The API will be available at http://localhost:8000
- Docs: http://localhost:8000/api/docs
- Health: http://localhost:8000/health

## 7. Frontend Setup

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at http://localhost:3000

## 8. Test the Setup

1. Open http://localhost:3000
2. Type a note (at least 10 characters)
3. Click "Send" or press Cmd/Ctrl + Enter
4. You should see a success toast
5. Go to "My Notes" to see the tracker
6. Check the backend terminal for AI processing logs

## 9. Monitoring

### Check Celery Tasks

```bash
# In the Celery worker terminal, you should see:
[2025-11-23 10:30:15,123: INFO/MainProcess] Received task: process_note[...]
[2025-11-23 10:30:16,456: INFO/ForkPoolWorker-1] ✅ Note processed successfully
```

### Check API Logs

FastAPI will show all incoming requests and responses.

### Check Redis

```bash
docker exec -it <redis-container-id> redis-cli
127.0.0.1:6379> PING
PONG
```

## 10. Production Deployment

### Backend (FastAPI + Celery)

Consider deploying to:
- **Render.com** (Web Service + Worker)
- **Railway.app** (Backend + Redis)
- **Fly.io** (Docker deployment)

### Frontend (Next.js)

Deploy to:
- **Vercel** (Recommended for Next.js)
- **Netlify**
- **Cloudflare Pages**

### Environment Variables

Make sure to set all environment variables in your deployment platform.

## Troubleshooting

### "Connection to Supabase failed"
- Check your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Verify network access to Supabase

### "OpenAI API Error"
- Verify your `OPENAI_API_KEY`
- Check OpenAI API usage limits

### "Celery not processing tasks"
- Ensure Redis is running (`docker ps`)
- Check Celery worker logs
- Verify `REDIS_URL` in `.env`

### "Notes not syncing in frontend"
- Check browser console for errors
- Verify `NEXT_PUBLIC_API_URL` points to running backend
- Check Network tab in browser DevTools

## Next Steps

1. Implement proper authentication (Supabase Auth)
2. Add admin dashboard for moderation
3. Build the "Galaxy" cluster visualization
4. Implement the time-lapse slider
5. Add PWA manifest for offline support
6. Set up monitoring and logging

## Support

For issues, check:
- Backend logs (FastAPI terminal)
- Celery logs (Worker terminal)
- Browser console (Frontend)
- Redis connection
- Supabase dashboard

