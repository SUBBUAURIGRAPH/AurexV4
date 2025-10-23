# API Key System - Architecture & Flows

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Application                        │
│                  (Bot, Script, Mobile App)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    HTTP Request with API Key
                    Authorization: Bearer aur_xxx
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Express.js Server                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  API Key Authentication Middleware                        │  │
│  │  - Extract key from header                                │  │
│  │  - Hash the key (SHA-256)                                 │  │
│  │  - Look up in database                                    │  │
│  │  - Verify key is active & not expired                     │  │
│  │  - Attach user to request                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                     │
│                    Key Valid? ✅                                  │
│                             │                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Permission Checking                                      │  │
│  │  - Check user role                                        │  │
│  │  - Check API key permissions                              │  │
│  │  - Verify rate limit                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                     │
│                  Authorized? ✅                                   │
│                             │                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Route Handler                                            │  │
│  │  - Execute API endpoint                                   │  │
│  │  - Update lastUsed timestamp                              │  │
│  │  - Return response                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                    JSON Response
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MongoDB Database                              │
│  ┌──────────────────────┬──────────────────────────────────────┐│
│  │ API Keys Collection  │  Users Collection                   ││
│  ├──────────────────────┼──────────────────────────────────────┤│
│  │ - userId             │  - _id                              ││
│  │ - keyHash (indexed)   │  - email                            ││
│  │ - keyPrefix          │  - username                         ││
│  │ - permissions        │  - role                             ││
│  │ - isActive           │  - permissions                      ││
│  │ - lastUsed           │  - isActive                         ││
│  │ - expiresAt          │                                     ││
│  │ - rateLimit          │                                     ││
│  └──────────────────────┴──────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## API Key Lifecycle

```
1. CREATION
   ┌──────────────────────────────┐
   │  User requests new API key   │
   │  POST /api/v1/apikeys        │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Generate random bytes        │
   │ (crypto.randomBytes(32))     │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Format: aur_xxxxx...         │
   │ (aur_ prefix + 64 hex chars) │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Hash key (SHA-256)           │
   │ Store hash in database       │
   │ Return full key (once!)      │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ KEY ACTIVE & READY           │
   └──────────────────────────────┘

2. USAGE
   ┌──────────────────────────────┐
   │ Client sends API key         │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Server hashes the key        │
   │ Looks up hash in database    │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Verify:                      │
   │ - Key is active              │
   │ - Key is not expired         │
   │ - User is active             │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Update lastUsed timestamp    │
   │ Process request              │
   │ Return response              │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ REQUEST PROCESSED            │
   └──────────────────────────────┘

3. ROTATION
   ┌──────────────────────────────┐
   │ User requests key rotation   │
   │ POST /api/v1/apikeys/:id/..  │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Generate NEW API key         │
   │ (same process as creation)   │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Deactivate OLD key           │
   │ (set isActive = false)       │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Return new key (once!)       │
   │ Old key no longer works      │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ KEYS ROTATED                 │
   └──────────────────────────────┘

4. REVOCATION
   ┌──────────────────────────────┐
   │ User revokes key             │
   │ POST /api/v1/apikeys/:id/... │
   │ or DELETE /api/v1/apikeys/:..│
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ DELETE: Permanently remove   │
   │ REVOKE: Set isActive=false   │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Key no longer valid          │
   │ Future requests return 401   │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ KEY REVOKED                  │
   └──────────────────────────────┘

5. EXPIRATION
   ┌──────────────────────────────┐
   │ Key has expiresAt date set   │
   │ (e.g., 2025-12-31)           │
   └──────────────┬───────────────┘
                  │
          Time passes...
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Current time > expiresAt     │
   │ Key automatically invalid    │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Requests return 401          │
   │ User needs new key           │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ KEY EXPIRED                  │
   └──────────────────────────────┘
```

---

## Authentication Flow

```
CLIENT REQUEST
│
├─ Header: "Authorization: Bearer aur_xxxx"
│
▼
API KEY EXTRACTION
├─ Parse header
├─ Extract key string
├─ Verify format (starts with "aur_")
│
▼
KEY VALIDATION
├─ Hash the key (SHA-256)
├─ Lookup hash in database
├─ Verify key document exists
│
▼
STATUS CHECKS
├─ Is key active? (isActive = true)
├─ Is key expired? (expiresAt > now)
├─ Is user active? (user.isActive = true)
│
├─ IF ANY CHECK FAILS ─────────────────┐
│                                      │
│                                      ▼
│                          ┌─────────────────────┐
│                          │ Return 401 Unauth   │
│                          └─────────────────────┘
│
▼ (ALL CHECKS PASS)
PERMISSION VERIFICATION
├─ Get user's role
├─ Get user's base permissions
├─ Get API key's scoped permissions
├─ Combine: key permissions ⊆ user permissions
│
├─ IF INSUFFICIENT PERMISSIONS ──────┐
│                                    │
│                                    ▼
│                        ┌─────────────────────┐
│                        │ Return 403 Forbidden│
│                        └─────────────────────┘
│
▼ (PERMISSIONS OK)
RATE LIMIT CHECK
├─ Get key's rateLimit (req/hour)
├─ Check usage in current hour
├─ Increment counter
│
├─ IF LIMIT EXCEEDED ────────────────┐
│                                    │
│                                    ▼
│                        ┌─────────────────────┐
│                        │ Return 429 Too Many │
│                        └─────────────────────┘
│
▼ (RATE LIMIT OK)
UPDATE USAGE
├─ Set apiKey.lastUsed = now()
├─ Save to database
│
▼
ATTACH TO REQUEST
├─ req.user = user (from database)
├─ req.apiKey = apiKey (from database)
│
▼
ROUTE HANDLER
├─ Execute endpoint logic
├─ Access req.user and req.apiKey
├─ Return response
│
▼
SUCCESS
```

---

## Data Security Architecture

```
┌─────────────────────────────────────────────┐
│          USER GENERATES API KEY             │
│    "aur_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"  │
│         (Full key shown only once)          │
└────────────────────┬────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Hashing (SHA-256)     │
        │  One-way transformation │
        └────────────┬───────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │ "5f3c8b9a2d4e1f7a6b3c8d9e2f4a1b5c"│
        │          Hash stored in DB         │
        └────────────┬────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │   Full key NEVER stored in DB      │
        │   Cannot be retrieved later        │
        │   User must store key securely     │
        └────────────────────────────────────┘

WHEN CLIENT AUTHENTICATES:
┌──────────────────────────────────────────────┐
│     CLIENT SENDS API KEY IN REQUEST          │
│  "aur_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"     │
└────────────────────┬─────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Server hashes it      │
        │  (same SHA-256)        │
        └────────────┬───────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │ "5f3c8b9a2d4e1f7a6b3c8d9e2f4a1b5c"│
        │    Compares with DB hash          │
        └────────────┬────────────────────────┘
                     │
            ┌────────┴────────┐
            │                 │
        MATCH ✅         NO MATCH ❌
            │                 │
            ▼                 ▼
        AUTHENTICATE      REJECT (401)
```

---

## Permission Matrix

```
┌──────────────────────────────────────────────────────────────┐
│               API KEY PERMISSION SCOPING                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ User Role Permissions ─┐                                     │
│                        ├──> API Key Scoped Permissions       │
│                        │         (subset)                    │
│                        │                                     │
│ Example:               │                                     │
│ User = TRADER          │  Key Permissions:                  │
│                        │  ✓ strategy:read                   │
│ User Permissions:      │  ✓ backtest:create                 │
│ • strategy:read        ├──> Combined: strategy:read +       │
│ • strategy:create      │              backtest:create       │
│ • backtest:read        │                                     │
│ • backtest:create      │  Request for strategy:delete       │
│                        │  ✗ REJECTED (not in key scope)     │
│                        │                                     │
└──────────────────────────────────────────────────────────────┘

PERMISSION HIERARCHY:

User Role        │ Base Permissions        │ Can Generate Keys For
─────────────────┼─────────────────────────┼─────────────────────
VIEWER           │ strategy:read           │ strategy:read
                 │ backtest:read           │ backtest:read
                 │ optimize:read           │ optimize:read
─────────────────┼─────────────────────────┼─────────────────────
TRADER           │ strategy:*              │ All VIEWER +
                 │ backtest:*              │ strategy:create/update
                 │ optimize:*              │ backtest:create
                 │                         │ optimize:create
─────────────────┼─────────────────────────┼─────────────────────
SENIOR_TRADER    │ TRADER + deploy:*       │ All TRADER +
                 │                         │ deploy:paper
                 │                         │ deploy:live
─────────────────┼─────────────────────────┼─────────────────────
RISK_MANAGER     │ strategy:read           │ deploy:approve
                 │ deploy:approve/reject   │ deploy:reject
                 │ deploy:stop             │ deploy:stop
                 │ audit:view              │ audit:view
─────────────────┼─────────────────────────┼─────────────────────
ADMIN            │ All permissions         │ Any permission
```

---

## Rate Limiting Architecture

```
┌───────────────────────────────────────────────────────────┐
│            RATE LIMITING PER API KEY                      │
├───────────────────────────────────────────────────────────┤
│                                                           │
│ Each API key has a rateLimit setting (req/hour)          │
│ Default: 1000 requests/hour                              │
│                                                           │
│ Example timeline:                                         │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Hour 1: 10:00 AM - 11:00 AM                         │  │
│ ├─────────────────────────────────────────────────────┤  │
│ │ 10:05 AM - Request #1 ✓                            │  │
│ │ 10:10 AM - Request #2 ✓                            │  │
│ │ 10:15 AM - Request #3 ✓                            │  │
│ │ ...                                                 │  │
│ │ 10:59 AM - Request #1000 ✓                         │  │
│ │ 10:59:30 AM - Request #1001 ✗ (429 Too Many)      │  │
│ │ 10:59:45 AM - Request #1002 ✗ (429 Too Many)      │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Hour 2: 11:00 AM - 12:00 PM (COUNTER RESETS)       │  │
│ ├─────────────────────────────────────────────────────┤  │
│ │ 11:01 AM - Request #1001 ✓ (counter reset)        │  │
│ │ 11:05 AM - Request #1002 ✓                         │  │
│ │ ...                                                 │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ SLIDING WINDOW ALGORITHM (Preferred)                     │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ 10:00 AM ────────────────────────── 11:00 AM       │  │
│ │ [=====●=====●===●====●======●=====] (1000 req)     │  │
│ │       ├─ All within window, counter = 1000         │  │
│ │                                                     │  │
│ │ 10:01 AM ────────────────────────── 11:01 AM       │  │
│ │    [=====●=====●===●====●======●=====] (999 req)   │  │
│ │       ├─ Old request dropped, counter = 999         │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Application                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                    HTTP Request
                             │
        ┌────────────────────▼────────────────────┐
        │     Express Request/Response Chain      │
        ├────────────────────────────────────────┤
        │                                        │
        │  1. Authentication Middleware          │
        │     └─> authenticateAPIKey()          │
        │         ├─> extractAPIKeyFromHeader() │
        │         ├─> hashAPIKey()              │
        │         ├─> Query APIKey model        │
        │         └─> Attach to req.apiKey      │
        │                                        │
        │  2. Authorization Middleware           │
        │     └─> requireAPIKeyPermission()     │
        │         ├─> Check user.role           │
        │         ├─> Check apiKey.permissions  │
        │         └─> Check combined perms      │
        │                                        │
        │  3. Rate Limiting Middleware           │
        │     └─> checkAPIKeyRateLimit()        │
        │         ├─> Lookup Redis cache        │
        │         ├─> Check counter             │
        │         ├─> Increment counter         │
        │         └─> Verify within limit       │
        │                                        │
        │  4. Route Handler                      │
        │     └─> Process request               │
        │         ├─> Access req.user           │
        │         ├─> Access req.apiKey         │
        │         ├─> Call business logic       │
        │         ├─> Update apiKey.lastUsed    │
        │         └─> Return response           │
        │                                        │
        └────────────────────────────────────────┘
                             │
                    HTTP Response
                             │
        ┌────────────────────▼────────────────────┐
        │        MongoDB Database                 │
        ├────────────────────────────────────────┤
        │                                        │
        │  api_keys Collection:                  │
        │  ├─ userId                             │
        │  ├─ keyHash (indexed)                  │
        │  ├─ keyPrefix                          │
        │  ├─ permissions                        │
        │  ├─ isActive                           │
        │  ├─ lastUsed (updated per request)    │
        │  ├─ expiresAt                          │
        │  └─ rateLimit                          │
        │                                        │
        │  users Collection:                     │
        │  ├─ _id                                │
        │  ├─ email                              │
        │  ├─ role                               │
        │  ├─ permissions                        │
        │  └─ isActive                           │
        │                                        │
        └────────────────────────────────────────┘
```

---

## Error Flow Diagram

```
API Request with Key
        │
        ▼
Extract Key from Header
        │
    ┌───┴────┐
    │         │
  Found    Not Found
    │         │
    ▼         ▼
  Hash    ┌─────────┐
    │     │ Return  │
    │     │ 401 Err │
    │     └─────────┘
    ▼
Query Database
    │
    ┌────┬────┬────┐
    │    │    │    │
 Found Missing Inactive Expired
    │    │       │       │
    ▼    ▼       ▼       ▼
   ✓  ┌──────────────────┐
      │ Return 401 Error │
      └──────────────────┘

Check Permissions
    │
    ┌─────────┬──────────┐
    │         │          │
Has Permission  Missing  Too Scoped
    │         │          │
    ▼         ▼          ▼
   ✓      ┌──────────────────┐
          │ Return 403 Error │
          └──────────────────┘

Check Rate Limit
    │
    ┌──────────┬──────────┐
    │          │          │
Within Limit   Exceeded
    │          │
    ▼          ▼
   ✓      ┌──────────────────┐
          │ Return 429 Error │
          └──────────────────┘

✓ PROCEED WITH REQUEST
```

---

This architecture ensures secure, scalable, and maintainable API key authentication for the Strategy Builder system.
