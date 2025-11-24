#!/bin/bash
# Startup script for Docker container

# Generate Prisma client (if not already done)
npx prisma generate

# Run migrations (optional - uncomment if you want auto-migrations)
# npx prisma migrate deploy

# Start the server
node index.js

