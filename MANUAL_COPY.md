# Manual Copy Instructions

If the deploy script doesn't work, here's how to manually copy files to Home Assistant.

## Step 1: Build the Project

```bash
cd network-monitoring-addon
npm run build
```

Verify the `dist` folder was created:
```bash
ls -la dist/
```

## Step 2: Prepare the Dockerfile

```bash
cp Dockerfile.prebuilt Dockerfile
```

## Step 3: Copy Files to Home Assistant

### Method A: Using SCP (Command Line)

Replace `192.168.1.100` with your Home Assistant IP:

```bash
# Create the directory on Home Assistant
ssh root@192.168.1.100 "mkdir -p /addons/network-monitoring-addon"

# Copy essential files
scp config.yaml root@192.168.1.100:/addons/network-monitoring-addon/
scp Dockerfile root@192.168.1.100:/addons/network-monitoring-addon/
scp run.sh root@192.168.1.100:/addons/network-monitoring-addon/
scp package.json root@192.168.1.100:/addons/network-monitoring-addon/
scp package-lock.json root@192.168.1.100:/addons/network-monitoring-addon/
scp icon.png root@192.168.1.100:/addons/network-monitoring-addon/

# Copy the dist folder (this is the important one!)
scp -r dist root@192.168.1.100:/addons/network-monitoring-addon/

# Optional: Copy documentation
scp README.md root@192.168.1.100:/addons/network-monitoring-addon/
scp DOCS.md root@192.168.1.100:/addons/network-monitoring-addon/
scp CHANGELOG.md root@192.168.1.100:/addons/network-monitoring-addon/
```

### Method B: Using Samba Share (GUI)

1. **Install Samba Share Add-on in Home Assistant:**
   - Go to Settings → Add-ons → Add-on Store
   - Search for "Samba share"
   - Install and start it

2. **Connect from your computer:**
   - **Windows:** Open File Explorer, type `\\192.168.1.100\addons`
   - **Mac:** Finder → Go → Connect to Server → `smb://192.168.1.100/addons`
   - **Linux:** File manager → Connect to Server → `smb://192.168.1.100/addons`

3. **Copy the folder:**
   - Create a folder called `network-monitoring-addon`
   - Copy these files into it:
     - `config.yaml`
     - `Dockerfile`
     - `run.sh`
     - `package.json`
     - `package-lock.json`
     - `icon.png`
     - `dist/` (entire folder)
     - `README.md` (optional)
     - `DOCS.md` (optional)
     - `CHANGELOG.md` (optional)

### Method C: Using SFTP Client (GUI)

Use FileZilla, WinSCP, or Cyberduck:

1. **Connect:**
   - Host: `192.168.1.100` (your Home Assistant IP)
   - Username: `root`
   - Port: `22`
   - Protocol: SFTP

2. **Navigate to `/addons/`**

3. **Create folder:** `network-monitoring-addon`

4. **Upload files:**
   - Drag and drop the files listed in Method B

## Step 4: Verify Files Were Copied

SSH into Home Assistant:

```bash
ssh root@192.168.1.100
```

Check the files:

```bash
# List files
ls -la /addons/network-monitoring-addon/

# Should see:
# config.yaml
# Dockerfile
# run.sh
# package.json
# package-lock.json
# dist/
# icon.png
```

Check dist folder has content:

```bash
ls -la /addons/network-monitoring-addon/dist/

# Should see multiple .js files and folders
```

## Step 5: Install in Home Assistant

1. Open Home Assistant web interface
2. Go to **Settings** → **Add-ons**
3. Click **⋮** (three dots) → **Check for updates**
4. Scroll down to "Local add-ons"
5. Find "Network Monitoring Add-on"
6. Click on it
7. Click **Install**
8. Wait 2-5 minutes for installation
9. Go to **Configuration** tab and configure your targets
10. Go to **Info** tab and click **Start**

## Troubleshooting

### "Add-on not appearing"

1. Verify files are in the right location:
   ```bash
   ssh root@192.168.1.100
   ls -la /addons/network-monitoring-addon/
   ```

2. Check config.yaml is valid:
   ```bash
   cat /addons/network-monitoring-addon/config.yaml
   ```

3. Reload add-ons again in Home Assistant UI

### "Permission denied" when copying

Try with sudo or check SSH is enabled:
```bash
# Enable SSH in Home Assistant:
# Settings → Add-ons → Terminal & SSH → Install & Start
```

### "Connection refused"

1. Check Home Assistant is running
2. Verify the IP address is correct
3. Make sure SSH is enabled (Terminal & SSH add-on)
4. Try pinging: `ping 192.168.1.100`

## Quick Reference: Files Checklist

Before installing, verify you have:

- ✅ `config.yaml` - Add-on configuration
- ✅ `Dockerfile` - Docker build file (use Dockerfile.prebuilt)
- ✅ `run.sh` - Startup script
- ✅ `package.json` - Dependencies list
- ✅ `package-lock.json` - Dependency versions
- ✅ `dist/` folder - **All compiled JavaScript files**
- ✅ `icon.png` - Add-on icon (optional)

The `dist` folder should contain:
- `index.js`
- `config/` folder
- `monitoring/` folder
- `sensors/` folder
- `storage/` folder
- `alerts/` folder
- `dashboard/` folder
- `error-handling/` folder
- `utils/` folder

## Need Help?

If you're still having trouble:

1. Check you ran `npm run build` successfully
2. Verify the `dist` folder exists and has content
3. Make sure you're using `Dockerfile.prebuilt` as `Dockerfile`
4. Try the deploy script with your IP: `HA_HOST=192.168.1.100 ./deploy.sh`
