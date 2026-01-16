ARG BUILD_FROM=ghcr.io/hassio-addons/base:15.0.7
FROM $BUILD_FROM

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install build dependencies and runtime dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    iputils \
    bind-tools \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy source code
COPY src/ ./src/

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Copy run script and make executable
COPY run.sh ./
RUN chmod +x run.sh

# Create data directory
RUN mkdir -p /data

# Expose port for web interface
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Labels for Home Assistant add-on
LABEL \
    io.hass.name="Network Monitoring Add-on" \
    io.hass.description="Comprehensive network monitoring with ping and DNS testing" \
    io.hass.version="1.1.0" \
    io.hass.type="addon" \
    io.hass.arch="armhf|armv7|aarch64|amd64|i386"

# Run the application
CMD ["./run.sh"]
