# HMS J4C Agent - Real-time Market Data Integration

**Version**: 1.0.0
**Last Updated**: October 29, 2025

---

## 📊 Overview

The Market Data Integration provides real-time stock quotes and historical data with:
- **Dual Provider Support** - Alpha Vantage or IEX Cloud
- **Smart Caching** - Automatic cache with configurable TTL
- **Price History** - Track price changes over time
- **Data Normalization** - Unified format regardless of provider
- **Symbol Search** - Find stocks by keywords
- **Intraday Data** - Minute-by-minute OHLCV data

---

## 🚀 Quick Start

### Setup Market Data Client

```javascript
const MarketDataClient = require('./market-data/client');

// Using Alpha Vantage
const client = new MarketDataClient({
  provider: 'alpha-vantage',
  apiKey: 'YOUR_API_KEY',
  cacheTTL: 60  // Cache for 60 seconds
});

// Using IEX Cloud
const client = new MarketDataClient({
  provider: 'iex-cloud',
  apiKey: 'YOUR_API_KEY',
  cacheTTL: 60
});
```

### Get Real-time Quote

```bash
curl -X GET "http://localhost:9003/api/market/quotes/AAPL" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "symbol": "AAPL",
  "price": 189.95,
  "change": 1.45,
  "changePercent": 0.77,
  "high": 192.30,
  "low": 189.20,
  "open": 188.50,
  "volume": 45000000,
  "timestamp": "2025-10-29T14:30:00Z",
  "source": "alpha-vantage"
}
```

---

## 🔑 API Keys

### Alpha Vantage
- **URL**: https://www.alphavantage.co
- **Free Tier**: 5 requests/minute, 500/day
- **Paid**: Unlimited requests
- **Data**: US stocks, forex, cryptocurrencies

### IEX Cloud
- **URL**: https://iexcloud.io
- **Free Tier**: 100 messages/month
- **Paid**: Pay-per-message
- **Data**: US stocks, forex, crypto, real-time

---

## 📡 API Endpoints

### GET /api/market/quotes/:symbol
**Description**: Get real-time quote for a symbol

**Authenticated**: Yes (requires 'user' role)

**Response (200):**
```json
{
  "symbol": "AAPL",
  "price": 189.95,
  "change": 1.45,
  "changePercent": 0.77,
  "high": 192.30,
  "low": 189.20,
  "open": 188.50,
  "volume": 45000000,
  "timestamp": "2025-10-29T14:30:00Z",
  "source": "alpha-vantage",
  "cached": false
}
```

---

### GET /api/market/quotes
**Description**: Get quotes for multiple symbols

**Authenticated**: Yes (requires 'user' role)

**Query Parameters:**
- `symbols` - Comma-separated symbols (AAPL,MSFT,GOOGL)
- `cache` - Use cache if available (default: true)

**Example:**
```bash
curl "http://localhost:9003/api/market/quotes?symbols=AAPL,MSFT,GOOGL" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "quotes": {
    "AAPL": { ... },
    "MSFT": { ... },
    "GOOGL": { ... }
  }
}
```

---

### GET /api/market/intraday/:symbol
**Description**: Get intraday OHLCV data

**Authenticated**: Yes (requires 'user' role)

**Query Parameters:**
- `interval` - Time interval: 1min, 5min, 15min, 30min, 60min (default: 5min)

**Response (200):**
```json
{
  "symbol": "AAPL",
  "interval": "5min",
  "data": [
    {
      "timestamp": "2025-10-29T14:30:00Z",
      "open": 189.50,
      "high": 190.20,
      "low": 189.30,
      "close": 189.95,
      "volume": 500000
    },
    {
      "timestamp": "2025-10-29T14:25:00Z",
      "open": 189.20,
      "high": 189.80,
      "low": 189.00,
      "close": 189.50,
      "volume": 450000
    }
  ]
}
```

---

### GET /api/market/history/:symbol
**Description**: Get price history for a symbol

**Authenticated**: Yes (requires 'user' role)

**Query Parameters:**
- `limit` - Number of entries (default: 100, max: 1000)

**Response (200):**
```json
{
  "symbol": "AAPL",
  "history": [
    {
      "timestamp": "2025-10-29T14:35:00Z",
      "price": 190.00,
      "change": 0.05,
      "changePercent": 0.03
    },
    {
      "timestamp": "2025-10-29T14:30:00Z",
      "price": 189.95,
      "change": 1.45,
      "changePercent": 0.77
    }
  ]
}
```

---

### GET /api/market/search
**Description**: Search for symbols

**Authenticated**: Yes (requires 'user' role)

**Query Parameters:**
- `q` - Search keywords (required)

**Response (200):**
```json
{
  "results": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "type": "equity",
      "region": "United States",
      "marketOpen": "09:30",
      "marketClose": "16:00",
      "timezone": "US/Eastern"
    }
  ]
}
```

---

### GET /api/market/cache
**Description**: Get cache statistics (admin only)

**Authenticated**: Yes (requires 'admin' role)

**Response (200):**
```json
{
  "size": 15,
  "ttl": 60,
  "provider": "alpha-vantage",
  "priceHistorySymbols": 8
}
```

---

### POST /api/market/cache/clear
**Description**: Clear all cached data (admin only)

**Authenticated**: Yes (requires 'admin' role)

**Response (200):**
```json
{
  "success": true,
  "message": "Cache cleared"
}
```

---

## 📈 Data Normalization

All quotes are normalized to a common format regardless of provider:

```json
{
  "symbol": "AAPL",          // Stock symbol
  "price": 189.95,           // Current price
  "change": 1.45,            // Price change in dollars
  "changePercent": 0.77,     // Percentage change
  "high": 192.30,            // Day high
  "low": 189.20,             // Day low
  "open": 188.50,            // Day open
  "volume": 45000000,        // Trading volume
  "timestamp": "...",        // Quote timestamp
  "source": "alpha-vantage"  // Data source
}
```

---

## 💾 Caching Strategy

### How It Works

1. **First Request** - Fetch from API, cache result
2. **Subsequent Requests** - Serve from cache (within TTL)
3. **Cache Expiry** - Automatically refetch after TTL

### Configuration

```javascript
const client = new MarketDataClient({
  provider: 'alpha-vantage',
  apiKey: 'KEY',
  cacheTTL: 60  // Cache for 60 seconds
});
```

### Cache Limits

- Maximum cache entries: Unlimited
- Price history per symbol: 1,000 entries
- Total cache size: Memory dependent

---

## 🧪 Testing Market Data

### Get a Single Quote

```bash
TOKEN=$(curl -s -X POST http://localhost:9003/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.tokens.accessToken')

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:9003/api/market/quotes/AAPL
```

### Get Multiple Quotes

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9003/api/market/quotes?symbols=AAPL,MSFT,GOOGL"
```

### Get Intraday Data

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9003/api/market/intraday/AAPL?interval=5min"
```

### Get Price History

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9003/api/market/history/AAPL?limit=50"
```

### Search Symbols

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9003/api/market/search?q=Apple"
```

---

## 🐛 Troubleshooting

### "Invalid API Key"
```bash
# Verify API key
echo $MARKET_DATA_API_KEY

# Test with provider's API directly
curl "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=$MARKET_DATA_API_KEY"
```

### "Request timeout"
```bash
# Check provider status
# Alpha Vantage: https://www.alphavantage.co/
# IEX Cloud: https://iexcloud.io/status/

# Check rate limits
# Free tier may have request limits
# Consider upgrading or switching providers
```

### "No data returned"
```bash
# Verify symbol is valid
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9003/api/market/search?q=symbol-name"

# Check market hours
# Markets only return data during trading hours (9:30-16:00 ET)
```

---

## 🔄 Integration with Skill Execution

Use market data in skills:

```javascript
// Define market data skill
executor.defineParameterSchema('get-stock-price', {
  symbol: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 10
  }
});

// Skill implementation
async function getStockPrice(symbol) {
  const client = new MarketDataClient({ ... });
  const quote = await client.getQuote(symbol);
  return {
    symbol: quote.symbol,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent
  };
}
```

---

## 📊 Performance Tips

1. **Enable Caching** - Use cached data when possible
2. **Batch Requests** - Request multiple quotes at once
3. **Monitor Rate Limits** - Track API calls per minute
4. **Choose Provider** - Alpha Vantage for free tier, IEX for accuracy
5. **Schedule Updates** - Use background jobs for frequent updates

---

## 🔐 Security Best Practices

1. **Protect API Keys**
   ```bash
   # Don't expose in logs
   export MARKET_DATA_API_KEY="your_key_here"
   # Don't commit to git
   echo "MARKET_DATA_API_KEY=..." >> .gitignore
   ```

2. **Rate Limiting** - Implement per-user rate limits
3. **Data Validation** - Validate quotes before using
4. **Error Handling** - Handle API errors gracefully

---

## 📈 Available Providers

### Alpha Vantage
- **Pros**: Free tier available, multiple asset classes
- **Cons**: Rate limited, slower responses
- **Best for**: Development, learning

### IEX Cloud
- **Pros**: Faster, more accurate, real-time
- **Cons**: Paid service
- **Best for**: Production, critical applications

---

## 📞 Support

For market data issues:
- Check API provider status page
- Review rate limits and quotas
- Verify API key is valid
- Check market trading hours
- Contact engineering@aurigraph.io
