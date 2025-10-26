# Login Error Investigation Report

**Issue**: Getting 400 error `{"error":"Invalid login data"}` when attempting to login with demo/demo123

**Date**: 2025-10-26

**Status**: Root cause identified

---

## Root Cause

The application's database is **not configured**. The PostgreSQL database connection URL is missing from the environment configuration, causing all database operations to fail.

## Technical Analysis

### 1. Missing Environment Configuration

The application requires a `.env` file with database credentials, but none exists:

```bash
$ ls -la | grep .env
-rw-r--r-- 1 root root    513 Oct 26 00:23 .env.example  # Template exists
# No .env file found
```

### 2. Database Configuration Requirements

From `server/db.ts:8-12`:
```typescript
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}
```

The application uses:
- **Database**: PostgreSQL via Neon Serverless (@neondatabase/serverless)
- **ORM**: Drizzle ORM
- **Required**: `DATABASE_URL` environment variable

### 3. Error Propagation Chain

When login is attempted:

1. **Client** sends POST to `/api/auth/login` with username and password
2. **Server** validates request schema (passes)
3. **Server** calls `storage.getUserByUsername(username)` at `server/routes.ts:184`
4. **Database** connection attempt fails (no DATABASE_URL)
5. **Catch block** catches the error at `server/routes.ts:219-220`:
   ```typescript
   catch (error) {
     res.status(400).json({ error: "Invalid login data" });
   }
   ```
6. **Client** receives generic 400 error with no details about the real issue

### 4. Code Locations

- **Login endpoint**: `server/routes.ts:173-221`
- **Database config**: `server/db.ts:1-16`
- **User lookup**: `server/storage.ts:210-213`
- **Demo credentials**: `server/seed.ts:138-149`

### 5. Demo User Configuration

The demo user **should** be created during database seeding:

```typescript
// From server/seed.ts:138-149
const hashedPassword = await hashPassword("demo123");
await db.insert(users).values({
  username: "demo",
  password: hashedPassword,
  role: "health_system",
  healthSystemId: healthSystem.id,
  vendorId: null,
});
```

**Expected Credentials**:
- Username: `demo`
- Password: `demo123`
- Role: `health_system`

However, this seed script has **not been run** because the database doesn't exist.

## Solution

### Step 1: Set Up Database

You have two options:

#### Option A: Use Neon Database (Recommended for Production)

1. Sign up for a Neon account at https://neon.tech
2. Create a new PostgreSQL database
3. Copy the connection string

#### Option B: Use Local PostgreSQL (Development)

1. Install PostgreSQL locally
2. Create a database: `createdb spectral_dev`
3. Use connection string: `postgresql://username:password@localhost:5432/spectral_dev`

### Step 2: Configure Environment

1. Create a `.env` file in the project root:
```bash
cp .env.example .env
```

2. Edit `.env` and add your database URL:
```env
# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@host:5432/database

# Session (REQUIRED)
SESSION_SECRET=a-random-secret-string-here

# Email (Optional - for user invitations)
SENDGRID_API_KEY=your-sendgrid-key

# Redis Cache (Optional - improves performance)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# AWS S3 (Optional - for report storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=spectral-reports
```

### Step 3: Initialize Database Schema

Push the database schema using Drizzle:
```bash
npm run db:push
```

### Step 4: Seed Database with Demo Data

Run the seed script:
```bash
tsx server/seed.ts
```

You should see output like:
```
Created demo health system
Created demo vendors
Created compliance certifications
Database seeded successfully!
Demo credentials: username=demo, password=demo123
Health System ID: demo-health-system-001
```

### Step 5: Start the Application

```bash
npm run dev
```

### Step 6: Test Login

Now you should be able to login with:
- **Username**: `demo`
- **Password**: `demo123`

## Recommendations for Code Improvement

### 1. Improve Error Handling

The current catch-all error handler hides the real problem. Consider:

```typescript
// server/routes.ts:219-220 (current)
catch (error) {
  res.status(400).json({ error: "Invalid login data" });
}

// Recommended improvement:
catch (error) {
  logger.error("Login error:", error);

  // Don't expose internal errors to clients in production
  const message = process.env.NODE_ENV === 'development'
    ? error.message
    : "Invalid login data";

  res.status(400).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
}
```

### 2. Add Database Health Check

Add a startup health check to fail fast if database is not configured:

```typescript
// server/index.ts - add before starting server
async function checkDatabaseConnection() {
  try {
    await storage.getHealthSystems(); // Or any simple query
    console.log("✓ Database connection successful");
  } catch (error) {
    console.error("✗ Database connection failed:", error.message);
    process.exit(1);
  }
}
```

### 3. Better Environment Validation

Consider using a schema validator for environment variables:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // ... other env vars
});

export const env = envSchema.parse(process.env);
```

### 4. Add Specific Error Types

Create specific error responses for different failure scenarios:

- `400` - Invalid request format (schema validation failed)
- `401` - Invalid credentials (user not found or wrong password)
- `500` - Internal server error (database connection failed)

## Summary

The `demo/demo123` credentials are correct, but the login is failing because:

1. ✗ Database is not provisioned
2. ✗ Environment variables are not configured
3. ✗ Seed script has not been run
4. ✓ Login endpoint code is correct
5. ✓ Demo user definition is correct

**Next Action**: Set up the database and environment configuration following the steps in the Solution section above.

---

**Investigated by**: Claude
**Session**: claude/investigate-login-error-011CUV3VbWyisR1dnTAgbQCh
