# TinyWebChat Deployment Guide

This guide covers various deployment scenarios for TinyWebChat, from simple local setups to production deployments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Deployment Scenarios](#deployment-scenarios)
   - [Local Development](#local-development)
   - [Standalone Server](#standalone-server)
   - [OpenClaw Plugin](#openclaw-plugin)
   - [Docker Deployment](#docker-deployment)
   - [Reverse Proxy Setup](#reverse-proxy-setup)
3. [Scaling Considerations](#scaling-considerations)
4. [Monitoring & Logging](#monitoring--logging)
5. [Security Best Practices](#security-best-practices)
6. [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites
- Node.js 20 or higher
- OpenClaw installed (for CLI mode or plugin mode)
- npm or pnpm package manager

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/tinywebchat.git
cd tinywebchat

# Install dependencies
npm install

# Build the plugin
npm run build
```

## Deployment Scenarios

### Local Development

**Use Case:** Testing and development on your local machine.

**Configuration:**
```bash
# Run in CLI mode (spawns OpenClaw process)
npm run start:cli

# Or run in plugin mode (requires OpenClaw running)
npm run start:plugin
```

**Environment Variables:**
```bash
PORT=3008
AGENT_MODE=cli
PROCESSING_MODE=queue
SESSION_TIMEOUT=3600
ALLOWED_ORIGINS=*
```

**Testing:**
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Test with browser
open test-chat.html
```

### Standalone Server

**Use Case:** Production deployment without OpenClaw integration.

**Configuration:**
```yaml
# config.yaml
enabled: true
port: 3008
agentMode: cli
processingMode: queue
sessionTimeout: 3600
maxHistory: 100
wechatMpEnabled: true
allowedOrigins:
  - https://yourdomain.com
rateLimit: 60
offlineQueue: true
maxOfflineQueue: 50
workspacePath: /var/lib/tinywebchat/workspace
```

**Startup Script:**
```bash
#!/bin/bash
# /etc/systemd/system/tinywebchat.service

[Unit]
Description=TinyWebChat Server
After=network.target

[Service]
Type=simple
User=tinywebchat
WorkingDirectory=/opt/tinywebchat
Environment=NODE_ENV=production
Environment=PORT=3008
Environment=AGENT_MODE=cli
Environment=PROCESSING_MODE=queue
ExecStart=/usr/bin/node dist/channels/plugins/webchat/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### OpenClaw Plugin

**Use Case:** Integrated deployment with OpenClaw.

**Configuration:**
```yaml
# OpenClaw config.yaml
channels:
  tinywebchat:
    enabled: true
    port: 3008
    agentMode: plugin
    processingMode: queue
    sessionTimeout: 3600
    maxHistory: 100
    wechatMpEnabled: true
    allowedOrigins:
      - https://yourdomain.com
    rateLimit: 60
    offlineQueue: true
    maxOfflineQueue: 50
```

**Installation:**
```bash
# Install as OpenClaw plugin
npm install tinywebchat

# Or from local build
npm link
```

### Docker Deployment

**Use Case:** Containerized deployment for scalability.

**Dockerfile:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY dist/ ./dist/
COPY openclaw-plugin.yaml ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S tinywebchat -u 1001

USER tinywebchat

EXPOSE 3008

CMD ["node", "dist/channels/plugins/webchat/index.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  tinywebchat:
    build: .
    ports:
      - "3008:3008"
    environment:
      - NODE_ENV=production
      - PORT=3008
      - AGENT_MODE=cli
      - PROCESSING_MODE=queue
      - SESSION_TIMEOUT=3600
      - ALLOWED_ORIGINS=https://yourdomain.com
    volumes:
      - ./workspace:/app/workspace
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3008/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Reverse Proxy Setup

**Use Case:** Production deployment with SSL termination and load balancing.

**Nginx Configuration:**
```nginx
# /etc/nginx/sites-available/tinywebchat
upstream tinywebchat_backend {
    server 127.0.0.1:3008;
    # Add more servers for load balancing
    # server 127.0.0.1:3009;
    # server 127.0.0.1:3010;
}

server {
    listen 443 ssl http2;
    server_name chat.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/chat.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.yourdomain.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    location / {
        proxy_pass http://tinywebchat_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        proxy_pass http://tinywebchat_backend/health;
        access_log off;
    }
}
```

**Caddy Configuration:**
```caddy
chat.yourdomain.com {
    reverse_proxy localhost:3008 {
        header_up X-Real-IP {remote_host}
    }
    
    encode gzip
    
    header {
        X-Frame-Options DENY
        X-Content-Type-Options nosniff
        X-XSS-Protection "1; mode=block"
    }
}
```

## Scaling Considerations

### Horizontal Scaling

For high-traffic deployments, consider:

1. **Multiple Instances:**
   ```bash
   # Start multiple instances on different ports
   PORT=3008 npm start &
   PORT=3009 npm start &
   PORT=3010 npm start &
   ```

2. **Load Balancer Configuration:**
   ```nginx
   upstream tinywebchat {
       ip_hash; # For session stickiness
       server 127.0.0.1:3008;
       server 127.0.0.1:3009;
       server 127.0.0.1:3010;
   }
   ```

3. **Shared Session Storage:**
   ```javascript
   // Implement Redis or database session storage
   import Redis from 'ioredis';
   
   const redis = new Redis();
   const sessions = new RedisSessionStore(redis);
   ```

### Vertical Scaling

1. **Memory Optimization:**
   ```bash
   # Increase Node.js heap size
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

2. **Connection Pooling:**
   ```javascript
   // For database connections
   const pool = new Pool({
     max: 20,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

## Monitoring & Logging

### Logging Configuration

**Structured Logging:**
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

**Log Rotation:**
```bash
# Use logrotate
# /etc/logrotate.d/tinywebchat
/var/log/tinywebchat/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 tinywebchat tinywebchat
}
```

### Monitoring Setup

**Health Checks:**
```bash
# Basic health check
curl -f http://localhost:3008/health

# Detailed status
curl http://localhost:3008/health | jq .
```

**Metrics Collection:**
```javascript
// Use Prometheus metrics
import promClient from 'prom-client';

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
});
```

### Alerting

**Critical Metrics to Monitor:**
- Response time > 5 seconds
- Error rate > 1%
- Memory usage > 80%
- CPU usage > 70%
- Active sessions > 1000

## Security Best Practices

### Authentication & Authorization

1. **Token Security:**
   ```javascript
   // Use secure token generation
   import crypto from 'crypto';
   
   function generateSecureToken() {
     return crypto.randomBytes(32).toString('hex');
   }
   ```

2. **Rate Limiting:**
   ```yaml
   # Configuration
   rateLimit: 60  # Requests per minute per session
   ```

3. **CORS Configuration:**
   ```yaml
   allowedOrigins:
     - https://yourdomain.com
     - https://app.yourdomain.com
   ```

### Data Protection

1. **Session Encryption:**
   ```javascript
   // Encrypt sensitive session data
   import { createCipheriv, createDecipheriv } from 'crypto';
   
   const algorithm = 'aes-256-gcm';
   const key = crypto.randomBytes(32);
   ```

2. **Input Validation:**
   ```javascript
   // Validate all user input
   function validateInput(content) {
     if (typeof content !== 'string') return false;
     if (content.length > 5000) return false;
     return true;
   }
   ```

### Network Security

1. **SSL/TLS Configuration:**
   ```bash
   # Use Let's Encrypt for SSL certificates
   certbot --nginx -d chat.yourdomain.com
   ```

2. **Firewall Rules:**
   ```bash
   # Allow only necessary ports
   ufw allow 443/tcp
   ufw allow 80/tcp
   ufw deny 3008/tcp  # Internal only
   ```

## Troubleshooting

### Common Issues

1. **Server Won't Start:**
   ```bash
   # Check port availability
   netstat -tulpn | grep :3008
   
   # Check Node.js version
   node --version
   
   # Check dependencies
   npm list --depth=0
   ```

2. **Connection Issues:**
   ```bash
   # Test connectivity
   curl -v http://localhost:3008/health
   
   # Check firewall
   sudo ufw status
   ```

3. **Performance Problems:**
   ```bash
   # Monitor resources
   top
   htop
   
   # Check logs
   tail -f /var/log/tinywebchat/error.log
   ```

### Debug Mode

Enable debug logging:
```bash
DEBUG=tinywebchat:* npm start
```

### Support

- **Documentation:** [docs.tinywebchat.org](https://docs.tinywebchat.org)
- **GitHub Issues:** [github.com/your-org/tinywebchat/issues](https://github.com/your-org/tinywebchat/issues)
- **Community:** [discord.gg/tinywebchat](https://discord.gg/tinywebchat)

## Conclusion

TinyWebChat is designed to be flexible and scalable. Choose the deployment scenario that best fits your needs:

- **Local Development:** For testing and development
- **Standalone Server:** For simple production deployments
- **OpenClaw Plugin:** For integrated AI agent workflows
- **Docker Deployment:** For containerized environments
- **Reverse Proxy Setup:** For production with SSL and load balancing

Always follow security best practices and monitor your deployment for optimal performance.