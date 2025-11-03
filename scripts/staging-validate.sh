#!/bin/bash

#############################################
# HERMES HF - STAGING VALIDATION SCRIPT
# Purpose: Comprehensive staging deployment validation
# Usage: ./scripts/staging-validate.sh
#############################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_NAME="hermes-hf"
COMPOSE_FILE="docker-compose-staging.yml"
STAGING_URL="${STAGING_URL:-http://localhost}"
TIMEOUT=30

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

#############################################
# UTILITY FUNCTIONS
#############################################

check_start() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -e "${BLUE}[CHECK $TOTAL_CHECKS]${NC} $1"
}

check_pass() {
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    echo -e "${GREEN}  ✓ PASS${NC} $1"
}

check_fail() {
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    echo -e "${RED}  ✗ FAIL${NC} $1"
}

check_warn() {
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
    echo -e "${YELLOW}  ⚠ WARN${NC} $1"
}

print_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

print_summary() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}VALIDATION SUMMARY${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "Total Checks:  $TOTAL_CHECKS"
    echo -e "Passed:        ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "Failed:        ${RED}$FAILED_CHECKS${NC}"
    echo -e "Warnings:      ${YELLOW}$WARNING_CHECKS${NC}"
    echo ""

    if [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "${GREEN}✅ All critical checks passed!${NC}"
        return 0
    else
        echo -e "${RED}❌ $FAILED_CHECKS checks failed${NC}"
        return 1
    fi
}

#############################################
# DOCKER CHECKS
#############################################

validate_docker_containers() {
    print_header "DOCKER CONTAINER CHECKS"

    # Check Docker daemon
    check_start "Docker daemon running"
    if docker info > /dev/null 2>&1; then
        check_pass "Docker daemon is running"
    else
        check_fail "Docker daemon is not running"
        return
    fi

    # Check containers exist
    check_start "Staging containers exist"
    local containers=$(docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps --services 2>/dev/null | wc -l)
    if [ "$containers" -gt 0 ]; then
        check_pass "Found $containers containers defined"
    else
        check_fail "No containers found"
        return
    fi

    # Check container status
    check_start "All containers are running"
    local running=$(docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps --services --filter "status=running" 2>/dev/null | wc -l)
    local expected=$containers
    if [ "$running" -eq "$expected" ]; then
        check_pass "All $running containers are running"
    else
        check_fail "$running/$expected containers are running"
    fi

    # Check for container errors
    check_start "No container restart loops"
    local restarts=$(docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps 2>/dev/null | grep -c "Restarting" || true)
    if [ "$restarts" -eq 0 ]; then
        check_pass "No containers in restart loop"
    else
        check_fail "$restarts containers are restarting"
    fi
}

#############################################
# SERVICE HEALTH CHECKS
#############################################

validate_api_service() {
    print_header "API SERVICE CHECKS"

    local port=3001
    local endpoint="http://localhost:$port/health"

    # Check port is open
    check_start "API port $port is listening"
    if netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "; then
        check_pass "API port $port is listening"
    else
        check_warn "Could not verify port $port (netstat/ss not available)"
    fi

    # Check health endpoint
    check_start "API health endpoint responding"
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$endpoint" 2>/dev/null || echo "000")
    if [ "$response" = "200" ] || [ "$response" = "201" ]; then
        check_pass "Health endpoint returned $response"
    else
        check_fail "Health endpoint returned $response"
    fi

    # Check API is serving requests
    check_start "API can process requests"
    local response=$(curl -s --max-time 5 "$endpoint" 2>/dev/null | grep -c "status" || echo "0")
    if [ "$response" -gt 0 ]; then
        check_pass "API response contains expected data"
    else
        check_fail "API response missing expected data"
    fi

    # Check API response time
    check_start "API response time is acceptable"
    local response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time 5 "$endpoint" 2>/dev/null || echo "999")
    if (( $(echo "$response_time < 2.0" | bc -l) )); then
        check_pass "Response time: ${response_time}s"
    else
        check_warn "Response time is slow: ${response_time}s"
    fi
}

validate_database_service() {
    print_header "DATABASE SERVICE CHECKS"

    # Check PostgreSQL is running
    check_start "PostgreSQL container is running"
    if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps postgres 2>/dev/null | grep -q "Up"; then
        check_pass "PostgreSQL is running"
    else
        check_fail "PostgreSQL is not running"
        return
    fi

    # Check database connectivity
    check_start "Database is accepting connections"
    if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T postgres pg_isready -U postgres &>/dev/null; then
        check_pass "Database connection successful"
    else
        check_fail "Cannot connect to database"
        return
    fi

    # Check database exists
    check_start "Database 'hermes_db' exists"
    if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T postgres \
        psql -U postgres -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw hermes_db; then
        check_pass "Database 'hermes_db' exists"
    else
        check_warn "Database 'hermes_db' not found"
    fi

    # Check database size
    check_start "Database has reasonable size"
    local db_size=$(docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T postgres \
        psql -U postgres -d hermes_db -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) AS size FROM pg_database;" 2>/dev/null | grep hermes_db | awk '{print $2}' || echo "0B")
    check_pass "Database size: $db_size"
}

validate_redis_service() {
    print_header "REDIS SERVICE CHECKS"

    # Check Redis is running
    check_start "Redis container is running"
    if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps redis 2>/dev/null | grep -q "Up"; then
        check_pass "Redis is running"
    else
        check_fail "Redis is not running"
        return
    fi

    # Check Redis connectivity
    check_start "Redis is accepting connections"
    if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        check_pass "Redis connection successful"
    else
        check_fail "Cannot connect to Redis"
        return
    fi

    # Check Redis memory
    check_start "Redis memory usage"
    local memory=$(docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T redis \
        redis-cli info memory 2>/dev/null | grep used_memory_human | cut -d':' -f2 || echo "unknown")
    check_pass "Redis memory: $memory"
}

validate_prometheus_service() {
    print_header "PROMETHEUS SERVICE CHECKS"

    # Check Prometheus is running
    check_start "Prometheus container is running"
    if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps prometheus 2>/dev/null | grep -q "Up"; then
        check_pass "Prometheus is running"
    else
        check_warn "Prometheus is not running"
        return
    fi

    # Check Prometheus health
    check_start "Prometheus is accepting connections"
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:9090/-/healthy" 2>/dev/null || echo "000")
    if [ "$response" = "200" ]; then
        check_pass "Prometheus health check passed"
    else
        check_warn "Prometheus health check returned $response"
    fi

    # Check metrics
    check_start "Prometheus is collecting metrics"
    local metrics=$(curl -s --max-time 5 "http://localhost:9090/api/v1/query?query=up" 2>/dev/null | grep -o "value" | wc -l || echo "0")
    if [ "$metrics" -gt 0 ]; then
        check_pass "Prometheus is collecting metrics ($metrics found)"
    else
        check_warn "No metrics found in Prometheus"
    fi
}

validate_grafana_service() {
    print_header "GRAFANA SERVICE CHECKS"

    # Check Grafana is running
    check_start "Grafana container is running"
    if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps grafana 2>/dev/null | grep -q "Up"; then
        check_pass "Grafana is running"
    else
        check_warn "Grafana is not running"
        return
    fi

    # Check Grafana health
    check_start "Grafana is accepting connections"
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:3000/api/health" 2>/dev/null || echo "000")
    if [ "$response" = "200" ]; then
        check_pass "Grafana health check passed"
    else
        check_warn "Grafana health check returned $response"
    fi
}

#############################################
# ENVIRONMENT & CONFIGURATION CHECKS
#############################################

validate_environment() {
    print_header "ENVIRONMENT CONFIGURATION CHECKS"

    # Check .env file exists
    check_start "Environment file exists"
    if [ -f ".env" ]; then
        check_pass "Environment file found"
    else
        check_fail "Environment file not found"
        return
    fi

    # Check required variables
    check_start "Required environment variables are set"
    local required_vars=("NODE_ENV" "DB_HOST" "DB_PORT" "REDIS_URL" "JWT_SECRET")
    local missing=0

    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" ".env"; then
            check_fail "Missing variable: $var"
            missing=1
        fi
    done

    if [ $missing -eq 0 ]; then
        check_pass "All required variables are set"
    fi

    # Check NODE_ENV is staging
    check_start "NODE_ENV is set to 'staging'"
    if grep -q "NODE_ENV=staging" ".env"; then
        check_pass "NODE_ENV is correctly set to staging"
    else
        check_warn "NODE_ENV is not set to staging"
    fi
}

#############################################
# NETWORK & CONNECTIVITY CHECKS
#############################################

validate_network() {
    print_header "NETWORK & CONNECTIVITY CHECKS"

    # Check local DNS resolution
    check_start "DNS resolution working"
    if nslookup localhost &>/dev/null || getent hosts localhost &>/dev/null; then
        check_pass "DNS resolution working"
    else
        check_warn "DNS resolution check failed"
    fi

    # Check localhost connectivity
    check_start "Localhost port connectivity"
    if nc -z localhost 3001 2>/dev/null || timeout 1 bash -c "cat < /dev/null > /dev/tcp/127.0.0.1/3001" 2>/dev/null; then
        check_pass "Can connect to API port"
    else
        check_fail "Cannot connect to API port"
    fi

    # Check Docker network
    check_start "Docker networks configured"
    if docker network ls 2>/dev/null | grep -q "hms-network"; then
        check_pass "Docker network 'hms-network' exists"
    else
        check_warn "Docker network 'hms-network' not found"
    fi
}

#############################################
# PERFORMANCE CHECKS
#############################################

validate_performance() {
    print_header "PERFORMANCE CHECKS"

    # Check disk space
    check_start "Sufficient disk space available"
    local available=$(df /tmp 2>/dev/null | awk 'NR==2 {print $4}' || echo "unknown")
    if [ "$available" != "unknown" ] && [ "$available" -gt 1048576 ]; then
        check_pass "Disk space available: $(numfmt --to=iec $available 2>/dev/null || echo $available) KB"
    else
        check_warn "Could not determine disk space"
    fi

    # Check system resources
    check_start "System resource availability"
    local load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
    if (( $(echo "$load < 5.0" | bc -l) )); then
        check_pass "System load average: $load"
    else
        check_warn "System load is high: $load"
    fi

    # Check Docker resources
    check_start "Docker resource usage"
    local memory=$(docker stats --no-stream --format "table {{.MemUsage}}" 2>/dev/null | tail -n +2 | head -1 || echo "unknown")
    check_pass "Docker memory usage: $memory"
}

#############################################
# MAIN VALIDATION FLOW
#############################################

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  HERMES HF - STAGING DEPLOYMENT VALIDATION SUITE      ║${NC}"
echo -e "${CYAN}║  Generated: $(date '+%Y-%m-%d %H:%M:%S')                       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"

# Run all validation checks
validate_docker_containers
validate_api_service
validate_database_service
validate_redis_service
validate_prometheus_service
validate_grafana_service
validate_environment
validate_network
validate_performance

# Print summary
print_summary

# Return appropriate exit code
if [ $FAILED_CHECKS -eq 0 ]; then
    exit 0
else
    exit 1
fi
