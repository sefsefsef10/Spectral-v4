# Spectral Healthcare AI Governance Platform - Deployment Guide

## Overview

This guide covers deploying Spectral to production environments. Spectral is designed for enterprise healthcare deployment with HIPAA compliance, multi-tenancy, and high availability requirements.

## Prerequisites

### System Requirements
- **OS:** Linux (Ubuntu 22.04 LTS or RHEL 9 recommended)
- **CPU:** Minimum 4 cores (8+ recommended for production)
- **RAM:** Minimum 8GB (16GB+ recommended)
- **Storage:** Minimum 50GB SSD (100GB+ recommended)
- **Network:** HTTPS/TLS 1.3 required, static IP or load balancer

### Required Services
- **PostgreSQL:** 15+ (managed service recommended: AWS RDS, Google Cloud SQL, or Neon)
- **Redis:** 7+ (for session management and caching)
- **S3-Compatible Storage:** For compliance reports (AWS S3, MinIO, etc.)
- **Node.js:** 20+ LTS

## Environment Variables

Create a `.env.production` file with the following required variables:

```bash
# Application
NODE_ENV=production
PORT=5000
BASE_URL=https://spectral.yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/spectral_prod
PGHOST=your-db-host.rds.amazonaws.com
PGPORT=5432
PGUSER=spectral
PGPASSWORD=your-secure-password
PGDATABASE=spectral_prod

# Security & Encryption
SESSION_SECRET=generate-with-openssl-rand-base64-32
ENCRYPTION_KEY=generate-with-openssl-rand-base64-32
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict

# Authentication
JWT_SECRET=generate-with-openssl-rand-base64-32
JWT_EXPIRY=1h

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=notifications@spectral.yourdomain.com

# Stripe Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLIC_KEY=pk_live_...

# WorkOS SSO (Enterprise)
WORKOS_API_KEY=sk_live_...
WORKOS_CLIENT_ID=client_...
WORKOS_COOKIE_PASSWORD=generate-with-openssl-rand-base64-32

# Object Storage (S3)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=spectral-compliance-reports-prod

# Redis (Upstash or self-hosted)
UPSTASH_REDIS_URL=redis://...
UPSTASH_REDIS_TOKEN=...

# Monitoring & Logging
LOG_LEVEL=info
PINO_LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=1000
```

### Generate Secrets

Use OpenSSL to generate secure random secrets:

```bash
# Generate session secret
openssl rand -base64 32

# Generate encryption key
openssl rand -base64 32

# Generate JWT secret
openssl rand -base64 32
```

## Deployment Methods

### Method 1: Docker Deployment (Recommended)

#### 1. Build Docker Image

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --production=false

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built assets and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 5000

USER node

CMD ["npm", "start"]
```

#### 2. Build and Run

```bash
# Build image
docker build -t spectral-healthcare-ai:latest .

# Run container
docker run -d \
  --name spectral-api \
  -p 5000:5000 \
  --env-file .env.production \
  --restart unless-stopped \
  spectral-healthcare-ai:latest
```

#### 3. Docker Compose (Full Stack)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    image: spectral-healthcare-ai:latest
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: spectral_prod
      POSTGRES_USER: spectral
      POSTGRES_PASSWORD: ${PGPASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
```

### Method 2: Kubernetes Deployment

#### 1. Create Kubernetes Manifests

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spectral-api
  labels:
    app: spectral-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: spectral-api
  template:
    metadata:
      labels:
        app: spectral-api
    spec:
      containers:
      - name: spectral-api
        image: your-registry/spectral-healthcare-ai:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: spectral-secrets
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
```

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: spectral-api
spec:
  selector:
    app: spectral-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 5000
  type: LoadBalancer
```

#### 2. Deploy to Kubernetes

```bash
# Create secrets
kubectl create secret generic spectral-secrets \
  --from-env-file=.env.production

# Deploy application
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Verify deployment
kubectl get pods -l app=spectral-api
kubectl get svc spectral-api
```

### Method 3: Traditional Server Deployment

#### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2
```

#### 2. Deploy Application

```bash
# Clone repository
git clone https://github.com/yourorg/spectral-platform.git
cd spectral-platform

# Install dependencies
npm ci --production

# Build application
npm run build

# Run database migrations
npm run db:push

# Start with PM2
pm2 start dist/index.js --name spectral-api -i 4

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

## Database Setup

### Initialize Database

```bash
# Run migrations
npm run db:push

# Verify database schema
npm run db:studio
```

### Database Backup Strategy

```bash
# Automated daily backups (cron)
0 2 * * * pg_dump -h $PGHOST -U $PGUSER $PGDATABASE | gzip > /backups/spectral_$(date +\%Y\%m\%d).sql.gz

# Retention: Keep daily backups for 30 days, monthly for 1 year
```

## SSL/TLS Configuration

### Using Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d spectral.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/spectral
server {
    listen 80;
    server_name spectral.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name spectral.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/spectral.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/spectral.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Monitoring & Logging

### Health Check Endpoint

```bash
curl https://spectral.yourdomain.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-10-27T12:00:00Z",
  "uptime": 86400,
  "database": "connected"
}
```

### Application Logs

```bash
# View PM2 logs
pm2 logs spectral-api

# View Docker logs
docker logs -f spectral-api

# View Kubernetes logs
kubectl logs -f deployment/spectral-api
```

### Log Aggregation (Recommended)

- **Datadog:** For comprehensive APM and log management
- **Splunk:** For HIPAA-compliant log retention
- **ELK Stack:** Self-hosted alternative

## Security Hardening

### Firewall Rules

```bash
# Allow HTTPS only
sudo ufw allow 443/tcp
sudo ufw enable

# For load balancer health checks
sudo ufw allow from 10.0.0.0/8 to any port 5000
```

### Security Scanning

```bash
# Run npm audit
npm audit

# Run OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://spectral.yourdomain.com
```

## Scaling & High Availability

### Horizontal Scaling

For high-traffic deployments, run multiple instances behind a load balancer:

```bash
# PM2 cluster mode
pm2 start dist/index.js -i max

# Kubernetes auto-scaling
kubectl autoscale deployment spectral-api \
  --min=3 --max=10 --cpu-percent=70
```

### Database Replication

Use PostgreSQL read replicas for read-heavy workloads:

```bash
DATABASE_URL=postgresql://primary-host:5432/spectral_prod
DATABASE_REPLICA_URL=postgresql://replica-host:5432/spectral_prod
```

## Disaster Recovery

### Backup Verification

```bash
# Test database restore monthly
pg_restore -h localhost -U spectral -d spectral_test backup.sql
```

### Recovery Time Objective (RTO)

- **Database:** < 1 hour (automated failover)
- **Application:** < 15 minutes (auto-scaling group)
- **Complete system:** < 2 hours

## Compliance & Auditing

### HIPAA Compliance Checklist

- ✅ TLS 1.3 encryption in transit
- ✅ AES-256-GCM encryption at rest
- ✅ Audit logging enabled
- ✅ Access controls (RBAC)
- ✅ Automated backups
- ✅ Breach notification system

### Audit Log Retention

```sql
-- Verify audit log retention (7 years for HIPAA)
SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '7 years';
```

## Support & Troubleshooting

### Common Issues

1. **Database connection errors:**
   ```bash
   # Check DATABASE_URL format
   echo $DATABASE_URL
   
   # Test connection
   psql $DATABASE_URL -c "SELECT 1;"
   ```

2. **Out of memory:**
   ```bash
   # Increase Node.js memory
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

3. **SSL certificate renewal failed:**
   ```bash
   sudo certbot renew --force-renewal
   ```

### Contact Support

- **Email:** ops@spectral.health
- **Slack:** #spectral-ops (private channel)
- **Emergency Hotline:** +1-800-SPECTRAL

## Maintenance Windows

Recommended maintenance schedule:
- **Database updates:** Monthly, Sunday 2-4 AM EST
- **Security patches:** Within 48 hours of release
- **Application updates:** Bi-weekly, Thursday evenings

---

**Last Updated:** October 27, 2024  
**Version:** 1.0.0
