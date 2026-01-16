# Network Monitoring Add-on for Home Assistant

[![GitHub Release][releases-shield]][releases]
[![License][license-shield]](LICENSE)

A comprehensive network monitoring solution that provides continuous ping and DNS testing capabilities for Home Assistant. Monitor your internet connectivity, DNS resolution performance, and receive alerts when issues are detected.

## About

This add-on provides professional-grade network monitoring capabilities directly within your Home Assistant installation. It continuously monitors network connectivity and DNS resolution, exposing the results as native Home Assistant sensors that can be used in automations and dashboards.

## Features

- **Continuous Ping Monitoring**: Monitor multiple targets with configurable intervals (1s - 10min)
- **Advanced DNS Resolution Testing**: Test DNS servers with multiple domains and record types
  - **Separate Query Type Monitoring**: A (IPv4), AAAA (IPv6), and PTR (Reverse DNS) records tracked independently
  - **Network Jitter Detection**: A records tested 3 times per cycle to measure real network variation
  - **Accurate Performance Metrics**: Min/Max bands show actual network jitter, not query type differences
- **Home Assistant Integration**: Native sensor entities for automations and dashboards
- **Web Dashboard**: Smokeping-style graphs for historical analysis and trend visualization
- **Configurable Alerts**: Customizable thresholds and notifications through Home Assistant
- **Real-time Updates**: Live monitoring data and status updates via WebSocket
- **Historical Data**: Configurable data retention for trend analysis
- **Error Resilience**: Automatic recovery from temporary failures
- **Independent Scheduling**: Separate interval configuration for ping and DNS tests

## Installation

### Quick Install from GitHub

Add this repository URL to Home Assistant:
```
https://github.com/rigorighetti/network-monitoring-addon
```

**Detailed instructions:** See [INSTALL_FROM_GITHUB.md](INSTALL_FROM_GITHUB.md)

### Manual Installation

1. Add this repository to your Home Assistant add-on store
2. Click "Install" on the "Network Monitoring Add-on"
3. Configure your monitoring targets in the add-on configuration tab
4. Click "Start" to launch the add-on
5. Access the web dashboard via the "Open Web UI" button

## Configuration

### Basic Configuration

The add-on can be configured through the Home Assistant UI. Here's a complete example:

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
  - name: "ISP Gateway"
    address: "10.0.0.1"
    interval: 60
    enabled: true

dns_targets:
  - name: "Local DNS"
    server_ip: "192.168.1.1"
    test_domains:
      - "google.com"
      - "github.com"
      - "home-assistant.io"
    interval: 120
    enabled: true
  - name: "Cloudflare DNS"
    server_ip: "1.1.1.1"
    test_domains:
      - "google.com"
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

### Configuration Options

#### Ping Targets

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | string | Yes | Friendly name for the target |
| `address` | string | Yes | IP address or hostname to monitor |
| `interval` | integer | Yes | Test interval in seconds (1-600) |
| `enabled` | boolean | Yes | Enable/disable this target |

#### DNS Targets

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | string | Yes | Friendly name for the DNS server |
| `server_ip` | string | Yes | DNS server IP address |
| `test_domains` | list | Yes | List of domains to test |
| `interval` | integer | Yes | Test interval in seconds (1-600) |
| `enabled` | boolean | Yes | Enable/disable this target |

#### Alert Thresholds

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ping_timeout_ms` | integer | 5000 | Ping timeout in milliseconds |
| `ping_loss_percent` | float | 10.0 | Packet loss threshold percentage |
| `dns_timeout_ms` | integer | 3000 | DNS query timeout in milliseconds |
| `consecutive_failures` | integer | 3 | Failures before triggering alert |

#### General Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `data_retention_days` | integer | 30 | Days to retain historical data (1-365) |
| `log_level` | string | info | Logging level (debug, info, warning, error) |

## Home Assistant Sensors

The add-on automatically creates sensors for each monitoring target:

### Ping Sensors

- **Entity ID**: `sensor.network_ping_<target_name>`
- **State**: Response time in milliseconds or "unavailable"
- **Attributes**:
  - `packet_loss`: Packet loss percentage
  - `status`: online, offline, or degraded
  - `last_success`: Timestamp of last successful ping
  - `consecutive_failures`: Number of consecutive failures

### DNS Sensors

- **Entity ID**: `sensor.network_dns_<target_name>`
- **State**: Query response time in milliseconds or "unavailable"
- **Attributes**:
  - `success_rate`: Percentage of successful queries
  - `status`: available, unavailable, or slow
  - `last_success`: Timestamp of last successful query
  - `consecutive_failures`: Number of consecutive failures

### Example Automation

```yaml
automation:
  - alias: "Alert on Internet Outage"
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
```

## Web Dashboard

Access the web dashboard at `http://homeassistant.local:8080` (or click "Open Web UI" in the add-on page).

### Dashboard Features

- **Real-time Status**: Live monitoring of all configured targets
- **Historical Graphs**: Smokeping-style line graphs showing:
  - Response time trends (min, max, average)
  - Packet loss events for ping monitoring
  - DNS resolution performance by query type
- **Configurable Data Intervals**: Choose aggregation period for graphs:
  - **1 Minute**: Maximum detail for recent data analysis
  - **5 Minutes**: Balanced view for short-term trends
  - **15 Minutes**: Default view for daily monitoring (recommended)
  - **1 Hour**: Long-term trends for weekly/monthly analysis
- **Separate DNS Query Type Graphs**: 
  - **A Records (IPv4)**: Primary graph with min/max/avg showing network jitter from 3 test queries
  - **AAAA Records (IPv6)**: Single-line graph for IPv6 resolution performance
  - **PTR Records (Reverse DNS)**: Single-line graph for reverse lookup performance
- **Time Range Selection**: View data from different time periods
- **Configuration Management**: Update monitoring targets without restart
- **Alert History**: View past alerts and recovery events
- **Ingress Support**: Access directly from Home Assistant sidebar

### Understanding DNS Monitoring

The add-on performs comprehensive DNS testing for each configured server with intelligent query spacing to prevent DNS resolver overload:

**Query Timing:**
- **A Records**: Tested 3 times per cycle with random delays (500-3000ms) between attempts
- **AAAA Records**: Tested once per cycle
- **PTR Records**: Tested once per cycle

**Query Types Tested:**
- **A Records (IPv4)**: Tested 3 times per cycle to measure network jitter and variation
- **AAAA Records (IPv6)**: Tested once per cycle for IPv6 connectivity
- **PTR Records (Reverse DNS)**: Tested once per cycle for reverse lookup capability

**Why Separate Graphs?**

Different DNS query types have inherently different response characteristics:
- A records are typically fastest (5-20ms) and most cached
- AAAA records can be slower (10-50ms) and may timeout if IPv6 isn't supported
- PTR records are often slowest (50-200ms+) as they require additional lookups

By separating them into individual graphs, you can:
- See true network jitter in A record responses (not just query type differences)
- Identify IPv6 connectivity issues independently
- Monitor reverse DNS performance without affecting primary metrics

**Interpreting the A Record Graph:**

The min/max band on the A record graph represents real network variation:
- **Narrow band**: Stable, consistent network performance
- **Wide band**: Network jitter or congestion
- **Spikes**: Temporary network issues or DNS server load

## Troubleshooting

### Add-on won't start

1. Check the add-on logs for error messages
2. Verify your configuration is valid
3. Ensure Home Assistant API is accessible
4. Check that required ports are not in use

### Sensors not appearing

1. Restart Home Assistant after add-on installation
2. Check that targets are enabled in configuration
3. Verify add-on is running (check logs)
4. Ensure Home Assistant API integration is enabled

### High CPU usage

1. Reduce monitoring frequency (increase intervals)
2. Reduce number of monitored targets
3. Decrease data retention period

### Dashboard not loading

1. Check that port 8080 is accessible
2. Verify add-on is running
3. Check browser console for errors
4. Try accessing via IP address instead of hostname

## Support

For issues, feature requests, and contributions:

- **Issues**: [GitHub Issues](https://github.com/homeassistant/addons/issues)
- **Documentation**: [Add-on Documentation](https://github.com/homeassistant/addons/blob/main/network-monitoring-addon/DOCS.md)
- **Community**: [Home Assistant Community Forum](https://community.home-assistant.io/)

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

[releases-shield]: https://img.shields.io/github/release/homeassistant/addons.svg
[releases]: https://github.com/homeassistant/addons/releases
[license-shield]: https://img.shields.io/github/license/homeassistant/addons.svg