#!/bin/bash

# Docker Database Management Script for School Schedule App

set -e

CONTAINER_NAME="school-schedule-postgres"
IMAGE_NAME="school-schedule-db:latest"
COMPOSE_FILE="docker-compose.local.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Build the Docker image
build() {
    log_info "Building PostgreSQL Docker image with migrations..."
    docker build -f Dockerfile.postgres -t $IMAGE_NAME .
    log_success "Docker image built successfully!"
}

# Start the database
start() {
    check_docker
    
    if docker ps | grep -q $CONTAINER_NAME; then
        log_warning "Container $CONTAINER_NAME is already running"
        return 0
    fi
    
    if docker ps -a | grep -q $CONTAINER_NAME; then
        log_info "Starting existing container..."
        docker start $CONTAINER_NAME
    else
        log_info "Starting database with Docker Compose..."
        docker-compose -f $COMPOSE_FILE up -d postgres
    fi
    
    log_info "Waiting for database to be ready..."
    sleep 10
    
    # Wait for health check
    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker exec $CONTAINER_NAME pg_isready -U postgres -d school_schedule > /dev/null 2>&1; then
            log_success "Database is ready!"
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 1
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Database failed to start within expected time"
        exit 1
    fi
    
    log_success "PostgreSQL is running on localhost:5432"
    log_info "Database: school_schedule"
    log_info "User: postgres"
    log_info "Password: postgres"
}

# Stop the database
stop() {
    log_info "Stopping database..."
    docker-compose -f $COMPOSE_FILE down
    log_success "Database stopped"
}

# Restart the database
restart() {
    stop
    start
}

# Show database status
status() {
    if docker ps | grep -q $CONTAINER_NAME; then
        log_success "Database is running"
        docker ps --filter name=$CONTAINER_NAME --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    else
        log_warning "Database is not running"
    fi
}

# Show logs
logs() {
    if docker ps -a | grep -q $CONTAINER_NAME; then
        docker logs -f $CONTAINER_NAME
    else
        log_error "Container $CONTAINER_NAME not found"
    fi
}

# Connect to database with psql
connect() {
    if ! docker ps | grep -q $CONTAINER_NAME; then
        log_error "Database is not running. Start it first with: $0 start"
        exit 1
    fi
    
    log_info "Connecting to database..."
    docker exec -it $CONTAINER_NAME psql -U postgres -d school_schedule
}

# Reset database (rebuild and restart)
reset() {
    log_warning "This will destroy all data and rebuild the database. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log_info "Resetting database..."
        docker-compose -f $COMPOSE_FILE down -v
        build
        start
        log_success "Database reset complete!"
    else
        log_info "Reset cancelled"
    fi
}

# Clean up (remove containers and images)
clean() {
    log_warning "This will remove the container, volumes, and image. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log_info "Cleaning up..."
        docker-compose -f $COMPOSE_FILE down -v --rmi all
        log_success "Cleanup complete!"
    else
        log_info "Cleanup cancelled"
    fi
}

# Run a SQL command
sql() {
    if ! docker ps | grep -q $CONTAINER_NAME; then
        log_error "Database is not running. Start it first with: $0 start"
        exit 1
    fi
    
    if [ -z "$1" ]; then
        log_error "Please provide a SQL command"
        log_info "Example: $0 sql \"SELECT * FROM public.users LIMIT 5;\""
        exit 1
    fi
    
    docker exec $CONTAINER_NAME psql -U postgres -d school_schedule -c "$1"
}

# Show help
help() {
    echo "Docker Database Management Script for School Schedule App"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build     Build the PostgreSQL Docker image with migrations"
    echo "  start     Start the database container"
    echo "  stop      Stop the database container"
    echo "  restart   Restart the database container"
    echo "  status    Show database container status"
    echo "  logs      Show database container logs"
    echo "  connect   Connect to database with psql"
    echo "  reset     Reset database (destroy data and rebuild)"
    echo "  clean     Remove containers, volumes, and images"
    echo "  sql       Run a SQL command"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 build && $0 start    # Build and start database"
    echo "  $0 connect              # Connect with psql"
    echo "  $0 sql \"SELECT COUNT(*) FROM public.classes;\"  # Run SQL"
    echo ""
    echo "Environment:"
    echo "  Copy .env.dockerized to .env.local to use with the app"
}

# Main command dispatcher
case "${1:-help}" in
    build)
        build
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    connect)
        connect
        ;;
    reset)
        reset
        ;;
    clean)
        clean
        ;;
    sql)
        shift
        sql "$@"
        ;;
    help|--help|-h)
        help
        ;;
    *)
        log_error "Unknown command: $1"
        echo ""
        help
        exit 1
        ;;
esac