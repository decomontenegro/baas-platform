#!/bin/bash

# =============================================================================
# BaaS Dashboard - Database Setup Script
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if .env exists
if [ ! -f .env ]; then
    log_warn ".env file not found. Copying from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        log_success ".env created from .env.example"
        log_warn "Please review and update .env with your actual values!"
    else
        log_error ".env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Load environment variables
source .env 2>/dev/null || true

# Default values
POSTGRES_USER=${POSTGRES_USER:-baas}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-baas_secret_2024}
POSTGRES_DB=${POSTGRES_DB:-baas_db}
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}

log_info "Starting BaaS Database Setup..."

# =============================================================================
# Step 1: Start Docker containers
# =============================================================================
log_info "Step 1: Starting Docker containers..."

if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    log_error "Docker Compose not found. Please install Docker and Docker Compose."
    exit 1
fi

$COMPOSE_CMD up -d postgres redis

log_info "Waiting for PostgreSQL to be ready..."
sleep 5

# Wait for PostgreSQL to be healthy
MAX_RETRIES=30
RETRY_COUNT=0
until $COMPOSE_CMD exec -T postgres pg_isready -U $POSTGRES_USER -d $POSTGRES_DB &>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        log_error "PostgreSQL failed to start after $MAX_RETRIES attempts."
        exit 1
    fi
    log_info "Waiting for PostgreSQL... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

log_success "PostgreSQL is ready!"

# =============================================================================
# Step 2: Install dependencies
# =============================================================================
log_info "Step 2: Installing dependencies..."

if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v npm &> /dev/null; then
    npm install
else
    log_error "npm or pnpm not found. Please install Node.js."
    exit 1
fi

log_success "Dependencies installed!"

# =============================================================================
# Step 3: Generate Prisma Client
# =============================================================================
log_info "Step 3: Generating Prisma Client..."

npx prisma generate

log_success "Prisma Client generated!"

# =============================================================================
# Step 4: Run database migrations
# =============================================================================
log_info "Step 4: Running database migrations..."

npx prisma migrate dev --name init

log_success "Migrations applied!"

# =============================================================================
# Step 5: Seed database (optional)
# =============================================================================
if [ -f "prisma/seed.ts" ]; then
    log_info "Step 5: Seeding database..."
    npx prisma db seed
    log_success "Database seeded!"
else
    log_info "Step 5: No seed file found, skipping..."
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=============================================="
log_success "🎉 Database setup complete!"
echo "=============================================="
echo ""
echo "Services running:"
echo "  - PostgreSQL: localhost:${POSTGRES_PORT}"
echo "  - Redis: localhost:6379"
echo ""
echo "Next steps:"
echo "  1. Review and update .env with your actual values"
echo "  2. Run 'npm run dev' to start the development server"
echo "  3. Run 'npx prisma studio' to view/edit database"
echo ""
echo "Useful commands:"
echo "  - docker-compose logs -f    # View container logs"
echo "  - docker-compose down       # Stop containers"
echo "  - docker-compose up -d      # Start containers"
echo "  - npx prisma studio         # Open Prisma Studio"
echo ""
