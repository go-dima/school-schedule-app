# Docker Local Testing Setup

This document explains how to use Docker for local testing with a PostgreSQL database that includes all migrations.

## Quick Start

1. **Build and Start Database**
   ```bash
   ./scripts/docker-db.sh build
   ./scripts/docker-db.sh start
   ```

2. **Copy Environment Configuration**
   ```bash
   cp .env.dockerized .env.local
   ```

3. **Start the Application**
   ```bash
   npm run dev
   ```

## Docker Components

### Files Overview

- `Dockerfile.postgres` - PostgreSQL container with migrations baked in
- `docker-compose.local.yml` - Docker Compose configuration for local development
- `.env.dockerized` - Environment variables for Docker setup
- `scripts/docker-db.sh` - Management script for database operations

### Database Container

The PostgreSQL container includes:
- PostgreSQL 15 Alpine Linux
- All migration files (`001_initial_schema.sql` through `004_sample_data.sql`)
- Automatic migration execution on container startup
- Health checks and proper initialization
- Sample data for development and testing

## Management Script Usage

The `scripts/docker-db.sh` script provides easy database management:

### Basic Commands

```bash
# Build the database image with migrations
./scripts/docker-db.sh build

# Start the database
./scripts/docker-db.sh start

# Check status
./scripts/docker-db.sh status

# View logs
./scripts/docker-db.sh logs

# Stop the database
./scripts/docker-db.sh stop
```

### Development Commands

```bash
# Connect to database with psql
./scripts/docker-db.sh connect

# Run a SQL query
./scripts/docker-db.sh sql "SELECT COUNT(*) FROM public.classes;"

# Restart database
./scripts/docker-db.sh restart
```

### Reset and Cleanup

```bash
# Reset database (destroys data, rebuilds from migrations)
./scripts/docker-db.sh reset

# Clean up everything (containers, volumes, images)
./scripts/docker-db.sh clean
```

## Database Connection Details

When running, the database is available at:

- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `school_schedule`
- **Username**: `postgres`
- **Password**: `postgres`
- **Connection String**: `postgresql://postgres:postgres@localhost:5432/school_schedule`

## Environment Configuration

The `.env.dockerized` file contains:

```env
# Database connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=school_schedule
DB_USER=postgres
DB_PASSWORD=postgres

# Mock Supabase settings (for local testing)
VITE_SUPABASE_URL=http://localhost:3000/api
VITE_SUPABASE_ANON_KEY=mock_anon_key_for_local_testing

# Development flags
VITE_DEV_MODE=true
VITE_DOCKER_MODE=true
```

## Migration Process

The container automatically runs migrations in this order during startup:

1. **001_initial_schema.sql** - Core database structure
2. **002_rls_policies.sql** - Row Level Security policies  
3. **003_triggers_functions.sql** - Database functions and triggers
4. **004_sample_data.sql** - Sample data and initial time slots

Migration progress is logged during container initialization.

## Troubleshooting

### Container Won't Start

```bash
# Check Docker is running
docker info

# View detailed logs
./scripts/docker-db.sh logs

# Rebuild if migrations changed
./scripts/docker-db.sh reset
```

### Connection Refused

```bash
# Wait for container to be fully ready
./scripts/docker-db.sh status

# Container might still be initializing
docker exec school-schedule-postgres pg_isready -U postgres
```

### Data Issues

```bash
# Reset database with fresh migrations
./scripts/docker-db.sh reset

# Connect and verify data
./scripts/docker-db.sh connect
\dt  -- List tables
SELECT COUNT(*) FROM public.classes;  -- Check sample data
```

### Port Conflicts

If port 5432 is in use:

1. Stop other PostgreSQL services
2. Or modify `docker-compose.local.yml` to use different port:
   ```yaml
   ports:
     - "5433:5432"  # Use 5433 externally
   ```

## Integration with Application

### Adapting for Raw PostgreSQL

Since the app was designed for Supabase, you may need to:

1. **Create a PostgreSQL Client Service**
   ```typescript
   // services/postgresql.ts
   import { Pool } from 'pg'
   
   const pool = new Pool({
     host: process.env.DB_HOST,
     port: parseInt(process.env.DB_PORT || '5432'),
     database: process.env.DB_NAME,
     user: process.env.DB_USER,
     password: process.env.DB_PASSWORD,
   })
   
   export { pool }
   ```

2. **Update Service Layer**
   - Replace Supabase calls with raw PostgreSQL queries
   - Handle authentication differently (no built-in auth)
   - Implement RLS manually or through middleware

3. **Environment Detection**
   ```typescript
   const isDockerMode = process.env.VITE_DOCKER_MODE === 'true'
   const dbService = isDockerMode ? postgresqlService : supabaseService
   ```

## Docker Compose Commands

Alternative to the management script:

```bash
# Start services
docker-compose -f docker-compose.local.yml up -d

# Stop services
docker-compose -f docker-compose.local.yml down

# View logs
docker-compose -f docker-compose.local.yml logs -f postgres

# Rebuild and start
docker-compose -f docker-compose.local.yml up -d --build
```

## Production Considerations

⚠️ **This setup is for local development only**

For production:
- Use proper secrets management
- Enable SSL/TLS
- Configure proper authentication
- Set up backups
- Use production-grade PostgreSQL configuration
- Implement proper monitoring and logging

## Useful SQL Queries

```sql
-- List all tables
\dt

-- Show user roles
SELECT * FROM public.user_roles;

-- Count classes by grade
SELECT grade, COUNT(*) FROM public.classes GROUP BY grade;

-- Show time slots
SELECT * FROM public.time_slots ORDER BY day_of_week, start_time;

-- Check mandatory classes
SELECT title, grade, is_mandatory FROM public.classes WHERE is_mandatory = true;
```