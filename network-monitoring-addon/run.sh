#!/bin/bash

# Simple startup script without bashio config dependencies
set -e

echo "[INFO] Starting Network Monitoring Add-on..."
echo "[INFO] Add-on version: 1.0.0"

# Kill any existing node processes (cleanup from previous failed starts)
echo "[INFO] Checking for existing node processes..."
pkill -f "node dist/index.js" || true
sleep 2

# Set up Home Assistant API access
export HASSIO_TOKEN="${HASSIO_TOKEN:-}"
export HOMEASSISTANT_URL="http://supervisor/core"
echo "[INFO] Home Assistant API configured"

# Set up data directory
DATA_PATH="/data"
mkdir -p "${DATA_PATH}"
echo "[INFO] Data directory: ${DATA_PATH}"

# Read configuration from options.json (Home Assistant provides this)
OPTIONS_FILE="/data/options.json"
export CONFIG_PATH="${DATA_PATH}/config.json"

# Only copy options.json if config.json doesn't exist
# This allows dashboard changes to persist
if [ ! -f "${CONFIG_PATH}" ] && [ -f "${OPTIONS_FILE}" ]; then
    echo "[INFO] Found options.json, copying to config.json"
    cp "${OPTIONS_FILE}" "${CONFIG_PATH}"
elif [ -f "${CONFIG_PATH}" ]; then
    echo "[INFO] Using existing config.json (preserves dashboard changes)"
elif [ -f "${OPTIONS_FILE}" ]; then
    echo "[INFO] Found options.json, copying to config.json"
    cp "${OPTIONS_FILE}" "${CONFIG_PATH}"
else
    echo "[WARN] No options.json found, creating default config"
    cat > "${CONFIG_PATH}" << 'EOF'
{
  "ping_targets": [
    {
      "name": "Google DNS",
      "address": "8.8.8.8",
      "interval": 60,
      "enabled": true
    }
  ],
  "dns_targets": [
    {
      "name": "Local DNS",
      "server_ip": "192.168.1.1",
      "test_domains": ["google.com"],
      "interval": 120,
      "enabled": true
    }
  ],
  "alert_thresholds": {
    "ping_timeout_ms": 5000,
    "ping_loss_percent": 10.0,
    "dns_timeout_ms": 3000,
    "consecutive_failures": 3
  },
  "data_retention_days": 30,
  "log_level": "info"
}
EOF
fi

echo "[INFO] Configuration file ready at ${CONFIG_PATH}"

# Set Node.js environment
export NODE_ENV="production"

# Read port from config.yaml (you changed it to 8088)
# The port mapping in config.yaml determines what port to use
export PORT="${PORT:-8088}"

# Log configuration summary
echo "[INFO] Environment configured:"
echo "[INFO]   - Node environment: ${NODE_ENV}"
echo "[INFO]   - Port: ${PORT}"
echo "[INFO]   - Data path: ${DATA_PATH}"

# Check if the application is built
if [ ! -d "/app/dist" ]; then
    echo "[ERROR] Application not built! dist directory not found"
    echo "[ERROR] Contents of /app:"
    ls -la /app/
    exit 1
fi

echo "[INFO] dist directory found"
echo "[INFO] Contents of /app/dist:"
ls -la /app/dist/ | head -10

# Start the application
echo "[INFO] Starting Network Monitor service..."
cd /app

# Run the application
echo "[INFO] Executing: node dist/index.js"
exec node dist/index.js
