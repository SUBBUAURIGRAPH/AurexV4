# HMS J4C Agent - Authentication & Authorization Guide

**Version**: 1.1.0
**Last Updated**: October 29, 2025

---

## 🔐 Overview

HMS J4C Agent v1.1.0 introduces comprehensive authentication and authorization system including:
- **JWT Token Authentication** - Secure token-based authentication with 1-hour expiry
- **API Key Authentication** - Long-lived keys for programmatic access
- **Role-Based Access Control (RBAC)** - Fine-grained permission management
- **Session Management** - 24-hour user sessions with automatic cleanup
- **Audit Logging** - Complete audit trail of authentication events

---

## 🚀 Quick Start

### Default Admin Credentials
```
Username: admin
Password: admin123
```

### Login
```bash
curl -X POST http://localhost:9003/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_1",
    "username": "admin",
    "email": "admin@hms.local",
    "roles": ["admin", "user"]
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "type": "Bearer"
  },
  "sessionId": "a1b2c3d4e5f6..."
}
```

### Use Access Token
```bash
curl -H "Authorization: Bearer <accessToken>" \
  http://localhost:9003/api/user/profile
```

---

## 📋 Authentication Methods

### 1. JWT Bearer Token
**Best for**: Web applications, mobile apps

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Lifetime**: 1 hour (configurable)

**Example:**
```bash
curl -H "Authorization: Bearer eyJhbGc..." \
  http://localhost:9003/api/agents
```

### 2. API Key
**Best for**: Server-to-server communication, CI/CD pipelines

**Headers:**
```
X-API-Key: <apiKey>
```

**Lifetime**: 1 year (configurable, no expiry by default)

**Example:**
```bash
curl -H "X-API-Key: key_a1b2c3d4e5f6..." \
  http://localhost:9003/api/agents
```

### 3. Session ID
**Best for**: Maintaining user context across requests

**Returned in login response**

---

## 🔑 Authentication Endpoints

### POST /auth/login
**Description**: Authenticate user and obtain tokens

**Public**: Yes (no authentication required)

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": { ... },
  "tokens": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 3600,
    "type": "Bearer"
  },
  "sessionId": "..."
}
```

**Errors:**
- `401` - Invalid username or password
- `400` - Missing username or password

---

### POST /auth/register
**Description**: Register new user account

**Public**: Yes (no authentication required)

**Request:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "roles": ["user"]  // Optional, defaults to ["user"]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "user_2",
    "username": "newuser",
    "email": "user@example.com",
    "roles": ["user"]
  }
}
```

**Errors:**
- `400` - Invalid input or user already exists
- `400` - Username < 3 chars or password < 8 chars

---

### POST /auth/refresh
**Description**: Refresh access token using refresh token

**Authenticated**: Yes (requires user role)

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "success": true,
  "tokens": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 3600,
    "type": "Bearer"
  }
}
```

---

### POST /auth/logout
**Description**: Logout and revoke tokens

**Authenticated**: Yes (requires user role)

**Request:** (empty body)

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 👤 User Profile Endpoints

### GET /api/user/profile
**Description**: Get authenticated user's profile

**Authenticated**: Yes (requires user role)

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "user_1",
    "username": "admin",
    "email": "admin@hms.local",
    "roles": ["admin", "user"],
    "isActive": true,
    "createdAt": "2025-10-29T...",
    "updatedAt": "2025-10-29T...",
    "lastLogin": "2025-10-29T..."
  }
}
```

---

### PUT /api/user/profile
**Description**: Update user profile

**Authenticated**: Yes (requires user role)

**Request:**
```json
{
  "email": "newemail@example.com",
  "metadata": {
    "theme": "dark",
    "language": "en"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "user": { ... }
}
```

---

### PUT /api/user/password
**Description**: Change user password

**Authenticated**: Yes (requires user role)

**Request:**
```json
{
  "currentPassword": "admin123",
  "newPassword": "newpassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### GET /api/user/api-keys
**Description**: List user's API keys

**Authenticated**: Yes (requires user role)

**Response (200):**
```json
{
  "success": true,
  "apiKeys": [
    {
      "id": "key_a1b2c3d4",
      "name": "Production API Key",
      "permissions": ["read:agents", "execute:skills"],
      "createdAt": "2025-10-29T...",
      "expiresAt": "2026-10-29T...",
      "isActive": true,
      "lastUsed": "2025-10-29T..."
    }
  ]
}
```

---

### POST /api/user/api-keys
**Description**: Create new API key

**Authenticated**: Yes (requires user role)

**Request:**
```json
{
  "name": "Production API Key",
  "permissions": ["read:agents", "execute:skills"]
}
```

**Response (201):**
```json
{
  "success": true,
  "apiKey": {
    "id": "key_a1b2c3d4",
    "apiKey": "your_actual_api_key_shown_once",
    "name": "Production API Key",
    "permissions": ["read:agents", "execute:skills"],
    "expiresAt": "2026-10-29T...",
    "createdAt": "2025-10-29T..."
  }
}
```

---

### DELETE /api/user/api-keys/:id
**Description**: Revoke API key

**Authenticated**: Yes (requires user role)

**Response (200):**
```json
{
  "success": true,
  "message": "API key revoked"
}
```

---

## 👥 User Roles

### Role Hierarchy
```
guest < user < analyst < trader < admin
```

### Role Permissions

| Role | Permissions |
|------|-------------|
| **guest** | read:agents |
| **user** | read:agents, read:skills, execute:skills |
| **analyst** | user permissions + data analysis |
| **trader** | user permissions + order execution |
| **admin** | All permissions (*) |

---

## 🔐 Role-Based Access Control

### Public Endpoints (No Auth Required)
- `GET /health` - Health check
- `GET /api` - API documentation
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### User Endpoints (Requires "user" role or higher)
- `GET /api/user/profile` - Get profile
- `PUT /api/user/profile` - Update profile
- `PUT /api/user/password` - Change password
- `GET /api/user/api-keys` - List API keys
- `POST /api/user/api-keys` - Create API key
- `DELETE /api/user/api-keys/:id` - Revoke API key
- `POST /auth/refresh` - Refresh tokens
- `POST /auth/logout` - Logout

### API Endpoints (Requires "user" role or higher)
- `GET /api/agents` - List agents
- `GET /api/skills` - List skills
- `GET /api/agents/:id` - Get agent details
- `GET /api/skills/:id` - Get skill details
- `POST /api/execute` - Execute skill
- `POST /api/skills/:id/execute` - Execute skill

### Admin Endpoints (Requires "admin" role)
- `GET /api/admin/users` - List users
- `POST /api/admin/users` - Create user
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/auth-stats` - Authentication statistics

---

## 📊 Token Lifecycle

### Access Token
- **Lifetime**: 1 hour
- **Use**: Include in Authorization header
- **Renewal**: Use refresh token to obtain new access token
- **Storage**: Memory (client-side)

### Refresh Token
- **Lifetime**: 24 hours
- **Use**: Send to /auth/refresh endpoint
- **Renewal**: Each refresh generates new refresh token
- **Storage**: Secure, httpOnly cookie (production)

### Session
- **Lifetime**: 24 hours
- **Metadata**: IP address, user agent, login time
- **Revocation**: Automatic on logout

---

## 🛡️ Security Best Practices

### 1. Token Storage
```javascript
// ✅ Good: localStorage (or secure storage)
localStorage.setItem('accessToken', token);

// ❌ Bad: Exposed in global scope
window.token = token;
```

### 2. HTTPS Only
```bash
# Production deployment MUST use HTTPS
# Only send tokens over encrypted connections
```

### 3. Token Expiry
```javascript
// Always check token expiry
const payload = JWT.decode(token);
if (Date.now() / 1000 > payload.exp) {
  // Token expired, refresh it
}
```

### 4. API Key Security
```bash
# ✅ Good: Use X-API-Key header
curl -H "X-API-Key: $API_KEY" https://hms.aurex.in/api/agents

# ❌ Bad: Expose in URL
curl https://hms.aurex.in/api/agents?api_key=$API_KEY
```

### 5. Password Requirements
- Minimum 8 characters
- Mix of uppercase, lowercase, numbers (recommended)
- No common patterns

---

## 🧪 Testing

### Run Authentication Tests
```bash
npm test -- auth/jwt-auth.test.js
npm test -- auth/user-manager.test.js
```

### Manual Testing with cURL

**1. Register User**
```bash
curl -X POST http://localhost:9003/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

**2. Login**
```bash
curl -X POST http://localhost:9003/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123"
  }' | jq '.tokens.accessToken' -r > token.txt
```

**3. Access Protected Endpoint**
```bash
TOKEN=$(cat token.txt)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:9003/api/user/profile
```

**4. Create API Key**
```bash
TOKEN=$(cat token.txt)
curl -X POST http://localhost:9003/api/user/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Key",
    "permissions": ["read:agents"]
  }'
```

---

## 🐛 Troubleshooting

### "Unauthorized" on Protected Endpoint
```bash
# Check token expiry
jwt decode $TOKEN

# Refresh token if expired
curl -X POST http://localhost:9003/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "'$REFRESH_TOKEN'"}'
```

### API Key Not Working
```bash
# Verify API key format
echo -n "key_abc123def456" | wc -c  # Should be ~32 chars

# Check if key is revoked
curl http://localhost:9003/api/admin/auth-stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Password Change Failed
```bash
# Verify current password
curl -X POST http://localhost:9003/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "oldpass"}'

# Then change with new password
```

---

## 📝 Environment Variables

```bash
# JWT Secret (auto-generated if not set)
JWT_SECRET=your-super-secret-key

# Access token expiry (seconds)
ACCESS_TOKEN_EXPIRY=3600

# Refresh token expiry (seconds)
REFRESH_TOKEN_EXPIRY=86400

# Log level
LOG_LEVEL=info
```

---

## 🔄 Token Refresh Flow

```
1. User logs in with username/password
   POST /auth/login
   ↓
2. Receive access token (1 hour) + refresh token (24 hours)
   ↓
3. Use access token for API calls
   GET /api/agents
   Authorization: Bearer <accessToken>
   ↓
4. When access token expires (401)
   POST /auth/refresh
   {refreshToken: <refreshToken>}
   ↓
5. Receive new access token + refresh token
   ↓
6. Continue with new access token
```

---

## 📞 Support

For authentication issues, check:
- `/api/admin/auth-stats` - Authentication statistics
- Server logs - Detailed error messages
- Token payload - Use JWT decoder at jwt.io

**Contact**: engineering@aurigraph.io
