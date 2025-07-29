# Docker Setup Guide - Market Manager

## 🐳 **Overview**

Market Manager uses Docker for both development and production environments with full hot reload support and service orchestration.

## 📋 **Prerequisites**

- Docker Desktop installed and running
- Node.js 18+ (for npm scripts)
- Git (for repository management)

## 🔧 **Development Environment**

### **Quick Start**
```bash
# Start complete development environment
npm run docker:dev:up

# In separate terminal - run migrations and seed data
npm run docker:dev:migrate
npm run docker:dev:seed
```

### **Development Services**
The development environment includes:

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js with hot reload |
| Backend API | 3001 | NestJS with hot reload |
| PostgreSQL | 5432 | Database server |
| PgBouncer | 6432 | Connection pooler |
| Redis | 6379 | Cache and sessions |
| pgAdmin | 8080 | Database GUI |
| Redis Commander | 8081 | Redis GUI |

### **Development Commands**

**Environment Management:**
```bash
npm run docker:dev:up              # Start with build
npm run docker:dev:up:detached     # Start in background
npm run docker:dev:down            # Stop all services
npm run docker:dev:restart         # Restart entire environment
npm run docker:dev:logs            # View all logs
npm run docker:dev:clean           # Remove all containers and volumes
```

**Database Operations:**
```bash
npm run docker:dev:migrate         # Run Prisma migrations
npm run docker:dev:seed            # Seed development data
```

**Development Tools:**
```bash
npm run docker:dev:tools           # Start pgAdmin + Redis Commander
```

**Rebuilding Services:**
```bash
npm run docker:dev:rebuild                # Rebuild all containers
npm run docker:dev:rebuild:backend        # Rebuild only backend
npm run docker:dev:rebuild:frontend       # Rebuild only frontend
npm run docker:dev:restart:backend        # Restart backend services
npm run docker:dev:restart:frontend       # Restart frontend service
```

## 🚀 **Production Environment**

### **Production Start**
```bash
# Start production environment
npm run docker:prod:up

# Run production migrations
npm run docker:prod:migrate
```

### **Production Services**
- **Frontend**: Next.js optimized build
- **Backend API**: NestJS production build (2 replicas)
- **Worker**: Background job processor
- **Database**: PostgreSQL with production settings
- **Redis**: Persistent cache with authentication
- **Nginx**: Reverse proxy with load balancing

### **Production Commands**

**Environment Management:**
```bash
npm run docker:prod:up             # Start production (detached)
npm run docker:prod:down           # Stop production
npm run docker:prod:restart        # Restart entire environment
npm run docker:prod:logs           # View production logs
npm run docker:prod:clean          # Remove containers and volumes
```

**Database Operations:**
```bash
npm run docker:prod:migrate        # Run production migrations
npm run docker:prod:seed           # Seed production data (use carefully!)
```

**Rebuilding:**
```bash
npm run docker:prod:rebuild                # Rebuild all containers
npm run docker:prod:rebuild:backend        # Rebuild backend services
npm run docker:prod:rebuild:frontend       # Rebuild frontend
npm run docker:prod:restart:backend        # Restart backend services
npm run docker:prod:restart:frontend       # Restart frontend
```

## 📁 **File Structure**

```
├── docker-compose.dev.yml         # Development environment
├── docker-compose.prod.yml        # Production environment
├── Dockerfile.dev                 # Multi-stage dev builds
├── Dockerfile.prod                # Multi-stage prod builds
├── docker/                        # Configuration files
│   ├── nginx/                     # Reverse proxy config
│   ├── postgres/                  # Database settings
│   └── redis/                     # Cache configuration
├── .env.development.example       # Dev environment template
├── .env.production.example        # Prod environment template
```

## ⚙️ **Configuration**

### **Environment Variables**

**Development** (`.env.development`):
```bash
cp .env.development.example .env.development
# Edit with your development values
```

**Production** (`.env.production`):
```bash
cp .env.production.example .env.production
# Edit with your production secrets
```

### **Key Settings**

**Database:**
- Development: `market_manager_dev`
- Production: `market_manager_prod`
- Connection pooling via PgBouncer

**Container Names:**
- All containers prefixed with `market-manager-`
- Separate dev/prod naming to avoid conflicts

**Volumes:**
- Named volumes for persistence
- Source code mounted for hot reload (dev only)
- Node modules cached in named volumes

## 🔍 **Troubleshooting**

### **Common Issues**

**Port Conflicts:**
```bash
# Check what's using ports
lsof -i :3000,3001,5432,6379

# Kill conflicting processes
sudo kill -9 <PID>
```

**Database Connection Issues:**
```bash
# Check database logs
docker logs market-manager-db-dev

# Reset database
npm run docker:dev:clean
npm run docker:dev:up
npm run docker:dev:migrate
```

**Hot Reload Not Working:**
```bash
# Rebuild frontend with no cache
npm run docker:dev:rebuild:frontend

# Check mounted volumes
docker inspect market-manager-frontend-dev
```

**Permission Issues (macOS/Linux):**
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
```

### **Container Health**

**Check Service Status:**
```bash
docker ps
docker-compose -f docker-compose.dev.yml ps
```

**View Service Logs:**
```bash
docker logs market-manager-api-dev
docker logs market-manager-frontend-dev
docker logs market-manager-db-dev
```

**Access Container Shell:**
```bash
docker exec -it market-manager-api-dev sh
docker exec -it market-manager-db-dev psql -U postgres -d market_manager_dev
```

## 🔐 **Security Notes**

**Development:**
- Uses default passwords (fine for local development)
- CORS enabled for localhost
- Swagger documentation enabled

**Production:**
- Requires secure passwords in `.env.production`
- CORS restricted to production domains
- Swagger disabled
- SSL termination at Nginx
- Resource limits enforced

## 📝 **Database Access**

**GUI Access:**
- pgAdmin: http://localhost:8080
  - Email: `dev@marketmanager.local`
  - Password: `devpassword`

**Command Line:**
```bash
# Direct PostgreSQL access
docker exec -it market-manager-db-dev psql -U postgres -d market_manager_dev

# Via PgBouncer (recommended for app connections)
docker exec -it market-manager-pgbouncer-dev psql -h localhost -p 6432 -U postgres -d market_manager_dev
```

## 🎯 **Development Workflow**

**Daily Development:**
1. `npm run docker:dev:up` - Start environment
2. Navigate to http://localhost:3000 for frontend
3. Use http://localhost:3001/api for API documentation
4. Make code changes (auto-reloads)
5. `npm run docker:dev:down` - Stop when done

**Database Changes:**
1. Edit `backend/prisma/schema.prisma`
2. `npm run docker:dev:migrate` - Apply changes
3. Restart backend if needed

**Fresh Environment:**
1. `npm run docker:dev:clean` - Remove everything
2. `npm run docker:dev:up` - Fresh start
3. `npm run docker:dev:migrate` and `npm run docker:dev:seed`