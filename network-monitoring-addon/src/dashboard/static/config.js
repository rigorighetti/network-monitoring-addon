/**
 * Configuration interface for Network Monitoring Dashboard
 * Handles ping targets, DNS servers, and alert threshold configuration
 */

class ConfigurationManager {
  constructor() {
    this.currentConfig = null;
    this.validationErrors = [];
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadConfiguration();
  }

  setupEventListeners() {
    // Save configuration button
    document.getElementById('saveConfig').addEventListener('click', () => {
      this.saveConfiguration();
    });

    // Reset configuration button
    document.getElementById('resetConfig').addEventListener('click', () => {
      this.resetConfiguration();
    });

    // Validate configuration button
    document.getElementById('validateConfig').addEventListener('click', () => {
      this.validateConfiguration();
    });

    // Add ping target button
    document.getElementById('addPingTarget').addEventListener('click', () => {
      this.addPingTarget();
    });

    // Add DNS target button
    document.getElementById('addDnsTarget').addEventListener('click', () => {
      this.addDnsTarget();
    });

    // Form validation on input
    document.addEventListener('input', (e) => {
      if (e.target.matches('.config-input')) {
        this.validateField(e.target);
      }
    });

    // Remove target buttons (delegated event handling)
    document.addEventListener('click', (e) => {
      if (e.target.matches('.remove-target')) {
        this.removeTarget(e.target);
      }
    });
  }

  async loadConfiguration() {
    this.showLoading(true);
    
    try {
      // Detect if we're running in ingress
      const isIngress = window.location.pathname.includes('/api/hassio_ingress/');
      
      // In ingress mode, we need to construct the full path
      let apiUrl;
      if (isIngress) {
        // Extract the ingress base path and append our API endpoint
        const pathParts = window.location.pathname.split('/');
        const ingressIndex = pathParts.indexOf('api');
        const basePath = pathParts.slice(0, ingressIndex + 3).join('/'); // includes /api/hassio_ingress/{token}
        apiUrl = `${basePath}/api/config`;
      } else {
        apiUrl = '/api/config';
      }
      
      console.log('Loading config from:', apiUrl);
      
      const response = await fetch(apiUrl);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load configuration');
      }

      this.currentConfig = result.data;
      this.renderConfiguration();
      this.showMessage('Configuration loaded successfully', 'success');

    } catch (error) {
      console.error('Failed to load configuration:', error);
      this.showMessage('Failed to load configuration: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  renderConfiguration() {
    if (!this.currentConfig) return;

    // Render ping targets
    this.renderPingTargets();
    
    // Render DNS targets
    this.renderDnsTargets();
    
    // Render alert thresholds
    this.renderAlertThresholds();
    
    // Render data retention
    this.renderDataRetention();
  }

  renderPingTargets() {
    const container = document.getElementById('pingTargetsContainer');
    container.innerHTML = '';

    this.currentConfig.ping_targets.forEach((target, index) => {
      const targetElement = this.createPingTargetElement(target, index);
      container.appendChild(targetElement);
    });
  }

  renderDnsTargets() {
    const container = document.getElementById('dnsTargetsContainer');
    container.innerHTML = '';

    this.currentConfig.dns_targets.forEach((target, index) => {
      const targetElement = this.createDnsTargetElement(target, index);
      container.appendChild(targetElement);
    });
  }

  renderAlertThresholds() {
    const thresholds = this.currentConfig.alert_thresholds;
    
    document.getElementById('pingTimeoutMs').value = thresholds.ping_timeout_ms;
    document.getElementById('pingLossPercent').value = thresholds.ping_loss_percent;
    document.getElementById('dnsTimeoutMs').value = thresholds.dns_timeout_ms;
    document.getElementById('consecutiveFailures').value = thresholds.consecutive_failures;
  }

  renderDataRetention() {
    document.getElementById('dataRetentionDays').value = this.currentConfig.data_retention_days;
  }

  createPingTargetElement(target, index) {
    const div = document.createElement('div');
    div.className = 'target-config';
    div.innerHTML = `
      <div class="target-header">
        <h4>Ping Target ${index + 1}</h4>
        <button type="button" class="btn btn-danger btn-sm remove-target" data-type="ping" data-index="${index}">
          Remove
        </button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label for="pingName${index}">Name:</label>
          <input type="text" id="pingName${index}" class="config-input" 
                 data-field="ping_targets.${index}.name" 
                 value="${target.name}" required>
          <div class="field-error"></div>
        </div>
        <div class="form-group">
          <label for="pingAddress${index}">Address:</label>
          <input type="text" id="pingAddress${index}" class="config-input" 
                 data-field="ping_targets.${index}.address" 
                 value="${target.address}" required 
                 placeholder="IP address or hostname">
          <div class="field-error"></div>
        </div>
        <div class="form-group">
          <label for="pingInterval${index}">Interval (seconds):</label>
          <input type="number" id="pingInterval${index}" class="config-input" 
                 data-field="ping_targets.${index}.interval" 
                 value="${target.interval}" min="1" max="600" required>
          <div class="field-error"></div>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="pingEnabled${index}" class="config-input" 
                   data-field="ping_targets.${index}.enabled" 
                   ${target.enabled ? 'checked' : ''}>
            Enabled
          </label>
        </div>
      </div>
    `;
    return div;
  }

  createDnsTargetElement(target, index) {
    const div = document.createElement('div');
    div.className = 'target-config';
    div.innerHTML = `
      <div class="target-header">
        <h4>DNS Target ${index + 1}</h4>
        <button type="button" class="btn btn-danger btn-sm remove-target" data-type="dns" data-index="${index}">
          Remove
        </button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label for="dnsName${index}">Name:</label>
          <input type="text" id="dnsName${index}" class="config-input" 
                 data-field="dns_targets.${index}.name" 
                 value="${target.name}" required>
          <div class="field-error"></div>
        </div>
        <div class="form-group">
          <label for="dnsServerIp${index}">Server IP:</label>
          <input type="text" id="dnsServerIp${index}" class="config-input" 
                 data-field="dns_targets.${index}.server_ip" 
                 value="${target.server_ip}" required 
                 placeholder="DNS server IP address">
          <div class="field-error"></div>
        </div>
        <div class="form-group">
          <label for="dnsInterval${index}">Interval (seconds):</label>
          <input type="number" id="dnsInterval${index}" class="config-input" 
                 data-field="dns_targets.${index}.interval" 
                 value="${target.interval}" min="1" max="600" required>
          <div class="field-error"></div>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="dnsEnabled${index}" class="config-input" 
                   data-field="dns_targets.${index}.enabled" 
                   ${target.enabled ? 'checked' : ''}>
            Enabled
          </label>
        </div>
        <div class="form-group full-width">
          <label for="dnsTestDomains${index}">Test Domains (comma-separated):</label>
          <input type="text" id="dnsTestDomains${index}" class="config-input" 
                 data-field="dns_targets.${index}.test_domains" 
                 value="${target.test_domains.join(', ')}" required 
                 placeholder="google.com, example.com">
          <div class="field-error"></div>
        </div>
      </div>
    `;
    return div;
  }

  addPingTarget() {
    const newTarget = {
      name: 'New Ping Target',
      address: '',
      interval: 60,
      enabled: true
    };

    this.currentConfig.ping_targets.push(newTarget);
    this.renderPingTargets();
    this.showMessage('Ping target added. Remember to save your configuration.', 'success');
  }

  addDnsTarget() {
    const newTarget = {
      name: 'New DNS Target',
      server_ip: '',
      test_domains: ['google.com'],
      interval: 120,
      enabled: true
    };

    this.currentConfig.dns_targets.push(newTarget);
    this.renderDnsTargets();
    this.showMessage('DNS target added. Remember to save your configuration.', 'success');
  }

  removeTarget(button) {
    const type = button.dataset.type;
    const index = parseInt(button.dataset.index);

    if (type === 'ping') {
      this.currentConfig.ping_targets.splice(index, 1);
      this.renderPingTargets();
    } else if (type === 'dns') {
      this.currentConfig.dns_targets.splice(index, 1);
      this.renderDnsTargets();
    }

    this.showMessage('Target removed. Remember to save your configuration.', 'warning');
  }

  collectFormData() {
    const config = {
      ping_targets: [],
      dns_targets: [],
      alert_thresholds: {},
      data_retention_days: 30
    };

    // Collect ping targets
    const pingContainer = document.getElementById('pingTargetsContainer');
    const pingTargets = pingContainer.querySelectorAll('.target-config');
    
    pingTargets.forEach((targetElement, index) => {
      const name = document.getElementById(`pingName${index}`).value;
      const address = document.getElementById(`pingAddress${index}`).value;
      const interval = parseInt(document.getElementById(`pingInterval${index}`).value);
      const enabled = document.getElementById(`pingEnabled${index}`).checked;

      config.ping_targets.push({
        name: name.trim(),
        address: address.trim(),
        interval,
        enabled
      });
    });

    // Collect DNS targets
    const dnsContainer = document.getElementById('dnsTargetsContainer');
    const dnsTargets = dnsContainer.querySelectorAll('.target-config');
    
    dnsTargets.forEach((targetElement, index) => {
      const name = document.getElementById(`dnsName${index}`).value;
      const server_ip = document.getElementById(`dnsServerIp${index}`).value;
      const interval = parseInt(document.getElementById(`dnsInterval${index}`).value);
      const enabled = document.getElementById(`dnsEnabled${index}`).checked;
      const test_domains = document.getElementById(`dnsTestDomains${index}`).value
        .split(',')
        .map(domain => domain.trim())
        .filter(domain => domain.length > 0);

      config.dns_targets.push({
        name: name.trim(),
        server_ip: server_ip.trim(),
        test_domains,
        interval,
        enabled
      });
    });

    // Collect alert thresholds
    config.alert_thresholds = {
      ping_timeout_ms: parseInt(document.getElementById('pingTimeoutMs').value),
      ping_loss_percent: parseFloat(document.getElementById('pingLossPercent').value),
      dns_timeout_ms: parseInt(document.getElementById('dnsTimeoutMs').value),
      consecutive_failures: parseInt(document.getElementById('consecutiveFailures').value)
    };

    // Collect data retention
    config.data_retention_days = parseInt(document.getElementById('dataRetentionDays').value);

    return config;
  }

  async validateConfiguration() {
    const config = this.collectFormData();
    const isIngress = window.location.pathname.includes('/api/hassio_ingress/');
    
    // In ingress mode, we need to construct the full path
    let apiUrl;
    if (isIngress) {
      const pathParts = window.location.pathname.split('/');
      const ingressIndex = pathParts.indexOf('api');
      const basePath = pathParts.slice(0, ingressIndex + 3).join('/');
      apiUrl = `${basePath}/api/config/validate`;
    } else {
      apiUrl = '/api/config/validate';
    }
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const result = await response.json();
      
      if (result.success) {
        this.validationErrors = [];
        this.clearFieldErrors();
        this.showMessage('Configuration is valid!', 'success');
      } else {
        this.handleValidationErrors(result.error);
      }

    } catch (error) {
      console.error('Validation failed:', error);
      this.showMessage('Validation failed: ' + error.message, 'error');
    }
  }

  async saveConfiguration() {
    const config = this.collectFormData();
    const isIngress = window.location.pathname.includes('/api/hassio_ingress/');
    
    // In ingress mode, we need to construct the full path
    let apiUrl;
    if (isIngress) {
      const pathParts = window.location.pathname.split('/');
      const ingressIndex = pathParts.indexOf('api');
      const basePath = pathParts.slice(0, ingressIndex + 3).join('/');
      apiUrl = `${basePath}/api/config`;
    } else {
      apiUrl = '/api/config';
    }
    
    this.showLoading(true);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const result = await response.json();
      
      if (result.success) {
        this.currentConfig = result.data;
        this.validationErrors = [];
        this.clearFieldErrors();
        this.showMessage('Configuration saved successfully! Please restart the add-on for changes to take effect.', 'success');
        
        // Optionally reload the dashboard
        if (window.dashboard) {
          setTimeout(() => {
            window.dashboard.loadDashboardData();
          }, 1000);
        }
      } else {
        this.handleValidationErrors(result.error);
      }

    } catch (error) {
      console.error('Save failed:', error);
      this.showMessage('Failed to save configuration: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async resetConfiguration() {
    if (!confirm('Are you sure you want to reset the configuration to defaults? This will lose all current settings.')) {
      return;
    }

    const isIngress = window.location.pathname.includes('/api/hassio_ingress/');
    
    // In ingress mode, we need to construct the full path
    let apiUrl;
    if (isIngress) {
      const pathParts = window.location.pathname.split('/');
      const ingressIndex = pathParts.indexOf('api');
      const basePath = pathParts.slice(0, ingressIndex + 3).join('/');
      apiUrl = `${basePath}/api/config/reset`;
    } else {
      apiUrl = '/api/config/reset';
    }
    
    this.showLoading(true);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST'
      });

      const result = await response.json();
      
      if (result.success) {
        this.currentConfig = result.data;
        this.renderConfiguration();
        this.clearFieldErrors();
        this.showMessage('Configuration reset to defaults successfully!', 'success');
      } else {
        throw new Error(result.error || 'Failed to reset configuration');
      }

    } catch (error) {
      console.error('Reset failed:', error);
      this.showMessage('Failed to reset configuration: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  validateField(field) {
    const value = field.type === 'checkbox' ? field.checked : field.value;
    const fieldName = field.dataset.field;
    let isValid = true;
    let errorMessage = '';

    // Basic validation based on field type and constraints
    if (field.required && !value) {
      isValid = false;
      errorMessage = 'This field is required';
    } else if (field.type === 'number') {
      const numValue = parseFloat(value);
      const min = parseFloat(field.min);
      const max = parseFloat(field.max);
      
      if (isNaN(numValue)) {
        isValid = false;
        errorMessage = 'Must be a valid number';
      } else if (!isNaN(min) && numValue < min) {
        isValid = false;
        errorMessage = `Must be at least ${min}`;
      } else if (!isNaN(max) && numValue > max) {
        isValid = false;
        errorMessage = `Must be at most ${max}`;
      }
    } else if (fieldName && fieldName.includes('address')) {
      // Basic IP/hostname validation
      if (value && !this.isValidAddressOrHostname(value)) {
        isValid = false;
        errorMessage = 'Must be a valid IP address or hostname';
      }
    } else if (fieldName && fieldName.includes('test_domains')) {
      // Domain validation
      if (value) {
        const domains = value.split(',').map(d => d.trim());
        const invalidDomains = domains.filter(d => d && !this.isValidDomain(d));
        if (invalidDomains.length > 0) {
          isValid = false;
          errorMessage = `Invalid domains: ${invalidDomains.join(', ')}`;
        }
      }
    }

    this.setFieldError(field, isValid ? '' : errorMessage);
    return isValid;
  }

  setFieldError(field, message) {
    const errorElement = field.parentElement.querySelector('.field-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = message ? 'block' : 'none';
    }
    
    field.classList.toggle('error', !!message);
  }

  clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(element => {
      element.textContent = '';
      element.style.display = 'none';
    });
    
    document.querySelectorAll('.config-input').forEach(input => {
      input.classList.remove('error');
    });
  }

  handleValidationErrors(errorMessage) {
    this.showMessage('Configuration validation failed: ' + errorMessage, 'error');
    
    // Try to parse field-specific errors if they're in the message
    // This is a simplified approach - in a real implementation, 
    // the API would return structured error data
    console.error('Validation errors:', errorMessage);
  }

  isValidAddressOrHostname(value) {
    // Simple regex for IP addresses and hostnames
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    
    return ipRegex.test(value) || hostnameRegex.test(value);
  }

  isValidDomain(domain) {
    // Simple domain validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)+$/;
    return domainRegex.test(domain);
  }

  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      if (show) {
        overlay.classList.remove('hidden');
      } else {
        overlay.classList.add('hidden');
      }
    }
  }

  showMessage(message, type = 'info') {
    // Remove existing messages
    document.querySelectorAll('.config-message').forEach(el => el.remove());
    
    const messageElement = document.createElement('div');
    messageElement.className = `message config-message ${type}`;
    messageElement.textContent = message;
    
    const container = document.querySelector('.config-container');
    container.insertBefore(messageElement, container.firstChild);
    
    // Auto-remove success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        messageElement.remove();
      }, 5000);
    }
  }
}

// Initialize configuration manager when the config tab is shown
document.addEventListener('DOMContentLoaded', () => {
  // Wait for the main dashboard to initialize
  setTimeout(() => {
    if (document.getElementById('config-tab')) {
      window.configManager = new ConfigurationManager();
    }
  }, 100);
});