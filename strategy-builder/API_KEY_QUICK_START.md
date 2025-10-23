# API Key Quick Start Guide

## 5-Minute Setup

### Step 1: Generate an API Key

```bash
curl -X POST http://localhost:3000/api/v1/apikeys \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First API Key",
    "description": "Testing",
    "permissions": ["strategy:read"],
    "rateLimit": 1000
  }'
```

**Save the response** - you'll get the full key that looks like:
```
aur_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### Step 2: Use the API Key

Copy that key and use it in requests:

```bash
curl http://localhost:3000/api/v1/strategies \
  -H "Authorization: Bearer aur_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

Done! You're now using API key authentication.

---

## Common Tasks

### View All My API Keys

```bash
curl http://localhost:3000/api/v1/apikeys \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### Disable a Key (Soft Delete)

```bash
curl -X POST http://localhost:3000/api/v1/apikeys/{KEY_ID}/revoke \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### Rotate a Key (Generate New One)

```bash
curl -X POST http://localhost:3000/api/v1/apikeys/{KEY_ID}/rotate \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### Update Key Settings

```bash
curl -X PATCH http://localhost:3000/api/v1/apikeys/{KEY_ID} \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "rateLimit": 5000,
    "permissions": ["strategy:read", "backtest:create"]
  }'
```

---

## API Key Permissions

Choose what your key can do:

| Permission | Access |
|------------|--------|
| `strategy:read` | View strategies |
| `strategy:create` | Create strategies |
| `strategy:update` | Edit strategies |
| `backtest:read` | View backtest results |
| `backtest:create` | Run backtests |

---

## Security Tips

1. **Never expose your keys**
   - Don't share them in public repositories
   - Don't log them in production
   - Store in `.env` files

2. **Use minimal permissions**
   ```json
   "permissions": ["strategy:read", "backtest:create"]
   ```

3. **Set expiration dates**
   ```json
   "expiresAt": "2025-12-31T23:59:59Z"
   ```

4. **Rotate keys regularly**
   - Use the `/rotate` endpoint
   - Updates automatically without service interruption

---

## Code Examples

### Python
```python
import requests

API_KEY = "aur_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"

response = requests.get(
    "http://localhost:3000/api/v1/strategies",
    headers={"Authorization": f"Bearer {API_KEY}"}
)

strategies = response.json()["data"]
```

### JavaScript
```javascript
const API_KEY = "aur_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6";

const response = await fetch("http://localhost:3000/api/v1/strategies", {
  headers: {
    "Authorization": `Bearer ${API_KEY}`
  }
});

const strategies = await response.json();
```

### Node.js with Axios
```javascript
const axios = require("axios");

const client = axios.create({
  baseURL: "http://localhost:3000/api/v1",
  headers: {
    "Authorization": "Bearer aur_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
  }
});

// Use the client for requests
const strategies = await client.get("/strategies");
```

---

## Troubleshooting

### "Invalid API key" Error
- Make sure you saved the full key correctly
- Check it starts with `aur_`
- Ensure the key is active (not revoked)

### "Rate limit exceeded"
- The key has too many requests
- Wait an hour or update the key's `rateLimit`
- Can be changed with PATCH endpoint

### Key Expiration
- If key is expired, generate a new one
- Use the `/rotate` endpoint to generate a replacement

---

## Full Reference

For detailed documentation:
- See `API_KEY_USAGE.md` for complete endpoint documentation
- See `API_KEY_IMPLEMENTATION.md` for technical details

---

**Quick Start Version**: 1.0.0
**Last Updated**: October 23, 2024
