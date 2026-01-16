# Pre-built Installation Guide

This guide is for installing the add-on when you've already built it on your development machine.

## Prerequisites

- Built the project on your development machine (`npm run build` completed)
- SSH access to your Home Assistant instance
- The `dist` folder exists in your project

## Installation Steps

### Step 1: Build on Your Development Machine

```bash
# On your development machine (where npm is installed)
cd network-monitoring-addon

# Install dependencies and build
npm install
npm run build

# Verify dist folder was created
ls -la dist/
```

### Step 2: Use the Pre-built Dockerfile

Rename the Dockerfile to use the pre-built version:

```bash
# Backup original
mv Dockerfile Dockerfile.original

# Use pre-built version
mv Dockerfile.prebuilt Dockerfile
```

Or simply replace the content of `Dockerfile` with `Dockerfile.prebuilt`.

### Step 3: Copy to Home Assistant

**Option A: Using SCP**

```bash
# From your development machine
scp -r network-monitoring-addon root@homeassistant.local:/addons/

# Or using IP address
scp -r network-monitoring-addon root@192.168.1.xxx:/addons/
```

**Option B: Using Samba Share**

1. Install "Samba share" add-on in Home Assistant
2. Configure and start it
3. Connect to `\\homeassistant.local\addons` from your computer
4. Copy the `network-monitoring-addon` folder there

**Option C: Using SFTP Client**

Use FileZilla, WinSCP, or Cyberduck:
- Host: `homeassistant.local` or your HA IP
- Username: `root`
- Port: `22`
- Copy folder to `/addons/`

### Step 4: Verify Files on Home Assistant

SSH into Home Assistant and verify:

```bash
ssh root@homeassistant.local

# Check files are there
ls -la /addons/network-monitoring-addon/

# Verify dist folder exists
ls -la /addons/network-monitoring-addon/dist/

# Should see files like:
# - config.yaml
# - Dockerfile
# - run.sh
# - package.json
# - dist/ (folder with .js files)
```

### Step 5: Reload Add-ons in Home Assistant

1. Open Home Assistant web interface
2. Go to **Settings** → **Add-ons**
3. Click the **⋮** (three dots) in the top right corner
4. Click **Check for updates** or **Reload**
5. Wait a few seconds

### Step 6: Install the Add-on

1. Scroll down to the "Local add-ons" section
2. Find "Network Monitoring Add-on"
3. Click on it
4. Click **Install**
5. Wait for installation (Docker will build the image - this takes 2-5 minutes)

### Step 7: Configure

1. Go to the **Configuration** tab
2. Edit the configuration:

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

### Step 8: Start the Add-on

1. Go to the **Info** tab
2. Toggle **Start on boot** (recommended)
3. Click **Start**
4. Monitor the **Log** tab for startup messages

### Step 9: Verify It's Working

1. Check logs show "Network monitoring started successfully"
2. Click **Open Web UI** to access the dashboard
3. Go to **Developer Tools** → **States**
4. Search for `sensor.network_` to see your sensors

## Troubleshooting

### Add-on Not Appearing

If the add-on doesn't appear after Step 5:

```bash
# SSH into Home Assistant
ssh root@homeassistant.local

# Verify files
ls -la /addons/network-monitoring-addon/

# Check config.yaml exists and is valid
cat /addons/network-monitoring-addon/config.yaml

# Check Dockerfile exists
cat /addons/network-monitoring-addon/Dockerfile
```

Then reload add-ons again in the UI.

### Build Fails During Installation

Check the installation logs. Common issues:

1. **Missing dist folder**: Make sure you copied the `dist` folder
   ```bash
   ls -la /addons/network-monitoring-addon/dist/
   ```

2. **Wrong Dockerfile**: Make sure you're using `Dockerfile.prebuilt` content
   ```bash
   cat /addons/network-monitoring-addon/Dockerfile | grep "Copy pre-built"
   ```

3. **Permission issues**: Fix permissions
   ```bash
   chmod -R 755 /addons/network-monitoring-addon/
   ```

### Add-on Won't Start

1. Check the logs in the **Log** tab
2. Verify configuration is valid YAML
3. Check that port 8080 isn't in use by another add-on

## Alternative: Quick Install Script

Create this script on your development machine:

```bash
#!/bin/bash
# deploy-addon.sh

echo "Building add-on..."
npm run build

echo "Preparing Dockerfile..."
cp Dockerfile.prebuilt Dockerfile

echo "Copying to Home Assistant..."
scp -r ../network-monitoring-addon root@homeassistant.local:/addons/

echo "Done! Now reload add-ons in Home Assistant UI"
echo "Settings → Add-ons → ⋮ → Check for updates"
```

Make it executable and run:

```bash
chmod +x deploy-addon.sh
./deploy-addon.sh
```

## Updating the Add-on

To update after making changes:

```bash
# On development machine
cd network-monitoring-addon
npm run build

# Copy to Home Assistant
scp -r dist root@homeassistant.local:/addons/network-monitoring-addon/

# In Home Assistant UI
# Settings → Add-ons → Network Monitoring → Restart
```

## Next Steps

After successful installation:

1. ✅ Configure your monitoring targets
2. ✅ Set up automations for alerts  
3. ✅ Add monitoring cards to your dashboard
4. ✅ Access the web dashboard at `http://homeassistant.local:8080`

See [README.md](README.md) for usage details and [DOCS.md](DOCS.md) for advanced configuration.
