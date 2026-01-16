# Install from GitHub Repository

You can install this add-on directly from GitHub in Home Assistant!

## Method 1: Add as Custom Repository (Easiest)

1. **In Home Assistant**, go to **Settings** → **Add-ons** → **Add-on Store**

2. Click the **⋮** (three dots) in the top right corner

3. Select **Repositories**

4. Add this URL:
   ```
   https://github.com/rigorighetti/network-monitoring-addon
   ```

5. Click **Add** → **Close**

6. Refresh the Add-on Store page

7. Find **Network Monitoring Add-on** in the list

8. Click on it and click **Install**

9. Once installed, go to **Configuration** tab and configure your targets

10. Go to **Info** tab and click **Start**

## Method 2: Manual Installation

If the repository method doesn't work, you can manually install:

1. SSH into your Home Assistant server
2. Run these commands:
   ```bash
   cd /addons
   git clone https://github.com/rigorighetti/network-monitoring-addon.git
   ```

3. In Home Assistant:
   - Go to **Settings** → **Add-ons**
   - Click **⋮** → **Check for updates**
   - Find **Network Monitoring Add-on** in Local add-ons
   - Click **Install**

## Updating the Add-on

### If installed via repository:
- Home Assistant will notify you of updates
- Click **Update** when available

### If installed manually:
```bash
cd /addons/network-monitoring-addon
git pull
```
Then rebuild the add-on in Home Assistant.

## Troubleshooting

**Add-on doesn't appear after adding repository:**
- Make sure the URL is exactly: `https://github.com/rigorighetti/network-monitoring-addon`
- Try refreshing the page
- Check Home Assistant logs for errors

**Build fails:**
- Check that you have enough disk space
- Look at the add-on logs for specific errors
- Try the manual installation method

## Support

For issues, please open an issue on GitHub:
https://github.com/rigorighetti/network-monitoring-addon/issues
