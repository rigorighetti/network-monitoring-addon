# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-14

### Added
- Initial release of Network Monitoring Add-on
- Continuous ping monitoring with configurable intervals
- DNS resolution testing with multiple domains
- Home Assistant sensor integration
- Web dashboard with Smokeping-style graphs
- Real-time monitoring updates via WebSocket
- Configurable alert thresholds
- Historical data storage and retrieval
- Automatic error recovery
- Independent scheduling for ping and DNS tests
- Configuration hot-reload without restart
- Health check endpoint for monitoring
- Comprehensive logging and error reporting

### Features
- Support for multiple ping targets
- Support for multiple DNS servers and test domains
- Packet loss detection and reporting
- DNS performance degradation detection
- Configurable data retention policies
- Alert notifications through Home Assistant
- Recovery notifications
- Web-based configuration interface
- Time-series data visualization
- Event highlighting on graphs
- Zoom and pan functionality for historical data

### Technical
- TypeScript implementation
- SQLite for data storage
- Express.js for API server
- WebSocket for real-time updates
- Property-based testing with fast-check
- Comprehensive unit and integration tests
- Docker containerization
- Home Assistant add-on integration
- Graceful shutdown handling
- Health monitoring

## [Unreleased]

### Added
- Data interval selector dropdown in dashboard (1 min, 5 min, 15 min, 1 hour options)
- User-configurable data aggregation periods for graph visualization
- Random delay (500-3000ms) between DNS A record query attempts to prevent DNS resolver overload
- Automatic copying of static files during build process
- Data interval selector now applies to both ping and DNS graphs

### Changed
- DNS A record queries now use randomized delays instead of fixed 100ms intervals
- Dashboard graphs now support dynamic interval selection for better data granularity control
- Build process now includes static file copying to dist folder
- Ping charts now fetch data dynamically with interval parameter like DNS charts

### Fixed
- Static files (HTML, CSS, JS) now properly copied to dist folder during build
- Checkbox toggles (Show Min/Max, Packet Loss, Events) now properly reload data instead of showing empty graphs
- Dockerfile now builds from source inside container for consistent deployments

### Planned
- Support for additional DNS record types (MX, TXT, etc.)
- Traceroute functionality
- Network path visualization
- Export data to CSV/JSON
- Custom alert rules
- Integration with external monitoring services
- Mobile-responsive dashboard improvements
- Dark mode for web dashboard
