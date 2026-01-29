#!/bin/bash
################################################################################
# AUREX AUTONOMOUS EMERGENCY RECOVERY SYSTEM
################################################################################

set +e

PROJECT_DIR="$HOME/Aurex"
LOG_FILE="/var/log/aurex-recovery.log"
LOCK_FILE="/tmp/aurex-recovery.lock"
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
            return 1
        fi
        rm -f "$LOCK_FILE"
    fi
    touch "$LOCK_FILE"
    return 0
}

release_lock() { rm -f "$LOCK_FILE"; }
trap release_lock EXIT

detect_port_conflicts() {
    for port in 3000 8000 6379 5432 8080 8180 5001 5002; do
        sudo lsof -i :$port -n -P 2>/dev/null | grep LISTEN > /dev/null && echo "$port"
    done
}

detect_container_failures() {
    cd "$PROJECT_DIR" || return 1
    docker compose ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | grep -E "Exited|not-found" | awk '{print $1}'
}

detect_connectivity_issues() {
    local frontend=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null)
    local backend=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8000/ 2>/dev/null)
    [ "$frontend" != "200" ] || [ "$backend" != "200" ]
}

kill_port_processes() {
    local port=$1
    local pid=$(sudo lsof -i :$port -n -P 2>/dev/null | grep LISTEN | awk '{print $2}' | head -1)
    [ -n "$pid" ] && sudo kill -9 "$pid" 2>/dev/null
    sleep 2
}

perform_recovery() {
    for attempt in $(seq 1 $MAX_RECOVERY_ATTEMPTS); do
        log INFO "Recovery attempt $attempt"
        for port in $(detect_port_conflicts); do kill_port_processes "$port"; done
        
        if [ -n "$(detect_container_failures)" ]; then
            cd "$PROJECT_DIR" || continue
            docker compose restart 2>&1 | tee -a "$LOG_FILE"
            sleep 10
            if [ -n "$(detect_container_failures)" ]; then
                docker compose down -v --remove-orphans 2>/dev/null || true
                docker system prune -af --volumes 2>/dev/null || true
                docker compose up -d 2>/dev/null
                sleep 30
            fi
        fi
        
        local timeout=120
        local elapsed=0
        while [ $elapsed -lt $timeout ]; do
            local frontend=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
            local backend=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/ 2>/dev/null)
            [ "$frontend" = "200" ] && [ "$backend" = "200" ] && { log SUCCESS "✅ Healthy!"; return 0; }
            sleep 10
            elapsed=$((elapsed + 10))
        done
    done
    
    log ERROR "❌ Recovery failed"
    return 1
}

main() {
    log INFO "AUREX RECOVERY STARTED"
    [ ! -d "$PROJECT_DIR" ] && { log ERROR "Project not found"; return 1; }
    acquire_lock || return 0
    
    if [ -z "$(detect_port_conflicts)" ] && [ -z "$(detect_container_failures)" ] && ! detect_connectivity_issues; then
        log SUCCESS "✅ System healthy"
        return 0
    fi
    
    log WARNING "Issues detected"
    perform_recovery
}

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && main && exit 0 || exit 1
