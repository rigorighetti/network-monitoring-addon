#!/bin/bash

# Simple deployment script - no fancy features, just works!
# Usage: ./simple-deploy.sh YOUR_HA_IP
# Example: ./simple-deploy.sh 192.168.1.100

set -e

# Check if IP provided
if [ -z "$1" ]; then
    echo "Usage: ./simple-deploy.sh YOUR_HOME_ASSISTANT_IP"
    echo "Example: ./simple-deploy.sh 192.168.1.100"
    exit 1
fi

HA_IP=$1
HA_USER="root"

echo "=== Simple Deploy to Home Assistant ==="
echo "Target: $HA_IP"
echo ""

# Build
echo "1. Building..."
npm run build || { echo "Build failed!"; exit 1; }

# Prepare Dockerfile
echo "2. Preparing Dockerfile..."
cp Dockerfile.prebuilt Dockerfile

# Create directory
echo "3. Creating directory on Home Assistant..."
ssh ${HA_USER}@${HA_IP} "mkdir -p /addons/network-monitoring-addon"

# Copy files
echo "4. Copying files..."
scp config.yaml ${HA_USER}@${HA_IP}:/addons/network-monitoring-addon/
scp Dockerfile ${HA_USER}@${HA_IP}:/addons/network-monitoring-addon/
scp run.sh ${HA_USER}@${HA_IP}:/addons/network-monitoring-addon/
scp package.json ${HA_USER}@${HA_IP}:/addons/network-monitoring-addon/
scp package-lock.json ${HA_USER}@${HA_IP}:/addons/network-monitoring-addon/
scp -r dist ${HA_USER}@${HA_IP}:/addons/network-monitoring-addon/

# Copy optional files
scp icon.png ${HA_USER}@${HA_IP}:/addons/network-monitoring-addon/ 2>/dev/null || true
scp README.md ${HA_USER}@${HA_IP}:/addons/network-monitoring-addon/ 2>/dev/null || true

echo ""
echo "✓ Deployment complete!"
echo ""
echo "Next steps in Home Assistant:"
echo "  1. Settings → Add-ons → ⋮ → Check for updates"
echo "  2. Install 'Network Monitoring Add-on'"
echo "  3. Configure and Start"
echo ""
echo "Dashboard: http://${HA_IP}:8080"
