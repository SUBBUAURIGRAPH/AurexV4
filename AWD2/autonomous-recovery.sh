#!/bin/bash
################################################################################
# AWD2 (ARAGON WEB3 DeFi) AUTONOMOUS EMERGENCY RECOVERY SYSTEM
################################################################################

set +e

PROJECT_DIR="$HOME/AWD2"
LOG_FILE="/var/log/awd2-recovery.log"
LOCK_FILE="/tmp/awd2-recovery.lock"
RECOVERY_LOCK_TIMEOUT=300
MAX_RECOVERY_ATTEMPTS=3

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    case $level in
        INFO) echo -e "${BLUE}[INFO]${NC} $message" ;;
        SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
        WARNING) echo -e "${YELLOW}[WARNING]${NC} $message" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $message" ;;
    esac
}

acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_age=$(($(date +%s) - $(stat -c%Y "$LOCK_FILE" 2>/dev/null || stat -f%m "$LOCK_FILE" 2>/dev/null || echo 0)))
        if [ "$lock_age" -lt "$RECOVERY_LOCK_TIMEOUT" ]; then
            log WARNING "Recovery already in progress (lock age: ${lock_age}s). Skipping."
            return 1
        else
            rm -f "$LOCK_FILE"
        fi
    fi
    touch "$LOCK_FILE"
    return 0
}

release_lock() {
    rm -f "$LOCK_FILE"
}

trap release_lock EXIT

detect_port_conflicts() {
    for port in 3000 8000 6379 5432 8080 8180 5001; do
        if sudo lsof -i :$port -n -P 2>/dev/null | grep LISTEN > /dev/null; then
            echo "$port"
        fi
    done
}

detect_container_failures() {
    cd "$PROJECT_DIR" || return 1
    docker compose ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | grep -E "Exited|not-found" | awk '{print $1}'
}

detect_connectivity_issues() {
    local frontend_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null)
    local backend_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8000/ 2>/dev/null)
    if [ "$frontend_status" != "200" ] || [ "$backend_status" != "200" ]; then
        return 0
    fi
    return 1
}

kill_port_processes() {
    local port=$1
    log INFO "Freeing port $port..."
    local pid=$(sudo lsof -i :$port -n -P 2>/dev/null | grep LISTEN | awk '{print $2}' | head -1)
    [ -n "$pid" ] && sudo kill -9 "$pid" 2>/dev/null || true
    sleep 2
    if ! sudo lsof -i :$port 2>/dev/null | grep LISTEN > /dev/null; then
        log SUCCESS "Port $port freed"
        return 0
    fi
    log ERROR "Port $port still in use"
    return 1
}

emergency_cleanup() {
    log WARNING "Emergency Docker cleanup..."
    cd "$PROJECT_DIR" || return 1
    docker compose down -v --remove-orphans 2>/dev/null || true
    sleep 2
    sudo killall -9 redis-server postgres nginx 2>/dev/null || true
    sleep 2
    docker system prune -af --volumes 2>/dev/null || true
    log SUCCESS "Cleanup completed"
    return 0
}

restart_services() {
    log INFO "Restarting services..."
    cd "$PROJECT_DIR" || return 1
    docker compose up -d 2>&1 | tee -a "$LOG_FILE"
    sleep 30
    return 0
}

wait_for_health() {
    local timeout=120
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        local frontend=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
        local backend=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/ 2>/dev/null)
        if [ "$frontend" = "200" ] && [ "$backend" = "200" ]; then
            log SUCCESS "Services healthy!"
            return 0
        fi
        sleep 10
        elapsed=$((elapsed + 10))
    done
    log WARNING "Services not healthy after timeout"
    return 1
}

perform_recovery() {
    for attempt in $(seq 1 $MAX_RECOVERY_ATTEMPTS); do
        log INFO "Recovery attempt $attempt/$MAX_RECOVERY_ATTEMPTS"
        
        for port in $(detect_port_conflicts); do
            kill_port_processes "$port" || true
        done
        
        if [ -n "$(detect_container_failures)" ]; then
            cd "$PROJECT_DIR" || return 1
            docker compose restart 2>&1 | tee -a "$LOG_FILE"
            sleep 10
            if [ -n "$(detect_container_failures)" ]; then
                emergency_cleanup || continue
                restart_services || continue
            fi
        fi
        
        if detect_connectivity_issues; then
            wait_for_health || continue
        fi
        
        if [ -z "$(detect_port_conflicts)" ] && [ -z "$(detect_container_failures)" ] && ! detect_connectivity_issues; then
            log SUCCESS "✅ System operational!"
            return 0
        fi
    done
    
    log ERROR "❌ Recovery failed"
    return 1
}

main() {
    log INFO "=========================================="
    log INFO "AWD2 AUTONOMOUS RECOVERY STARTED"
    log INFO "=========================================="
    
    [ ! -d "$PROJECT_DIR" ] && { log ERROR "Project dir not found"; return 1; }
    
    acquire_lock || return 0
    
    if [ -z "$(detect_port_conflicts)" ] && [ -z "$(detect_container_failures)" ] && ! detect_connectivity_issues; then
        log SUCCESS "✅ System healthy"
        return 0
    fi
    
    log WARNING "⚠️ Issues detected. Starting recovery..."
    perform_recovery
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && main && exit 0 || exit 1
