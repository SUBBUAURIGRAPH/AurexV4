# GitHub CI/CD Setup Script for HMS
# This script helps validate SSH connectivity and prepare for GitHub secrets configuration

param(
    [switch]$GenerateKeys,
    [switch]$TestSSH,
    [switch]$ShowSecrets,
    [switch]$All
)

function Write-Header {
    param([string]$Text)
    Write-Host "`n===== $Text =====" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "✅ $Text" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Text)
    Write-Host "❌ $Text" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Text)
    Write-Host "⚠️ $Text" -ForegroundColor Yellow
}

function Test-SSH-Connection {
    param(
        [string]$Host,
        [string]$User,
        [string]$KeyPath
    )

    Write-Header "Testing SSH Connection"

    if (-not (Test-Path $KeyPath)) {
        Write-Error-Custom "SSH key not found at: $KeyPath"
        return $false
    }

    Write-Host "Testing SSH: ssh -i $KeyPath $User@$Host" -ForegroundColor Gray

    try {
        # Test SSH connection
        $result = ssh -i $KeyPath -o StrictHostKeyChecking=accept-new $User@$Host "echo 'SSH Connection Successful' && uname -s" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "SSH connection successful to $User@$Host"
            Write-Host "System: $result" -ForegroundColor Gray
            return $true
        } else {
            Write-Error-Custom "SSH connection failed: $result"
            return $false
        }
    } catch {
        Write-Error-Custom "SSH error: $_"
        return $false
    }
}

function Get-SSH-PrivateKey {
    param([string]$KeyPath)

    Write-Header "SSH Private Key Content"

    if (-not (Test-Path $KeyPath)) {
        Write-Error-Custom "SSH key not found at: $KeyPath"
        Write-Host "Generate a key with: ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa"
        return ""
    }

    Write-Warning-Custom "⚠️  This will display your private key. Keep it secure!"
    $response = Read-Host "Continue? (yes/no)"

    if ($response -ne "yes") {
        Write-Host "Skipped."
        return ""
    }

    Write-Host "`nCopy the content below to GitHub Secret 'PRODUCTION_SSH_KEY':" -ForegroundColor Yellow
    Write-Host "=" * 60
    Get-Content $KeyPath
    Write-Host "=" * 60

    return Get-Content $KeyPath -Raw
}

function Generate-SSH-Keys {
    param([string]$Name = "hms-deploy")

    Write-Header "Generating SSH Keys"

    $keyPath = "$HOME\.ssh\$Name"

    if (Test-Path "$keyPath") {
        Write-Warning-Custom "SSH key already exists at: $keyPath"
        return
    }

    Write-Host "Generating RSA key pair..." -ForegroundColor Gray

    try {
        # Windows with OpenSSH
        ssh-keygen -t rsa -b 4096 -f $keyPath -N "" -C "HMS CI/CD"
        Write-Success "SSH keys generated:"
        Write-Host "  Private: $keyPath" -ForegroundColor Gray
        Write-Host "  Public: $keyPath.pub" -ForegroundColor Gray

        # Display public key (safe to share)
        Write-Host "`nPublic key (safe to share):" -ForegroundColor Yellow
        Get-Content "$keyPath.pub"

    } catch {
        Write-Error-Custom "Failed to generate keys: $_"
    }
}

function Validate-GitHub-Setup {
    Write-Header "GitHub CI/CD Setup Validation"

    Write-Host "Checking GitHub repository..."

    try {
        # Check if git is installed
        $gitVersion = git --version 2>&1
        Write-Success "Git installed: $gitVersion"

        # Check current repository
        $origin = git remote get-url origin 2>&1
        if ($origin -like "*glowing-adventure*" -or $origin -like "*HMS*") {
            Write-Success "Repository configured: $origin"
        } else {
            Write-Warning-Custom "Repository: $origin"
        }

        # Check workflow files
        $workflowPath = ".github\workflows"
        if (Test-Path $workflowPath) {
            Write-Success "Workflow directory exists"
            Get-ChildItem $workflowPath -Filter "*.yml" | ForEach-Object {
                Write-Host "  • $($_.Name)" -ForegroundColor Gray
            }
        } else {
            Write-Error-Custom "Workflow directory not found"
        }

    } catch {
        Write-Warning-Custom "Unable to validate: $_"
    }
}

function Show-GitHub-Secrets-Checklist {
    Write-Header "GitHub Secrets Checklist"

    Write-Host "`n📋 Add these secrets to GitHub (Settings → Secrets and variables → Actions):`n" -ForegroundColor Cyan

    $secrets = @(
        @{Name = "PRODUCTION_SSH_KEY"; Type = "Private Key"; Example = "-----BEGIN RSA PRIVATE KEY-----..."; Required = $true},
        @{Name = "PRODUCTION_HOST"; Type = "Hostname"; Example = "hms.aurex.in"; Required = $true},
        @{Name = "PRODUCTION_USER"; Type = "Username"; Example = "subbu"; Required = $true},
        @{Name = "STAGING_SSH_KEY"; Type = "Private Key"; Example = "Same as PRODUCTION_SSH_KEY"; Required = $true},
        @{Name = "STAGING_HOST"; Type = "Hostname"; Example = "hms.aurex.in"; Required = $true},
        @{Name = "STAGING_USER"; Type = "Username"; Example = "subbu"; Required = $true},
        @{Name = "SLACK_WEBHOOK"; Type = "URL"; Example = "https://hooks.slack.com/services/..."; Required = $true},
        @{Name = "SNYK_TOKEN"; Type = "API Token"; Example = "Optional"; Required = $false},
        @{Name = "SONAR_TOKEN"; Type = "API Token"; Example = "Optional"; Required = $false}
    )

    $num = 1
    foreach ($secret in $secrets) {
        $req = if ($secret.Required) { "[REQUIRED]" } else { "[OPTIONAL]" }
        Write-Host "$num. $($secret.Name) $req" -ForegroundColor $(if($secret.Required) {"Yellow"} else {"Gray"})
        Write-Host "   Type: $($secret.Type)" -ForegroundColor Gray
        Write-Host "   Example: $($secret.Example)" -ForegroundColor Gray
        $num++
    }

    Write-Host "`n📚 Steps:" -ForegroundColor Cyan
    Write-Host "1. Go to: https://github.com/Aurigraph-DLT-Corp/glowing-adventure/settings/secrets/actions"
    Write-Host "2. Click 'New repository secret'"
    Write-Host "3. Enter secret name and value"
    Write-Host "4. Click 'Add secret'"
    Write-Host "5. Repeat for each secret"
}

function Show-Workflow-Status {
    Write-Header "Workflow Files Status"

    $workflows = @(
        "test-and-build.yml",
        "deploy.yml",
        "security-and-updates.yml"
    )

    foreach ($workflow in $workflows) {
        $path = ".github\workflows\$workflow"
        if (Test-Path $path) {
            Write-Success "$workflow exists"
            $size = (Get-Item $path).Length / 1024
            Write-Host "  Size: $([Math]::Round($size, 1)) KB" -ForegroundColor Gray
        } else {
            Write-Error-Custom "$workflow NOT FOUND"
        }
    }
}

# Main execution
if ($All) {
    $GenerateKeys = $true
    $TestSSH = $true
    $ShowSecrets = $true
}

if (-not ($GenerateKeys -or $TestSSH -or $ShowSecrets -or $All)) {
    Write-Host "GitHub CI/CD Setup Script - HMS" -ForegroundColor Cyan
    Write-Host "================================`n"

    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\setup-github-cicd.ps1 -GenerateKeys     Generate new SSH keys"
    Write-Host "  .\setup-github-cicd.ps1 -TestSSH          Test SSH connection to production"
    Write-Host "  .\setup-github-cicd.ps1 -ShowSecrets       Show secrets checklist"
    Write-Host "  .\setup-github-cicd.ps1 -All               Run all checks`n"

    Write-Host "Examples:"
    Write-Host "  .\setup-github-cicd.ps1 -All"
    Write-Host "  .\setup-github-cicd.ps1 -TestSSH -ShowSecrets"

    Validate-GitHub-Setup
    Show-Workflow-Status
    exit 0
}

if ($GenerateKeys) {
    Generate-SSH-Keys
}

if ($TestSSH) {
    $keyPath = "$HOME\.ssh\id_rsa"
    if (-not (Test-Path $keyPath)) {
        Write-Error-Custom "SSH key not found at $keyPath"
        Write-Host "Run with -GenerateKeys first, or check your SSH key location"
    } else {
        Test-SSH-Connection -Host "hms.aurex.in" -User "subbu" -KeyPath $keyPath
    }
}

if ($ShowSecrets) {
    Show-GitHub-Secrets-Checklist
}

Write-Host "`n✅ Setup script complete!" -ForegroundColor Green
Write-Host "📖 For detailed instructions, see: GITHUB_CICD_SETUP_GUIDE.md`n"
