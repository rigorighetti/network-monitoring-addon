# Installation Guide for Network Monitoring Add-on

This guide provides detailed step-by-step instructions for installing the Network Monitoring Add-on on your Home Assistant instance.

## Prerequisites

- Home Assistant OS, Supervised, or Container installation
- Access to Home Assistant web interface
- SSH access to your Home Assistant instance (for local installation method)
- Basic understanding of YAML configuration

## Installation Methods

There are two ways to install this add-on:

1. **Method 1: Local Installation** (Recommended for development/testing)
2. **Method 2: GitHub Repository Installation** (For production use)

---

## Method 1: Local Installation (Development/Testing)

This method is ideal if you're developing or testing the add-on locally.

### Step 1: Access Your Home Assistant System

**Option A: Using SSH Add-on**
1. Install the "Terminal & SSH" add-on from the Home Assistant Add-on Store
2. Start the add-on and open the web terminal
3. Navigate to the addons directory:
   ```bash
   cd /addons
   ```

**Option B: Using SSH Client**
1. Enable SSH access on your Home Assistant instance
2. Connect via SSH:
   ```bash
   ssh root@homeassistant.local
   # or
   ssh root@<your-ha-ip-address>
   ```
3. Navigate to the addons directory:
   ```bash
   cd /addons
   ```

### Step 2: Copy the Add-on Files

You need to copy the entire `network-monitoring-addon` directory to your Home Assistant addons folder.

**If developing on the same machine:**
```bash
# Create the addon directory
mkdir -p /addons/network-monitoring-addon

# Copy all files from your development directory
cp -r /path/to/your/network-monitoring-addon/* /addons/network-monitoring-addon/
```

**If developing on a different machine:**

Use SCP to copy files:
```bash
# From your development machine
scp -r network-monitoring-addon root@homeassistant.local:/addons/
```

Or use the Samba Share add-on:
1. Install "Samba share" add-on from Home Assistant
2. Configure and start it
3. Connect to the share from your computer
4. Copy the `network-monitoring-addon` folder to the `addons` directory

### Step 3: Build the Add-on

Before the add-on appears in Home Assistant, you need to build it:

```bash
cd /addons/network-monitoring-addon

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

### Step 4: Reload Add-ons in Home Assistant

1. Go to **Settings** → **Add-ons**
2. Click the **⋮** (three dots) in the top right
3. Click **Check for updates** or **Reload**
4. The "Network Monitoring Add-on" should now appear in the local add-ons section

### Step 5: Install the Add-on

1. Click on "Network Monitoring Add-on"
2. Click **Install**
3. Wait for the installation to complete (this may take several minutes)

### Step 6: Configure the Add-on

1. Go to the **Configuration** tab
2. Edit the YAML configuration with your monitoring targets:

```yaml
ping_targets:
  - name: "Google DNS"
    address: "8.8.8.8"
    interval: 60
    enabled: true
  - name: "Local Router"
    address: "192.168.1.1"
    interval: 30
    enabled: true

dns_targets:
  - name: "Local DNS"
    server_ip: "192.168.1.1"
    test_domains:
      - "google.com"
      - "github.com"
    interval: 120
    enabled: true

alert_thresholds:
  ping_timeout_ms: 5000
  ping_loss_percent: 10.0
  dns_timeout_ms: 3000
  consecutive_failures: 3

data_retention_days: 30
log_level: info
```

3. Click **Save**

### Step 7: Start the Add-on

1. Go to the **Info** tab
2. Toggle **Start on boot** (optional but recommended)
3. Click **Start**
4. Monitor the **Log** tab for any errors

### Step 8: Verify Installation

1. Check the logs for successful startup messages
2. Click **Open Web UI** to access the dashboard
3. Go to **Settings** → **Devices & Services** → **Entities**
4. Search for `sensor.network_` to see your monitoring sensors

---

## Method 2: GitHub Repository Installation (Production)

This method is for installing from a published repository.

### Step 1: Add Custom Repository

1. Go to **Settings** → **Add-ons** → **Add-on Store**
2. Click the **⋮** (three dots) in the top right
3. Click **Repositories**
4. Add your repository URL:
   ```
   https://github.com/YOUR_USERNAME/homeassistant-addons
   ```
5. Click **Add**

### Step 2: Install the Add-on

1. Refresh the Add-on Store page
2. Scroll down to find "Network Monitoring Add-on"
3. Click on it
4. Click **Install**
5. Wait for installation to complete

### Step 3: Configure and Start

Follow Steps 6-8 from Method 1 above.

---

## Post-Installation Setup

### Configure Monitoring Targets

Edit your configuration to monitor the targets relevant to your network:

**Common Ping Targets:**
- `8.8.8.8` - Google DNS (internet connectivity)
- `1.1.1.1` - Cloudflare DNS (internet connectivity)
- `192.168.1.1` - Your router (local network)
- Your ISP gateway IP
- Important local servers

**Common DNS Targets:**
- Your router's DNS server
- Public DNS servers (8.8.8.8, 1.1.1.1)
- Your local DNS server (if you have one)

**Test Domains:**
- `google.com` - General internet connectivity
- `github.com` - Developer services
- `home-assistant.io` - Home Assistant services
- Your own domain (if applicable)

### Set Up Automations

Create automations to respond to network issues:

```yaml
# Example: Notify on internet outage
automation:
  - alias: "Internet Down Alert"
    trigger:
      - platform: state
        entity_id: sensor.network_ping_google_dns
        to: "unavailable"
        for:
          minutes: 2
    action:
      - service: notify.mobile_app_your_phone
        data:
          title: "Network Alert"
          message: "Internet connection lost!"
          
  - alias: "Internet Restored"
    trigger:
      - platform: state
        entity_id: sensor.network_ping_google_dns
        from: "unavailable"
        to: "online"
    action:
      - service: notify.mobile_app_your_phone
        data:
          title: "Network Alert"
          message: "Internet connection restored!"
```

### Add to Dashboard

Add monitoring cards to your Home Assistant dashboard:

```yaml
# Example Lovelace card
type: entities
title: Network Status
entities:
  - entity: sensor.network_ping_google_dns
    name: Internet (Google DNS)
  - entity: sensor.network_ping_local_router
    name: Local Router
  - entity: sensor.network_dns_local_dns
    name: Local DNS Server
```

---

## Troubleshooting

### Add-on Not Appearing

**Problem:** Add-on doesn't show up after copying files

**Solutions:**
1. Verify files are in `/addons/network-monitoring-addon/`
2. Check that `config.yaml` exists and is valid
3. Reload add-ons: Settings → Add-ons → ⋮ → Check for updates
4. Restart Home Assistant if needed

### Build Failures

**Problem:** TypeScript build fails

**Solutions:**
1. Ensure Node.js is installed: `node --version`
2. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```
3. Check for syntax errors in TypeScript files

### Add-on Won't Start

**Problem:** Add-on fails to start

**Solutions:**
1. Check the logs for error messages
2. Verify configuration is valid YAML
3. Ensure intervals are between 30-600 seconds
4. Check that port 8080 is not in use
5. Verify Home Assistant API is accessible

### Sensors Not Appearing

**Problem:** Sensors don't show up in Home Assistant

**Solutions:**
1. Restart Home Assistant: Settings → System → Restart
2. Check add-on logs for errors
3. Verify targets are enabled in configuration
4. Wait a few minutes for first results
5. Check Developer Tools → States for `sensor.network_*`

### Permission Errors

**Problem:** "Permission denied" or "Cannot execute ping"

**Solutions:**
1. Verify add-on has `NET_RAW` privilege (should be automatic)
2. Check Dockerfile has `privileged: - NET_RAW`
3. Restart the add-on

### High CPU Usage

**Problem:** Add-on using too much CPU

**Solutions:**
1. Increase monitoring intervals (reduce frequency)
2. Reduce number of monitored targets
3. Decrease data retention period
4. Check for network issues causing timeouts

### Dashboard Not Loading

**Problem:** Web UI shows blank page or errors

**Solutions:**
1. Check add-on is running
2. Verify port 8080 is accessible
3. Try accessing via IP: `http://<ha-ip>:8080`
4. Check browser console for JavaScript errors
5. Clear browser cache

---

## Updating the Add-on

### Local Installation Updates

```bash
# Navigate to addon directory
cd /addons/network-monitoring-addon

# Pull latest changes (if using git)
git pull

# Or copy updated files
# cp -r /path/to/updated/files/* .

# Rebuild
npm install
npm run build

# Restart add-on from Home Assistant UI
```

### Repository Installation Updates

1. Go to **Settings** → **Add-ons**
2. Click on "Network Monitoring Add-on"
3. If an update is available, click **Update**

---

## Uninstalling

1. Go to **Settings** → **Add-ons**
2. Click on "Network Monitoring Add-on"
3. Click **Uninstall**
4. Confirm the uninstallation
5. (Optional) Remove sensor entities from your dashboard
6. (Optional) Remove related automations

---

## Advanced Configuration

### Custom Data Directory

By default, data is stored in `/data`. To use a different location:

1. Edit `config.yaml` and add:
   ```yaml
   map:
     - config:rw
     - ssl
     - /your/custom/path:/data
   ```

### Custom Port

To use a different port than 8080:

1. Edit `config.yaml`:
   ```yaml
   ports:
     "9090/tcp": 9090
   ```
2. Update the webui URL accordingly

### Debug Logging

For troubleshooting, enable debug logging:

```yaml
log_level: debug
```

Then check the logs for detailed information.

---

## Getting Help

If you encounter issues:

1. Check the **Log** tab in the add-on for error messages
2. Review this installation guide
3. Check the [README.md](README.md) for configuration details
4. Review the [DOCS.md](DOCS.md) for usage information
5. Search existing GitHub issues
6. Create a new issue with:
   - Home Assistant version
   - Add-on version
   - Configuration (remove sensitive data)
   - Log output
   - Steps to reproduce

---

## Next Steps

After successful installation:

1. ✅ Configure your monitoring targets
2. ✅ Set up automations for alerts
3. ✅ Add monitoring cards to your dashboard
4. ✅ Access the web dashboard to view historical data
5. ✅ Adjust alert thresholds based on your network
6. ✅ Monitor the logs initially to ensure everything works

Enjoy monitoring your network with Home Assistant!
