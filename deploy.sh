#!/bin/bash

# Deploy script for Network Monitoring Add-on
# This script builds the add-on locally and deploys it to Home Assistant

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
# Set your Home Assistant IP or hostname here:
# HA_HOST="192.168.1.100"  # Uncomment and set your IP
HA_HOST="${HA_HOST:-homeassistant.local}"
HA_USER="${HA_USER:-root}"
ADDON_NAME="network-monitoring-addon"

# If HA_HOST is still the default, prompt for it
if [ "$HA_HOST" = "homeassistant.local" ]; then
    echo -e "${YELLOW}Enter your Home Assistant IP address or hostname:${NC}"
    echo -e "${YELLOW}(Press Enter to use 'homeassistant.local')${NC}"
    read -r user_host
    if [ -n "$user_host" ]; then
        HA_HOST="$user_host"
    fi
fi

echo -e "${GREEN}=== Network Monitoring Add-on Deployment ===${NC}\n"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run this script from the addon directory.${NC}"
    exit 1
fi

# Step 1: Build the project
echo -e "${YELLOW}Step 1: Building TypeScript project...${NC}"
if ! npm run build; then
    echo -e "${RED}Build failed! Please fix errors and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build completed${NC}\n"

# Step 2: Verify dist folder
if [ ! -d "dist" ]; then
    echo -e "${RED}Error: dist folder not found after build${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Dist folder verified${NC}\n"

# Step 3: Prepare Dockerfile
echo -e "${YELLOW}Step 2: Preparing Dockerfile for pre-built deployment...${NC}"
if [ -f "Dockerfile.prebuilt" ]; then
    cp Dockerfile Dockerfile.original.bak 2>/dev/null || true
    cp Dockerfile.prebuilt Dockerfile
    echo -e "${GREEN}✓ Dockerfile updated${NC}\n"
else
    echo -e "${YELLOW}Warning: Dockerfile.prebuilt not found, using existing Dockerfile${NC}\n"
fi

# Step 4: Test SSH connection
echo -e "${YELLOW}Step 3: Testing connection to Home Assistant...${NC}"
if ! ssh -o ConnectTimeout=5 ${HA_USER}@${HA_HOST} "echo 'Connection successful'" 2>/dev/null; then
    echo -e "${RED}Error: Cannot connect to ${HA_HOST}${NC}"
    echo -e "${YELLOW}Please ensure:${NC}"
    echo "  1. Home Assistant is running"
    echo "  2. SSH is enabled"
    echo "  3. You can connect: ssh ${HA_USER}@${HA_HOST}"
    echo ""
    echo "You can also set custom host:"
    echo "  HA_HOST=192.168.1.100 ./deploy.sh"
    exit 1
fi
echo -e "${GREEN}✓ Connected to Home Assistant${NC}\n"

# Step 5: Create addons directory if it doesn't exist
echo -e "${YELLOW}Step 4: Preparing Home Assistant directories...${NC}"
ssh ${HA_USER}@${HA_HOST} "mkdir -p /addons/${ADDON_NAME}"
echo -e "${GREEN}✓ Directories ready${NC}\n"

# Step 6: Copy files to Home Assistant
echo -e "${YELLOW}Step 5: Copying files to Home Assistant...${NC}"
echo "This may take a minute..."

# Always use scp (more compatible than rsync)
echo "Copying essential files..."

# Copy required files
scp config.yaml ${HA_USER}@${HA_HOST}:/addons/${ADDON_NAME}/
scp Dockerfile ${HA_USER}@${HA_HOST}:/addons/${ADDON_NAME}/
scp run.sh ${HA_USER}@${HA_HOST}:/addons/${ADDON_NAME}/
scp package.json ${HA_USER}@${HA_HOST}:/addons/${ADDON_NAME}/
scp package-lock.json ${HA_USER}@${HA_HOST}:/addons/${ADDON_NAME}/

# Copy dist folder (the most important!)
echo "Copying dist folder..."
scp -r dist ${HA_USER}@${HA_HOST}:/addons/${ADDON_NAME}/

# Copy optional files if they exist
[ -f "icon.png" ] && scp icon.png ${HA_USER}@${HA_HOST}:/addons/${ADDON_NAME}/ || true
[ -f "README.md" ] && scp README.md ${HA_USER}@${HA_HOST}:/addons/${ADDON_NAME}/ || true
[ -f "DOCS.md" ] && scp DOCS.md ${HA_USER}@${HA_HOST}:/addons/${ADDON_NAME}/ || true
[ -f "CHANGELOG.md" ] && scp CHANGELOG.md ${HA_USER}@${HA_HOST}:/addons/${ADDON_NAME}/ || true

echo -e "${GREEN}✓ Files copied${NC}\n"

# Step 7: Verify installation
echo -e "${YELLOW}Step 6: Verifying installation...${NC}"
ssh ${HA_USER}@${HA_HOST} "ls -la /addons/${ADDON_NAME}/ | head -20"
echo -e "${GREEN}✓ Files verified${NC}\n"

# Step 8: Instructions
echo -e "${GREEN}=== Deployment Complete! ===${NC}\n"
echo -e "${YELLOW}Next steps in Home Assistant:${NC}"
echo "  1. Go to Settings → Add-ons"
echo "  2. Click ⋮ (three dots) → Check for updates"
echo "  3. Find 'Network Monitoring Add-on' in Local add-ons"
echo "  4. Click Install"
echo "  5. Configure and Start"
echo ""
echo -e "${GREEN}Dashboard will be available at: http://${HA_HOST}:8080${NC}"
echo ""

# Optional: Restore original Dockerfile
if [ -f "Dockerfile.original.bak" ]; then
    echo -e "${YELLOW}Restore original Dockerfile? (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        mv Dockerfile.original.bak Dockerfile
        echo -e "${GREEN}✓ Original Dockerfile restored${NC}"
    else
        rm Dockerfile.original.bak
    fi
fi

echo -e "\n${GREEN}Done!${NC}"
