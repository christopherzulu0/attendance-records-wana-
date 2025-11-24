# Docker Quick Start Guide

## Prerequisites
- Docker installed ✅
- Docker Compose installed (usually comes with Docker Desktop)

## Local Testing

### 1. Build and Run with Docker Compose

```bash
cd backend
docker compose up --build
```

This will:
- Build the Docker image (takes 15-30 minutes first time due to Python dependencies)
- Start PostgreSQL database
- Start the backend server
- Both services will be available

### 2. Test the Backend

Once running, test the API:
```bash
# Health check
curl http://localhost:3000/api/health

# Or open in browser
open http://localhost:3000/api/health
```

### 3. Stop Services

```bash
# Stop and remove containers
docker compose down

# Stop and remove containers + volumes (clears database)
docker compose down -v
```

## Deploy Docker to Cloud Platforms

### Option 1: Railway (Easiest) ⭐

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Add Docker support"
   git push
   ```

2. **Deploy on Railway:**
   - Go to [railway.app](https://railway.app)
   - Create new project → "Deploy from GitHub repo"
   - Select your backend folder
   - Railway will auto-detect Dockerfile
   - Add PostgreSQL service
   - Set `DATABASE_URL` environment variable
   - Deploy!

3. **Set Environment Variables:**
   ```
   DATABASE_URL=<railway-postgres-url>
   PORT=3000
   NODE_ENV=production
   ```

### Option 2: Render

1. **Create account** at [render.com](https://render.com)
2. **Create new Web Service**
3. **Connect GitHub repo**
4. **Settings:**
   - Build Command: `docker build -t backend .`
   - Start Command: `docker run -p 3000:3000 backend`
   - Or use Docker Compose: `docker compose up`
5. **Add PostgreSQL database** separately
6. **Set environment variables**

### Option 3: Fly.io

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login:**
   ```bash
   fly auth login
   ```

3. **Initialize:**
   ```bash
   cd backend
   fly launch
   ```

4. **Deploy:**
   ```bash
   fly deploy
   ```

### Option 4: DigitalOcean App Platform

1. Go to [digitalocean.com](https://digitalocean.com)
2. Create App → Connect GitHub
3. Select backend folder
4. Platform will detect Dockerfile
5. Add PostgreSQL database
6. Set environment variables
7. Deploy

### Option 5: AWS ECS / Fargate

1. **Build and push to ECR:**
   ```bash
   # Build image
   docker build -t attendance-backend .
   
   # Tag for ECR
   docker tag attendance-backend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/attendance-backend:latest
   
   # Push to ECR
   docker push <account-id>.dkr.ecr.<region>.amazonaws.com/attendance-backend:latest
   ```

2. **Create ECS task definition**
3. **Deploy to Fargate**

## Environment Variables

Set these in your deployment platform:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
PORT=3000
NODE_ENV=production
```

## Important Notes

1. **First build takes 15-30 minutes** - Python dependencies (dlib, face_recognition) need to compile
2. **Docker image size** - Will be ~2-3GB due to Python dependencies
3. **Health check** - Make sure `/api/health` endpoint exists in your backend
4. **Database migrations** - Run Prisma migrations after deployment:
   ```bash
   docker exec -it <container-id> npx prisma migrate deploy
   ```

## Troubleshooting

### Build fails on Python dependencies
- Ensure all system dependencies are in Dockerfile
- Check that `requirements.txt` is correct

### Container can't find Python
- Verify virtual environment path in `getPythonCommand()` function
- Check that `venv` is created in Dockerfile

### Database connection errors
- Verify `DATABASE_URL` environment variable
- Check database is accessible from container
- Ensure network connectivity between services

## Recommended: Railway

For easiest deployment:
1. Push to GitHub
2. Connect Railway
3. Add PostgreSQL
4. Deploy!

Railway automatically:
- Detects Dockerfile
- Builds the image
- Runs migrations
- Starts the service

