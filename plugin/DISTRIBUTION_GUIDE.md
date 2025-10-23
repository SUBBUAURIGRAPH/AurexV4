# J4C Plugin Distribution Guide

## Overview

The Jeeves4Coder (J4C) plugin is distributed across multiple channels for flexibility and accessibility. This guide covers all distribution methods, installation procedures, and verification steps.

## Distribution Channels

### 1. npm Registries

#### Internal npm Registry (Primary)
```bash
npm install @aurigraph/jeeves4coder-plugin \
  --registry https://npm.aurigraph.io
```

**Features:**
- Restricted access (team members only)
- Latest stable versions
- Full feature support
- Priority support

**Requirements:**
```bash
# Configure npm token
npm config set //npm.aurigraph.io/:_authToken=$INTERNAL_NPM_TOKEN

# Or use .npmrc
echo "//npm.aurigraph.io/:_authToken=your-token-here" >> ~/.npmrc
```

#### GitHub Packages
```bash
npm install @aurigraph-dlt-corp/jeeves4coder-plugin \
  --registry https://npm.pkg.github.com
```

**Features:**
- GitHub-integrated distribution
- Personal access token authentication
- Works with GitHub Actions
- Package insights

**Setup:**
```bash
# Create personal access token with:
# - read:packages (download)
# - write:packages (if publishing)
# - delete:packages (if managing)

# Configure npm
npm config set //npm.pkg.github.com/:_authToken=$GITHUB_TOKEN

# Or use .npmrc
echo "//npm.pkg.github.com/:_authToken=your-token-here" >> ~/.npmrc
```

### 2. Docker Registries

#### GitHub Container Registry (ghcr.io)
```bash
# Pull image
docker pull ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0

# Run container
docker run -it ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0
```

**Features:**
- GitHub-integrated container registry
- Automatic image scanning
- GitHub Actions integration
- Container insights

**Authentication:**
```bash
# Using GitHub CLI
echo $GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin

# Using personal access token
docker login ghcr.io
# Username: <github-username>
# Password: <personal-access-token>
```

#### Internal Docker Registry
```bash
docker pull registry.aurigraph.io/plugins/jeeves4coder:1.0.0
```

**Features:**
- Internal team access
- Private enterprise deployment
- Custom registry configuration

**Setup:**
```bash
# Configure Docker credentials
docker login registry.aurigraph.io
# Username: <username>
# Password: <password/token>
```

### 3. GitHub Releases

Direct download from GitHub releases:

```bash
# Download release (requires gh CLI)
gh release download v1.0.0 \
  --repo Aurigraph-DLT-Corp/glowing-adventure \
  --pattern "jeeves4coder-plugin-*.tar.gz"

# Or browser download
https://github.com/Aurigraph-DLT-Corp/glowing-adventure/releases/tag/v1.0.0
```

**Available Formats:**
- `.tar.gz` - Gzip compressed
- `.zip` - ZIP archive
- `.tar.bz2` - Bzip2 compressed

### 4. Source Repository

```bash
# Clone repository
git clone https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git
cd glowing-adventure/plugin

# Install from local
npm install .
```

**Features:**
- Latest development version
- Full source access
- Custom modifications possible
- Direct updates via git pull

---

## Installation Methods

### Method 1: npm Install (Recommended)

#### From Internal Registry
```bash
npm install @aurigraph/jeeves4coder-plugin
```

Configure in your project's `.npmrc`:
```
@aurigraph:registry=https://npm.aurigraph.io
//npm.aurigraph.io/:_authToken=${INTERNAL_NPM_TOKEN}
```

#### From GitHub Packages
```bash
npm install @aurigraph-dlt-corp/jeeves4coder-plugin
```

Configure in your project's `.npmrc`:
```
@aurigraph-dlt-corp:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Method 2: Docker Pull

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0

# Run container
docker run -it \
  -e NODE_ENV=production \
  ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0

# Run with volume mount for config
docker run -it \
  -v $(pwd)/config:/app/config \
  ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0
```

### Method 3: Docker Compose

```yaml
version: '3.8'

services:
  jeeves4coder:
    image: ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0
    container_name: jeeves4coder
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
    volumes:
      - ./config:/app/config
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

### Method 4: Direct Download

```bash
# Using GitHub CLI
gh release download v1.0.0 \
  --repo Aurigraph-DLT-Corp/glowing-adventure

# Extract archive
tar -xzf jeeves4coder-plugin-1.0.0.tar.gz
cd jeeves4coder-plugin

# Install dependencies
npm install

# Use locally
npm link
```

### Method 5: Git Clone

```bash
# Clone repository
git clone https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git
cd glowing-adventure/plugin

# Install dependencies
npm install

# Link for use
npm link

# Install in project
npm link @aurigraph/jeeves4coder-plugin
```

---

## Verification & Integrity

### Verify npm Package

```bash
# Check package info
npm info @aurigraph/jeeves4coder-plugin

# Check specific version
npm info @aurigraph/jeeves4coder-plugin@1.0.0

# Check installation
npm list @aurigraph/jeeves4coder-plugin

# View installed version
npm list -g @aurigraph/jeeves4coder-plugin
```

### Verify Docker Image

```bash
# Inspect image
docker inspect ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0

# Check image size
docker images ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin

# View image history
docker history ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0

# Run health check
docker run --rm ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0 node -e "console.log('OK')"
```

### Verify Integrity with Checksums

```bash
# Download checksums
wget https://releases.aurigraph.io/jeeves4coder-plugin/1.0.0/SHA256SUMS
wget https://releases.aurigraph.io/jeeves4coder-plugin/1.0.0/SHA256SUMS.sig

# Verify signature
gpg --verify SHA256SUMS.sig SHA256SUMS

# Verify checksums
sha256sum -c SHA256SUMS
```

---

## Distribution Verification Checklist

After distribution, verify:

- [ ] npm Internal Registry - Package published and accessible
- [ ] GitHub Packages - Package visible in GitHub Packages
- [ ] GitHub Container Registry - Image published and accessible
- [ ] GitHub Releases - Release notes and artifacts available
- [ ] Documentation - All docs accessible
- [ ] Installation - Test install from each channel works
- [ ] Functionality - Plugin functions correctly after installation
- [ ] Health Checks - Container health checks pass
- [ ] Signatures - Package signatures verify
- [ ] Checksums - File checksums match

### Automated Verification

```bash
# Run distribution verification script
node scripts/distribute.js --verify-only

# Check distribution report
cat DISTRIBUTION_REPORT.json
```

---

## Update Distribution

When releasing a new version:

```bash
# 1. Update version in package.json
npm version minor

# 2. Build and test
npm run build
npm test

# 3. Create git commit and tag
git add .
git commit -m "Release v1.1.0"
git tag -a v1.1.0 -m "Release version 1.1.0"

# 4. Push to GitHub
git push origin main --follow-tags

# 5. GitHub Actions automatically distributes
# Or manually:
node scripts/distribute.js
```

---

## Troubleshooting Distribution

### npm Installation Issues

**Issue: 404 Not Found**
```
npm ERR! 404 Registry error reading json
```

**Solution:**
```bash
# Verify registry URL
npm config get registry

# Check npm token
npm whoami --registry https://npm.aurigraph.io

# Reconfigure if needed
npm config set //npm.aurigraph.io/:_authToken=$INTERNAL_NPM_TOKEN
```

**Issue: Authentication Failed**
```
npm ERR! 403 Forbidden
```

**Solution:**
```bash
# Verify token validity
npm whoami --registry https://npm.aurigraph.io

# Generate new token if expired
# Update INTERNAL_NPM_TOKEN environment variable

# Clear cache
npm cache clean --force
```

### Docker Registry Issues

**Issue: Image Not Found**
```
Error response from daemon: image not found
```

**Solution:**
```bash
# Verify image exists
docker search ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin

# Login to registry
echo $GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin

# Pull with full path
docker pull ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0
```

**Issue: Authentication Failed**
```
Error response from daemon: unauthorized
```

**Solution:**
```bash
# Verify GitHub token has necessary permissions
# - read:packages
# - write:packages (if pushing)

# Re-authenticate
docker logout ghcr.io
docker login ghcr.io

# Try again
docker pull ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:1.0.0
```

### Version Conflicts

**Issue: Wrong Version Installed**
```
npm list @aurigraph/jeeves4coder-plugin
```

**Solution:**
```bash
# Install specific version
npm install @aurigraph/jeeves4coder-plugin@1.0.0

# Or update to latest
npm update @aurigraph/jeeves4coder-plugin

# View available versions
npm view @aurigraph/jeeves4coder-plugin versions
```

---

## Distribution Metrics

Monitor distribution:

```bash
# Check npm download stats
npm stat @aurigraph/jeeves4coder-plugin

# View GitHub release downloads
gh release view v1.0.0 --repo Aurigraph-DLT-Corp/glowing-adventure

# Check Docker image pulls
curl -s https://registry.hub.docker.com/v2/repositories/aurigraph/jeeves4coder-plugin/ | jq '.pull_count'
```

---

## Security

### Secure Distribution

- ✅ All packages cryptographically signed
- ✅ Integrity verified with checksums
- ✅ Container images scanned for vulnerabilities
- ✅ Access restricted to authorized users
- ✅ Audit trail maintained
- ✅ HTTPS for all transfers

### Best Practices

1. **Always verify package signatures**
   ```bash
   gpg --verify package.sig package.tar.gz
   ```

2. **Use official registries only**
   - npm.aurigraph.io
   - npm.pkg.github.com
   - ghcr.io

3. **Keep credentials secure**
   - Never commit tokens to git
   - Use environment variables
   - Rotate tokens regularly

4. **Update regularly**
   ```bash
   npm update @aurigraph/jeeves4coder-plugin
   docker pull ghcr.io/aurigraph-dlt-corp/jeeves4coder-plugin:latest
   ```

---

## Support

For distribution issues:

- **Email**: agents@aurigraph.io
- **Slack**: #aurigraph-agents
- **GitHub Issues**: https://github.com/Aurigraph-DLT-Corp/glowing-adventure/issues
- **Documentation**: https://docs.aurigraph.io/j4c

---

## Distribution Summary

| Channel | Status | Access | Method |
|---------|--------|--------|--------|
| npm Internal | Active | Team | `npm install` |
| GitHub Packages | Active | Team | `npm install` |
| Docker (ghcr.io) | Active | Team | `docker pull` |
| Docker (Internal) | Active | Team | `docker pull` |
| GitHub Releases | Active | Public | Direct download |
| Source Repo | Active | Public | `git clone` |

---

**Last Updated**: October 23, 2024
**Status**: Production Ready
**Version**: 1.0.0
