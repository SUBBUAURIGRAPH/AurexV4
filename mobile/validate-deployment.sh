#!/bin/bash

# HMS Mobile Trading Platform - Deployment Validation Script
# This script validates the Docker deployment configuration and readiness

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Functions
check_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
    ((WARNINGS++))
}

# Header
echo "=========================================="
echo "HMS Mobile Trading Platform"
echo "Deployment Validation Script"
echo "=========================================="
echo ""

# Section 1: System Requirements
echo "--- 1. System Requirements ---"

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | grep -o "version [^ ]*" | cut -d' ' -f2)
    check_pass "Docker installed: $DOCKER_VERSION"
else
    check_fail "Docker not installed"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    DC_VERSION=$(docker-compose --version | grep -o "version [^ ]*" | cut -d' ' -f2)
    check_pass "Docker Compose installed: $DC_VERSION"
else
    check_fail "Docker Compose not installed"
fi

# Check Docker daemon
if docker info &> /dev/null; then
    check_pass "Docker daemon is running"
else
    check_fail "Docker daemon is not running"
fi

echo ""

# Section 2: SSL Certificates
echo "--- 2. SSL Certificates ---"

if [ -f "/etc/letsencrypt/live/aurexcrt1/fullchain.pem" ]; then
    check_pass "SSL certificate (fullchain.pem) found"
    
    # Check expiration
    EXPIRY_DATE=$(openssl x509 -in /etc/letsencrypt/live/aurexcrt1/fullchain.pem -noout -enddate | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
    
    if [ $DAYS_LEFT -gt 30 ]; then
        check_pass "SSL certificate is valid for $DAYS_LEFT days"
    elif [ $DAYS_LEFT -gt 0 ]; then
        check_warn "SSL certificate expires in $DAYS_LEFT days"
    else
        check_fail "SSL certificate is expired"
    fi
else
    check_fail "SSL certificate (fullchain.pem) not found at /etc/letsencrypt/live/aurexcrt1/"
fi

if [ -f "/etc/letsencrypt/live/aurexcrt1/privkey.pem" ]; then
    check_pass "SSL private key (privkey.pem) found"
else
    check_fail "SSL private key (privkey.pem) not found"
fi

echo ""

# Section 3: Docker Image
echo "--- 3. Docker Image ---"

if docker image inspect hms-web:latest &> /dev/null; then
    check_pass "Docker image (hms-web:latest) found"
    
    # Get image size
    IMG_SIZE=$(docker image inspect hms-web:latest --format='{{.Size}}')
    IMG_SIZE_MB=$(( IMG_SIZE / 1024 / 1024 ))
    check_pass "Image size: ${IMG_SIZE_MB}MB"
    
    # Check image ports
    if docker inspect hms-web:latest --format='{{json .Config.ExposedPorts}}' | grep -q "80"; then
        check_pass "Port 80 exposed"
    else
        check_warn "Port 80 not exposed in image"
    fi
    
    if docker inspect hms-web:latest --format='{{json .Config.ExposedPorts}}' | grep -q "443"; then
        check_pass "Port 443 exposed"
    else
        check_warn "Port 443 not exposed in image"
    fi
else
    check_fail "Docker image (hms-web:latest) not found"
    echo "Build with: docker build -t hms-web:latest mobile/"
fi

echo ""

# Section 4: Configuration Files
echo "--- 4. Configuration Files ---"

if [ -f "mobile/docker-compose.yml" ]; then
    check_pass "docker-compose.yml found"
else
    check_fail "docker-compose.yml not found"
fi

if [ -f "mobile/nginx.conf" ]; then
    check_pass "nginx.conf found"
    
    # Validate nginx config syntax
    if docker run --rm -v "$(pwd)/mobile/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:alpine nginx -t 2>/dev/null; then
        check_pass "nginx.conf syntax is valid"
    else
        check_warn "Unable to validate nginx.conf syntax"
    fi
else
    check_fail "nginx.conf not found"
fi

if [ -f "mobile/Dockerfile" ]; then
    check_pass "Dockerfile found"
    
    # Check Dockerfile for key elements
    if grep -q "FROM nginx:alpine" "mobile/Dockerfile"; then
        check_pass "Dockerfile uses nginx:alpine base"
    else
        check_warn "Dockerfile uses non-standard base image"
    fi
else
    check_fail "Dockerfile not found"
fi

echo ""

# Section 5: Network Connectivity
echo "--- 5. Network Connectivity ---"

# Check if ports are available
if ! lsof -i :80 &> /dev/null; then
    check_pass "Port 80 is available"
else
    check_warn "Port 80 is already in use"
fi

if ! lsof -i :443 &> /dev/null; then
    check_pass "Port 443 is available"
else
    check_warn "Port 443 is already in use"
fi

# Check backend API connectivity
if timeout 5 bash -c 'echo > /dev/tcp/apihms.aurex.in/443' 2>/dev/null; then
    check_pass "Backend API (apihms.aurex.in:443) is reachable"
else
    check_warn "Cannot reach backend API (apihms.aurex.in:443) - may be network/DNS issue"
fi

echo ""

# Section 6: Docker Compose Configuration
echo "--- 6. Docker Compose Configuration ---"

if [ -f "mobile/docker-compose.yml" ]; then
    cd mobile
    
    if docker-compose config > /dev/null 2>&1; then
        check_pass "docker-compose.yml is valid"
    else
        check_fail "docker-compose.yml syntax error"
    fi
    
    cd ..
fi

echo ""

# Section 7: Deployment Status
echo "--- 7. Deployment Status ---"

if docker ps 2>/dev/null | grep -q "hms-mobile-web"; then
    check_pass "hms-mobile-web container is running"
    
    # Check health
    HEALTH=$(docker inspect hms-mobile-web --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")
    if [ "$HEALTH" = "healthy" ]; then
        check_pass "Container health status: HEALTHY"
    elif [ "$HEALTH" = "starting" ]; then
        check_warn "Container health status: STARTING (wait 10-40 seconds)"
    else
        check_fail "Container health status: $HEALTH"
    fi
else
    check_warn "hms-mobile-web container is not running"
fi

echo ""

# Section 8: Space Requirements
echo "--- 8. Disk Space ---"

REQUIRED_SPACE_MB=500
AVAILABLE_SPACE=$(df -m . | tail -1 | awk '{print $4}')

if [ $AVAILABLE_SPACE -gt $REQUIRED_SPACE_MB ]; then
    check_pass "Available disk space: ${AVAILABLE_SPACE}MB (required: ${REQUIRED_SPACE_MB}MB)"
else
    check_fail "Insufficient disk space: ${AVAILABLE_SPACE}MB (required: ${REQUIRED_SPACE_MB}MB)"
fi

echo ""

# Summary
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Deployment is ready${NC}"
    echo ""
    echo "Next steps:"
    echo "1. cd mobile/"
    echo "2. docker-compose up -d"
    echo "3. docker-compose logs -f hms-mobile-web"
    echo "4. curl -k https://localhost/"
    exit 0
else
    echo -e "${RED}✗ Deployment has critical issues${NC}"
    echo ""
    echo "Please fix the FAIL items above before deploying"
    exit 1
fi
