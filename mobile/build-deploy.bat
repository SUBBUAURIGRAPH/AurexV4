@echo off
REM ============================================================================
REM HMS Mobile Trading Platform - Build and Deploy Script (Windows)
REM ============================================================================

setlocal enabledelayedexpansion

REM Color codes for output
for /F %%A in ('echo prompt $H ^| cmd') do set "BS=%%A"

REM Configuration
set REMOTE_USER=subbu
set REMOTE_HOST=hms.aurex.in
set REMOTE_WORKDIR=/opt/HMS
set GITHUB_REPO=git@github.com:Aurigraph-DLT-Corp/HMS.git
set GITHUB_BRANCH=main
set IMAGE_NAME=hms-mobile-web
set IMAGE_TAG=latest
set CONTAINER_NAME=hms-mobile-web
set SSH_KEY=%USERPROFILE%\.ssh\id_rsa

echo.
echo ============================================================================
echo  HMS Mobile Trading Platform - Build and Deploy
echo ============================================================================
echo.

REM Check if Docker is installed
echo [*] Checking Docker installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [!] Docker is not installed. Please install Docker Desktop for Windows.
    exit /b 1
)
echo [+] Docker found:
docker --version
echo.

REM Check if Git is installed
echo [*] Checking Git installation...
git --version >nul 2>&1
if errorlevel 1 (
    echo [!] Git is not installed. Please install Git.
    exit /b 1
)
echo [+] Git found:
git --version
echo.

REM Check if SSH is available
echo [*] Checking SSH availability...
ssh -V >nul 2>&1
if errorlevel 1 (
    echo [!] SSH is not available. Please ensure Git Bash or WSL is installed.
    exit /b 1
)
echo [+] SSH found:
ssh -V
echo.

REM Git operations
echo ============================================================================
echo [*] Git Operations
echo ============================================================================
echo.

echo [*] Checking git status...
git status --short
echo.

echo [*] Adding all changes...
git add .
echo [+] Changes staged

echo [*] Committing changes...
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set mydate=%%c%%a%%b
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do set mytime=%%a%%b
git commit -m "Deploy: HMS Mobile Web %mydate% %mytime%" || echo [*] No changes to commit
echo [+] Committed to Git

echo [*] Pushing to GitHub...
git push origin %GITHUB_BRANCH%
echo [+] Pushed to GitHub branch: %GITHUB_BRANCH%
echo.

REM Docker build
echo ============================================================================
echo [*] Building Docker Image
echo ============================================================================
echo.

echo [*] Building Docker image: %IMAGE_NAME%:%IMAGE_TAG%
docker build -t %IMAGE_NAME%:%IMAGE_TAG% -f mobile\Dockerfile .
if errorlevel 1 (
    echo [!] Docker build failed
    exit /b 1
)
echo [+] Docker image built successfully
echo.

echo [*] Displaying image information...
docker images | findstr %IMAGE_NAME%
echo.

REM Display deployment instructions
echo ============================================================================
echo [+] Build Complete - Ready for Deployment
echo ============================================================================
echo.

echo Deployment Instructions:
echo.
echo 1. Linux/Mac/WSL - Run the deployment script:
echo    bash mobile/deploy.sh
echo.
echo 2. Manual deployment steps:
echo    a. Connect to remote server:
echo       ssh %REMOTE_USER%@%REMOTE_HOST%
echo.
echo    b. Navigate to working directory:
echo       cd %REMOTE_WORKDIR%
echo.
echo    c. Pull latest changes:
echo       git pull origin %GITHUB_BRANCH%
echo.
echo    d. Stop and remove old containers:
echo       cd mobile
echo       docker-compose down
echo       docker container prune -f
echo       docker image prune -f
echo.
echo    e. Build and start new containers:
echo       docker-compose up -d --build
echo.
echo    f. Check status:
echo       docker-compose ps
echo       docker-compose logs -f
echo.
echo 3. Verify deployment:
echo    - Frontend: https://%REMOTE_HOST%
echo    - Backend: https://apihms.aurex.in
echo    - WebSocket: wss://apihms.aurex.in
echo.

echo ============================================================================
echo [+] Deployment Ready
echo ============================================================================
echo.

pause
