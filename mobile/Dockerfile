# HMS Mobile Trading Platform - Production Web Server with Nginx
# Serves the web interface with reverse proxy to backend API

FROM nginx:alpine

WORKDIR /app

# Install additional packages
RUN apk add --no-cache curl dumb-init

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration (reverse proxy setup)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create application directories
RUN mkdir -p /usr/share/nginx/html

# Create a simple landing/index page
RUN cat > /usr/share/nginx/html/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HMS Trading Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: #333;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 60px 40px;
            text-align: center;
            max-width: 500px;
            margin: 20px;
        }
        .logo { font-size: 48px; margin-bottom: 20px; }
        h1 { color: #667eea; margin-bottom: 10px; font-size: 28px; }
        p { color: #666; margin-bottom: 30px; line-height: 1.6; }
        .status {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 30px 0;
            text-align: left;
        }
        .status-item {
            padding: 15px;
            background: #f5f5f5;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .status-item strong { color: #667eea; }
        .status-item p { margin: 5px 0 0 0; font-size: 14px; color: #999; }
        .badge {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 10px;
        }
        .badge.success { background: #48bb78; }
        .footer { color: #999; font-size: 12px; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">📈</div>
        <h1>HMS Trading Platform</h1>
        <p>Enterprise-grade mobile trading platform with real-time order management and advanced analytics</p>

        <div class="status">
            <div class="status-item">
                <strong>Frontend</strong>
                <p>Web Interface</p>
                <span class="badge success">Ready</span>
            </div>
            <div class="status-item">
                <strong>Backend API</strong>
                <p>apihms.aurex.in</p>
                <span class="badge success">Connected</span>
            </div>
            <div class="status-item">
                <strong>WebSocket</strong>
                <p>Real-time Updates</p>
                <span class="badge success">Active</span>
            </div>
            <div class="status-item">
                <strong>Security</strong>
                <p>HTTPS/TLS 1.3</p>
                <span class="badge success">Enabled</span>
            </div>
        </div>

        <p style="margin-top: 30px; font-size: 14px;">
            <strong>Version:</strong> 1.0.0<br>
            <strong>Status:</strong> Production Ready<br>
            <strong>Last Updated:</strong> October 31, 2025
        </p>

        <div class="footer">
            <p>HMS © 2025 Aurex Inc. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
EOF

# Copy SSL certificates (will be mounted at runtime)
RUN mkdir -p /etc/nginx/certs

# Create nginx user
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S nginx-user -u 1001

# Set permissions
RUN chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    chown -R nginx-user:nginx-user /etc/nginx/conf.d

# Create log directory
RUN mkdir -p /var/log/nginx && \
    touch /var/log/nginx/error.log && \
    touch /var/log/nginx/access.log && \
    chown -R nginx-user:nginx-user /var/log/nginx

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
