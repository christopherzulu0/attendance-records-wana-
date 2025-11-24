# Deploy Docker Container - Step by Step

## Quick Start: Test Locally First

### 1. Build and Test Locally

```bash
cd backend

# Build the Docker image (takes 15-30 minutes first time)
docker compose build

# Start services (backend + PostgreSQL)
docker compose up

# In another terminal, test the API
curl http://localhost:3000/api/health
```

### 2. Run Database Migrations

```bash
# Get container ID
docker ps

# Run migrations
docker exec -it <backend-container-id> npx prisma migrate deploy
```

---

## Deploy to Cloud Platforms

### 🚀 Option 1: Railway (Recommended - Easiest)

**Steps:**

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add Docker support"
   git push
   ```

2. **Deploy on Railway:**
   - Go to https://railway.app
   - Sign up/login
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will detect the `docker-compose.yml` or `Dockerfile`
   - Click "Add Service" → "Database" → "PostgreSQL"
   - Railway will automatically set `DATABASE_URL`

3. **Configure:**
   - Go to your backend service → Settings
   - Set Root Directory: `backend`
   - Railway will auto-detect Dockerfile

4. **Environment Variables** (auto-set by Railway):
   - `DATABASE_URL` (from PostgreSQL service)
   - `PORT=3000`
   - `NODE_ENV=production`

5. **Deploy:**
   - Railway will build and deploy automatically
   - First build: 15-30 minutes (Python dependencies)
   - Get your URL: `https://your-app.railway.app`

6. **Run Migrations:**
   - Go to service → Deployments → Click latest deployment
   - Open "Shell" tab
   - Run: `npx prisma migrate deploy`

**Cost:** Free tier: 500 hours/month, $5/month after

---

### 🚀 Option 2: Render

**Steps:**

1. **Create account** at https://render.com

2. **Create Web Service:**
   - New → Web Service
   - Connect GitHub repository
   - Select repository and branch

3. **Configure:**
   - **Name:** attendance-backend
   - **Root Directory:** `backend`
   - **Environment:** Docker
   - **Dockerfile Path:** `backend/Dockerfile`
   - **Start Command:** `node index.js`

4. **Add PostgreSQL:**
   - New → PostgreSQL
   - Create database
   - Copy connection string

5. **Environment Variables:**
   ```
   DATABASE_URL=<render-postgres-connection-string>
   PORT=3000
   NODE_ENV=production
   ```

6. **Deploy:**
   - Click "Create Web Service"
   - Render will build and deploy
   - Get URL: `https://your-app.onrender.com`

7. **Run Migrations:**
   - Go to Shell in Render dashboard
   - Run: `npx prisma migrate deploy`

**Cost:** Free tier available, $7/month for always-on

---

### 🚀 Option 3: Fly.io

**Steps:**

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login:**
   ```bash
   fly auth login
   ```

3. **Initialize (in backend folder):**
   ```bash
   cd backend
   fly launch
   ```
   - Follow prompts
   - Create PostgreSQL database when asked

4. **Deploy:**
   ```bash
   fly deploy
   ```

5. **Run Migrations:**
   ```bash
   fly ssh console
   npx prisma migrate deploy
   ```

**Cost:** Free tier: 3 VMs, $5/month after

---

### 🚀 Option 4: DigitalOcean App Platform

**Steps:**

1. Go to https://cloud.digitalocean.com
2. Create → App Platform
3. Connect GitHub repository
4. Configure:
   - **Type:** Web Service
   - **Source:** `backend` folder
   - **Build Command:** (auto-detected from Dockerfile)
   - **Run Command:** `node index.js`
5. Add PostgreSQL database
6. Set environment variables
7. Deploy

**Cost:** Starts at $5/month

---

### 🚀 Option 5: AWS ECS / Fargate

**Steps:**

1. **Build and push to ECR:**
   ```bash
   # Login to ECR
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

   # Build
   docker build -t attendance-backend .

   # Tag
   docker tag attendance-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/attendance-backend:latest

   # Push
   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/attendance-backend:latest
   ```

2. **Create ECS Task Definition**
3. **Create Fargate Service**
4. **Configure RDS PostgreSQL**
5. **Deploy**

**Cost:** Pay-as-you-go, ~$15-30/month

---

## Update Your Frontend API URL

After deployment, update your frontend to use the new backend URL:

**In `attendance-records/hooks/useUsers.ts` and other API hooks:**
```typescript
const API_BASE_URL = 'https://your-backend-url.railway.app'; // or your deployed URL
```

---

## Testing Deployment

```bash
# Health check
curl https://your-backend-url.railway.app/api/health

# Test login
curl -X POST https://your-backend-url.railway.app/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

---

## Troubleshooting

### Build fails
- Check Docker logs: `docker compose logs`
- Ensure all files are in backend folder
- Verify `requirements.txt` is correct

### Python not found in container
- Check Dockerfile creates venv correctly
- Verify `getPythonCommand()` function in `index.js`

### Database connection errors
- Verify `DATABASE_URL` is set correctly
- Check database is accessible from container
- Ensure network connectivity

### Container exits immediately
- Check logs: `docker compose logs backend`
- Verify health check endpoint works
- Check environment variables

---

## Recommended: Railway

**Why Railway:**
- ✅ Easiest setup
- ✅ Auto-detects Docker
- ✅ Free tier available
- ✅ Auto-deploys from Git
- ✅ Built-in PostgreSQL
- ✅ Great documentation

**Quick Deploy:**
1. Push to GitHub
2. Connect Railway
3. Add PostgreSQL
4. Deploy!

That's it! 🚀

