# Network Monitoring Add-on Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Home Assistant Integration](#home-assistant-integration)
6. [Web Dashboard](#web-dashboard)
7. [API Reference](#api-reference)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Usage](#advanced-usage)

## Overview

The Network Monitoring Add-on provides comprehensive network monitoring capabilities for Home Assistant. It continuously monitors network connectivity through ICMP ping tests and DNS resolution performance, exposing results as native Home Assistant sensors.

### Key Capabilities

- **Ping Monitoring**: ICMP echo requests to configured targets
- **DNS Testing**: Forward and reverse DNS lookups
- **Real-time Sensors**: Native Home Assistant sensor entities
- **Historical Analysis**: Time-series data storage and visualization
- **Alert System**: Configurable thresholds and notifications
- **Web Dashboard**: Smokeping-style graphs and configuration interface

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Home Assistant Core                      │
├─────────────────────────────────────────────────────────────┤
│                Network Monitoring Add-on                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  Web Dashboard  │  │ Config Manager  │  │ HA Sensors  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Alert Manager   │  │ Data Storage    │  │ API Server  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Ping Monitor    │  │  DNS Monitor    │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Monitoring**: Ping and DNS monitors execute tests at configured intervals
2. **Storage**: Results are stored in SQLite database with timestamps
3. **Sensors**: Home Assistant sensors are updated with current status
4. **Alerts**: Alert manager checks thresholds and triggers notifications
5. **Dashboard**: Web interface displays real-time and historical data

## Installation

### Prerequisites

- Home Assistant OS, Supervised, or Container installation
- Network access for the add-on container
- Sufficient storage for historical data (configurable)

### Installation Steps

1. Navigate to **Settings** → **Add-ons** → **Add-on Store**
2. Click the menu (⋮) and select **Repositories**
3. Add the repository URL
4. Find "Network Monitoring Add-on" in the store
5. Click **Install**
6. Wait for installation to complete
7. Configure the add-on (see Configuration section)
8. Click **Start**

### Post-Installation

After starting the add-on:

1. Check the logs for any errors
2. Verify sensors appear in Home Assistant
3. Access the web dashboard via "Open Web UI"
4. Configure monitoring targets as needed

## Configuration

### Configuration File Location

The add-on configuration is managed through Home Assistant's add-on configuration interface. Configuration is stored in `/data/options.json` within the container.

### Ping Target Configuration

```yaml
ping_targets:
  - name: "Google DNS"
    address: "8.8.8.8"
    interval: 60
    enabled: true
```

**Parameters:**
- `name`: Display name for the target (used in sensor names)
- `address`: IP address or hostname to ping
- `interval`: Test interval in seconds (30-600)
- `enabled`: Enable or disable this target

### DNS Target Configuration

```yaml
dns_targets:
  - name: "Local DNS"
    server_ip: "192.168.1.1"
    test_domains:
      - "google.com"
      - "github.com"
    interval: 120
    enabled: true
```

**Parameters:**
- `name`: Display name for the DNS server
- `server_ip`: DNS server IP address
- `test_domains`: List of domains to query
- `interval`: Test interval in seconds (30-600)
- `enabled`: Enable or disable this target

### Alert Threshold Configuration

```yaml
alert_thresholds:
  ping_timeout_ms: 5000
  ping_loss_percent: 10.0
  dns_timeout_ms: 3000
  consecutive_failures: 3
```

**Parameters:**
- `ping_timeout_ms`: Ping timeout threshold (1000-30000 ms)
- `ping_loss_percent`: Packet loss threshold (0.0-100.0%)
- `dns_timeout_ms`: DNS query timeout threshold (1000-30000 ms)
- `consecutive_failures`: Failures before alert (1-10)

### General Configuration

```yaml
data_retention_days: 30
log_level: info
```

**Parameters:**
- `data_retention_days`: Days to retain historical data (1-365)
- `log_level`: Logging verbosity (debug, info, warning, error)

## Home Assistant Integration

### Sensor Entities

The add-on creates sensor entities for each monitoring target:

#### Ping Sensors

**Entity ID Format**: `sensor.network_ping_<sanitized_name>`

**State**: Response time in milliseconds or "unavailable"

**Attributes**:
```yaml
packet_loss: 0.0
status: "online"
last_success: "2024-01-14T10:30:00Z"
consecutive_failures: 0
target_address: "8.8.8.8"
```

#### DNS Sensors

**Entity ID Format**: `sensor.network_dns_<sanitized_name>`

**State**: Query response time in milliseconds or "unavailable"

**Attributes**:
```yaml
success_rate: 100.0
status: "available"
last_success: "2024-01-14T10:30:00Z"
consecutive_failures: 0
server_ip: "192.168.1.1"
test_domains: ["google.com", "github.com"]
```

### Using Sensors in Automations

#### Example: Internet Outage Alert

```yaml
automation:
  - alias: "Internet Outage Alert"
    trigger:
      - platform: state
        entity_id: sensor.network_ping_google_dns
        to: "unavailable"
        for:
          minutes: 2
    action:
      - service: notify.mobile_app
        data:
          title: "Network Alert"
          message: "Internet connectivity lost!"
          data:
            priority: high
```

#### Example: DNS Performance Degradation

```yaml
automation:
  - alias: "DNS Slow Response"
    trigger:
      - platform: numeric_state
        entity_id: sensor.network_dns_local_dns
        above: 1000
        for:
          minutes: 5
    action:
      - service: notify.persistent_notification
        data:
          title: "DNS Performance Issue"
          message: "Local DNS server responding slowly"
```

#### Example: Network Recovery Notification

```yaml
automation:
  - alias: "Network Recovered"
    trigger:
      - platform: state
        entity_id: sensor.network_ping_google_dns
        from: "unavailable"
        to: "online"
    action:
      - service: notify.mobile_app
        data:
          title: "Network Restored"
          message: "Internet connectivity has been restored"
```

### Dashboard Cards

#### Entities Card

```yaml
type: entities
title: Network Status
entities:
  - sensor.network_ping_google_dns
  - sensor.network_ping_local_router
  - sensor.network_dns_local_dns
```

#### History Graph Card

```yaml
type: history-graph
title: Network Latency
entities:
  - sensor.network_ping_google_dns
  - sensor.network_ping_cloudflare_dns
hours_to_show: 24
```

## Web Dashboard

### Accessing the Dashboard

- **URL**: `http://homeassistant.local:8080`
- **Alternative**: Click "Open Web UI" in the add-on page
- **Port**: Configurable in add-on configuration (default: 8080)

### Dashboard Features

#### Real-time Status View

- Current status of all monitoring targets
- Live response times and packet loss
- Color-coded status indicators (green/yellow/red)
- Last update timestamps

#### Historical Graphs

- Smokeping-style line graphs
- Min, max, and average response times
- Packet loss event highlighting
- DNS failure markers
- Interactive zoom and pan
- Time range selection (1h, 6h, 24h, 7d, 30d)

#### Configuration Interface

- Add/edit/remove monitoring targets
- Update alert thresholds
- Change monitoring intervals
- Enable/disable targets
- Real-time configuration validation

#### Alert History

- View past alerts
- Recovery event timeline
- Alert details and timestamps
- Filter by target or alert type

## API Reference

### Health Check Endpoint

```
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Get Ping History

```
GET /api/ping/:targetName/history?start=<timestamp>&end=<timestamp>
```

**Response**:
```json
{
  "target": "Google DNS",
  "data": [
    {
      "timestamp": "2024-01-14T10:00:00Z",
      "response_time": 15.2,
      "packet_loss": 0.0,
      "success": true
    }
  ]
}
```

### Get DNS History

```
GET /api/dns/:serverName/history?start=<timestamp>&end=<timestamp>
```

**Response**:
```json
{
  "server": "Local DNS",
  "data": [
    {
      "timestamp": "2024-01-14T10:00:00Z",
      "domain": "google.com",
      "response_time": 25.5,
      "success": true
    }
  ]
}
```

### WebSocket Connection

```javascript
const ws = new WebSocket('ws://homeassistant.local:8080/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data);
};
```

## Troubleshooting

### Common Issues

#### Add-on Won't Start

**Symptoms**: Add-on shows "stopped" status, won't start

**Solutions**:
1. Check add-on logs for error messages
2. Verify configuration is valid (check schema)
3. Ensure Home Assistant API is accessible
4. Check port 8080 is not in use by another service
5. Restart Home Assistant if needed

#### Sensors Not Appearing

**Symptoms**: No sensor entities created in Home Assistant

**Solutions**:
1. Restart Home Assistant after add-on installation
2. Check that targets are enabled in configuration
3. Verify add-on is running (check status and logs)
4. Ensure `homeassistant_api: true` in config.yaml
5. Check Home Assistant logs for integration errors

#### High CPU Usage

**Symptoms**: System slow, high CPU usage from add-on

**Solutions**:
1. Increase monitoring intervals (reduce frequency)
2. Reduce number of monitored targets
3. Decrease data retention period
4. Check for network issues causing timeouts
5. Review logs for excessive errors

#### Dashboard Not Loading

**Symptoms**: Web UI shows error or blank page

**Solutions**:
1. Verify add-on is running
2. Check port 8080 is accessible
3. Try accessing via IP address instead of hostname
4. Check browser console for JavaScript errors
5. Clear browser cache and reload
6. Check add-on logs for API server errors

#### Ping Tests Failing

**Symptoms**: All ping tests show "unavailable"

**Solutions**:
1. Verify network connectivity from add-on container
2. Check `host_network: true` in config.yaml
3. Verify `NET_RAW` privilege is granted
4. Test ping manually from add-on terminal
5. Check firewall rules

#### DNS Tests Failing

**Symptoms**: DNS queries timing out or failing

**Solutions**:
1. Verify DNS server IP addresses are correct
2. Check DNS server is accessible from add-on
3. Test DNS queries manually using `dig` or `nslookup`
4. Verify test domains are valid
5. Check DNS server allows queries from add-on IP

### Debug Mode

Enable debug logging for detailed troubleshooting:

```yaml
log_level: debug
```

This will provide verbose logging including:
- Detailed test execution logs
- Configuration validation details
- API request/response logs
- Database operations
- Error stack traces

### Log Analysis

Access add-on logs via:
1. Home Assistant UI: Add-ons → Network Monitoring → Logs
2. Command line: `ha addons logs network_monitoring_addon`

Look for:
- `ERROR` messages indicating failures
- `WARN` messages for potential issues
- Configuration validation errors
- Network connectivity problems
- Database errors

## Advanced Usage

### Custom Alert Rules

Create advanced automations using sensor attributes:

```yaml
automation:
  - alias: "High Packet Loss Alert"
    trigger:
      - platform: template
        value_template: >
          {{ state_attr('sensor.network_ping_google_dns', 'packet_loss') | float > 5.0 }}
        for:
          minutes: 5
    action:
      - service: notify.mobile_app
        data:
          title: "Network Quality Issue"
          message: >
            Packet loss detected: {{ state_attr('sensor.network_ping_google_dns', 'packet_loss') }}%
```

### Data Export

Export historical data for external analysis:

```bash
# Access add-on container
docker exec -it addon_network_monitoring_addon /bin/bash

# Export data from SQLite
sqlite3 /data/monitoring.db ".mode csv" ".output /data/export.csv" "SELECT * FROM ping_results WHERE timestamp > datetime('now', '-7 days');"
```

### Integration with Grafana

Use Home Assistant's Grafana integration to visualize monitoring data:

1. Install Grafana add-on
2. Configure Home Assistant data source
3. Create dashboards using sensor data
4. Set up custom alerts in Grafana

### Performance Tuning

Optimize for different use cases:

**High-frequency monitoring**:
```yaml
ping_targets:
  - interval: 30  # Minimum interval
data_retention_days: 7  # Shorter retention
```

**Low-resource systems**:
```yaml
ping_targets:
  - interval: 300  # Longer intervals
data_retention_days: 14  # Moderate retention
```

**Comprehensive monitoring**:
```yaml
ping_targets:
  - interval: 60
dns_targets:
  - interval: 120
data_retention_days: 90  # Extended retention
```

### Security Considerations

1. **Network Access**: Add-on requires `host_network` for ICMP ping
2. **Privileges**: `NET_RAW` capability needed for ping functionality
3. **Data Storage**: Historical data stored in `/data` directory
4. **API Access**: Web dashboard accessible on local network
5. **Home Assistant API**: Uses supervisor token for HA integration

### Backup and Restore

**Backup**:
- Historical data: Included in Home Assistant backups
- Configuration: Included in add-on configuration backup

**Manual Backup**:
```bash
# Backup database
docker exec addon_network_monitoring_addon cp /data/monitoring.db /backup/monitoring.db
```

**Restore**:
- Restore from Home Assistant backup
- Or manually copy database to `/data` directory

## Support and Contributing

- **Issues**: Report bugs on GitHub
- **Feature Requests**: Submit via GitHub issues
- **Documentation**: Contribute improvements via pull requests
- **Community**: Discuss on Home Assistant forums

## License

MIT License - See LICENSE file for details.
