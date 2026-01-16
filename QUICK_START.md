# Quick Start Guide

## TL;DR - Fastest Way to Install

### One-Command Deployment

```bash
# From your development machine (where npm is installed)
cd network-monitoring-addon
./deploy.sh
```

That's it! The script will:
1. ✅ Build the TypeScript code
2. ✅ Prepare the Dockerfile
3. ✅ Copy everything to Home Assistant
4. ✅ Verify the installation

Then in Home Assistant:
1. Settings → Add-ons → ⋮ → Check for updates
2. Install "Network Monitoring Add-on"
3. Configure and Start

---

## Manual Installation (If Script Doesn't Work)

### Step 1: Build Locally
```bash
cd network-monitoring-addon
npm install
npm run build
```

### Step 2: Use Pre-built Dockerfile
```bash
cp Dockerfile.prebuilt Dockerfile
```

### Step 3: Copy to Home Assistant
```bash
scp -r network-monitoring-addon root@homeassistant.local:/addons/
```

### Step 4: Install in Home Assistant
1. Settings → Add-ons → ⋮ → Check for updates
2. Find "Network Monitoring Add-on" 
3. Click Install
4. Configure and Start

---

## Custom Home Assistant Address

If your Home Assistant isn't at `homeassistant.local`:

```bash
# Using IP address
HA_HOST=192.168.1.100 ./deploy.sh

# Using custom hostname
HA_HOST=my-ha-server.local ./deploy.sh
```

---

## Troubleshooting

### "Cannot connect to homeassistant.local"

Try with IP address:
```bash
HA_HOST=192.168.1.xxx ./deploy.sh
```

Or enable SSH in Home Assistant:
1. Install "Terminal & SSH" add-on
2. Configure SSH access
3. Try again

### "Add-on not appearing"

1. Verify files copied:
   ```bash
   ssh root@homeassistant.local "ls -la /addons/network-monitoring-addon/"
   ```

2. Reload add-ons in Home Assistant UI

3. Check config.yaml exists:
   ```bash
   ssh root@homeassistant.local "cat /addons/network-monitoring-addon/config.yaml"
   ```

### "Build failed"

Make sure you have dependencies:
```bash
npm install
npm run build
```

---

## What Gets Installed

The add-on monitors your network and creates:

**Sensors** (automatically):
- `sensor.network_ping_google_dns` - Internet connectivity
- `sensor.network_ping_local_router` - Local network
- `sensor.network_dns_local_dns` - DNS resolution

**Dashboard**:
- Access at `http://homeassistant.local:8080`
- Smokeping-style graphs
- Real-time monitoring
- Historical data

**Alerts**:
- Configurable thresholds
- Home Assistant notifications
- Recovery notifications

---

## Basic Configuration

Edit in Home Assistant (Settings → Add-ons → Network Monitoring → Configuration):

```yaml
ping_targets:
  - name: "Internet"
    address: "8.8.8.8"
    interval: 60
    enabled: true

dns_targets:
  - name: "Local DNS"
    server_ip: "192.168.1.1"
    test_domains: ["google.com"]
    interval: 120
    enabled: true
```

---

## Common Monitoring Targets

**Ping Targets:**
- `8.8.8.8` - Google DNS (internet)
- `1.1.1.1` - Cloudflare DNS (internet)
- `192.168.1.1` - Your router (local network)

**DNS Servers:**
- `192.168.1.1` - Your router
- `8.8.8.8` - Google DNS
- `1.1.1.1` - Cloudflare DNS

**Test Domains:**
- `google.com` - General connectivity
- `github.com` - Developer services
- `home-assistant.io` - HA services

---

## Need More Help?

- **Detailed Installation**: See [INSTALL_PREBUILT.md](INSTALL_PREBUILT.md)
- **Full Documentation**: See [README.md](README.md)
- **Usage Guide**: See [DOCS.md](DOCS.md)
- **Implementation Details**: See [IMPLEMENTATION.md](IMPLEMENTATION.md)

---

## Updating the Add-on

```bash
# Make your changes, then:
npm run build
./deploy.sh

# In Home Assistant: Restart the add-on
```

---

## Uninstalling

In Home Assistant:
1. Settings → Add-ons
2. Network Monitoring Add-on
3. Uninstall

---

**That's it! You're ready to monitor your network with Home Assistant!** 🎉
