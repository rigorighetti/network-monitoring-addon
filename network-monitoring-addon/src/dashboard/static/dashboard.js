/**
 * Network Monitoring Dashboard JavaScript
 * Implements Smokeping-style visualization with interactive features
 */

class NetworkDashboard {
  constructor() {
    this.charts = new Map();
    this.websocket = null;
    this.refreshInterval = null;
    this.currentTimeRange = '24h';
    this.dataInterval = 15; // Default to 15 minutes
    this.autoRefresh = true;
    this.showMinMax = true;
    this.showPacketLoss = true;
    this.showEvents = true;
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupWebSocket();
    await this.loadDashboardData();
    this.startAutoRefresh();
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Time range selector
    document.getElementById('timeRange').addEventListener('change', (e) => {
      this.currentTimeRange = e.target.value;
      this.loadDashboardData();
    });

    // Data interval selector
    document.getElementById('dataInterval').addEventListener('change', (e) => {
      this.dataInterval = parseInt(e.target.value);
      this.loadDashboardData();
    });

    // Auto refresh toggle
    document.getElementById('autoRefresh').addEventListener('change', (e) => {
      this.autoRefresh = e.target.checked;
      if (this.autoRefresh) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });

    // Manual refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadDashboardData();
    });

    // Chart display options
    document.getElementById('showMinMax').addEventListener('change', (e) => {
      this.showMinMax = e.target.checked;
      this.updateChartOptions();
    });

    document.getElementById('showPacketLoss').addEventListener('change', (e) => {
      this.showPacketLoss = e.target.checked;
      this.updateChartOptions();
    });

    document.getElementById('showEvents').addEventListener('change', (e) => {
      this.showEvents = e.target.checked;
      this.updateChartOptions();
    });

    // DNS chart options
    document.getElementById('dnsShowMinMax').addEventListener('change', (e) => {
      this.showMinMax = e.target.checked;
      this.updateChartOptions();
    });

    document.getElementById('dnsShowEvents').addEventListener('change', (e) => {
      this.showEvents = e.target.checked;
      this.updateChartOptions();
    });

    // Modal close
    document.querySelector('.modal-close').addEventListener('click', () => {
      this.closeErrorModal();
    });

    // Close modal on backdrop click
    document.getElementById('errorModal').addEventListener('click', (e) => {
      if (e.target.id === 'errorModal') {
        this.closeErrorModal();
      }
    });
  }

  setupWebSocket() {
    // WebSockets don't work through Home Assistant ingress, skip if in ingress
    const isIngress = window.location.pathname.includes('/api/hassio_ingress/');
    if (isIngress) {
      console.log('Running in ingress mode, WebSocket disabled');
      this.updateConnectionStatus(false);
      return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    try {
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('WebSocket connected');
        this.updateConnectionStatus(true);
        
        // Subscribe to real-time updates
        this.websocket.send(JSON.stringify({
          type: 'subscribe'
        }));
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.websocket.onclose = () => {
        console.log('WebSocket disconnected');
        this.updateConnectionStatus(false);
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          this.setupWebSocket();
        }, 5000);
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateConnectionStatus(false);
      };

    } catch (error) {
      console.error('Failed to setup WebSocket:', error);
      this.updateConnectionStatus(false);
    }
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'connected':
        console.log('WebSocket connection confirmed');
        break;
        
      case 'update':
        this.handleRealtimeUpdate(data.data);
        break;
        
      case 'error':
        console.error('WebSocket error:', data.message);
        break;
        
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  handleRealtimeUpdate(updateData) {
    if (updateData.type === 'ping') {
      this.updatePingChart(updateData.target, updateData.data);
    } else if (updateData.type === 'dns') {
      this.updateDnsChart(updateData.target, updateData.data);
    } else if (updateData.type === 'system') {
      this.updateSystemStatus(updateData.data);
    }
  }

  updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    if (connected) {
      statusElement.textContent = 'Connected';
      statusElement.className = 'status-connected';
    } else {
      statusElement.textContent = 'Disconnected';
      statusElement.className = 'status-disconnected';
    }
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }

  async loadDashboardData() {
    this.showLoading(true);
    
    try {
      // Detect if we're running in ingress by checking the URL path
      const isIngress = window.location.pathname.includes('/api/hassio_ingress/');
      
      // In ingress mode, we need to construct the full path
      let apiUrl;
      if (isIngress) {
        // Extract the ingress base path and append our API endpoint
        const pathParts = window.location.pathname.split('/');
        const ingressIndex = pathParts.indexOf('api');
        const basePath = pathParts.slice(0, ingressIndex + 3).join('/'); // includes /api/hassio_ingress/{token}
        apiUrl = `${basePath}/api/dashboard`;
      } else {
        apiUrl = '/api/dashboard';
      }
      
      console.log('Loading dashboard data from:', apiUrl);
      console.log('Current path:', window.location.pathname);
      console.log('Is ingress mode:', isIngress);
      
      const response = await fetch(apiUrl);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load dashboard data');
      }

      this.updateSystemOverview(result.data.system_status);
      this.renderPingTargets(result.data.ping_targets);
      this.renderDnsTargets(result.data.dns_targets);
      
      document.getElementById('lastUpdated').textContent = 
        new Date(result.data.last_updated).toLocaleTimeString();

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      this.showError('Failed to load dashboard data: ' + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  updateSystemOverview(systemStatus) {
    document.getElementById('systemUptime').textContent = 
      this.formatUptime(systemStatus.uptime);
    document.getElementById('totalTargets').textContent = 
      systemStatus.total_targets;
    document.getElementById('healthyTargets').textContent = 
      systemStatus.healthy_targets;
    document.getElementById('failedTargets').textContent = 
      systemStatus.failed_targets;
    document.getElementById('memoryUsage').textContent = 
      `${Math.round(systemStatus.memory_usage || 0)} MB`;
  }

  renderPingTargets(targets) {
    const container = document.getElementById('pingTargets');
    container.innerHTML = '';

    targets.forEach(target => {
      const chartElement = this.createTargetChart(target, 'ping');
      container.appendChild(chartElement);
    });
  }

  renderDnsTargets(targets) {
    const container = document.getElementById('dnsTargets');
    container.innerHTML = '';

    targets.forEach(target => {
      // Create a container for all query types for this DNS server
      const serverContainer = document.createElement('div');
      serverContainer.className = 'dns-server-container';
      serverContainer.style.marginBottom = '30px';
      
      // Add server header
      const serverHeader = document.createElement('h3');
      serverHeader.textContent = `${target.name} (${target.server_ip})`;
      serverHeader.style.marginBottom = '15px';
      serverContainer.appendChild(serverHeader);
      
      // Create separate charts for each query type
      const queryTypes = [
        { type: 'A', label: 'A Records (IPv4)', primary: true },
        { type: 'AAAA', label: 'AAAA Records (IPv6)', primary: false },
        { type: 'PTR', label: 'PTR Records (Reverse DNS)', primary: false }
      ];
      
      queryTypes.forEach(({ type, label, primary }) => {
        const chartElement = this.createDnsQueryTypeChart(target, type, label, primary);
        serverContainer.appendChild(chartElement);
      });
      
      container.appendChild(serverContainer);
    });
  }

  createTargetChart(targetData, type) {
    const template = document.getElementById('chartTemplate');
    const chartElement = template.content.cloneNode(true);
    
    // Set target information
    chartElement.querySelector('.target-name').textContent = targetData.name;
    chartElement.querySelector('.target-address').textContent = 
      type === 'ping' ? targetData.address : targetData.server_ip;
    
    // Set status badge
    const statusBadge = chartElement.querySelector('.status-badge');
    statusBadge.textContent = targetData.current_status;
    statusBadge.className = `status-badge ${targetData.current_status}`;
    
    // Set metrics
    const currentValue = type === 'ping' 
      ? `${targetData.current_response_time || '--'} ms`
      : `${targetData.current_response_time || '--'} ms`;
    chartElement.querySelector('.current-value').textContent = currentValue;
    chartElement.querySelector('.uptime-value').textContent = 
      `${targetData.uptime_percentage.toFixed(1)}%`;
    
    // Create chart
    const canvas = chartElement.querySelector('.chart-canvas');
    const chartId = `${type}-${targetData.name.replace(/\s+/g, '-').toLowerCase()}`;
    canvas.id = chartId;
    
    // Add to DOM first
    const container = document.createElement('div');
    container.appendChild(chartElement);
    
    // Create Chart.js chart - fetch data with interval for both ping and DNS
    setTimeout(() => {
      if (type === 'ping') {
        this.createPingChartWithInterval(chartId, targetData);
      } else {
        this.createChart(chartId, targetData, type);
      }
    }, 0);
    
    return container.firstElementChild;
  }

  async createPingChartWithInterval(canvasId, targetData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error('Canvas not found:', canvasId);
      return;
    }

    // Fetch aggregated data with the selected interval
    const isIngress = window.location.pathname.includes('/api/hassio_ingress/');
    let apiUrl;
    if (isIngress) {
      const pathParts = window.location.pathname.split('/');
      const ingressIndex = pathParts.indexOf('api');
      const basePath = pathParts.slice(0, ingressIndex + 3).join('/');
      apiUrl = `${basePath}/api/history/aggregated/ping/${encodeURIComponent(targetData.name)}?interval=${this.dataInterval}`;
    } else {
      apiUrl = `/api/history/aggregated/ping/${encodeURIComponent(targetData.name)}?interval=${this.dataInterval}`;
    }

    try {
      const response = await fetch(apiUrl);
      const result = await response.json();
      
      if (!result.success || !result.data) {
        console.error('Failed to load ping data');
        return;
      }

      const ctx = canvas.getContext('2d');
      const chartData = this.preparePingChartData(result.data);
      
      const config = {
        type: 'line',
        data: chartData,
        options: this.getPingChartOptions()
      };

      const chart = new Chart(ctx, config);
      this.charts.set(canvasId, chart);
      
      return chart;
    } catch (error) {
      console.error('Error creating ping chart:', error);
    }
  }

  preparePingChartData(historyData) {
    const datasets = [];
    
    // Main response time line (average)
    const responseTimeData = historyData.map(point => ({
      x: new Date(point.timestamp),
      y: point.avg_response_time
    }));

    datasets.push({
      label: 'Response Time',
      data: responseTimeData,
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      fill: false,
      tension: 0.1,
      pointRadius: 1,
      pointHoverRadius: 3
    });

    // Min/Max area if enabled
    if (this.showMinMax) {
      const minData = historyData.map(point => ({
        x: new Date(point.timestamp),
        y: point.min_response_time
      }));

      const maxData = historyData.map(point => ({
        x: new Date(point.timestamp),
        y: point.max_response_time
      }));

      datasets.push({
        label: 'Min',
        data: minData,
        borderColor: 'rgba(16, 185, 129, 0.6)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: false,
        pointRadius: 0,
        borderWidth: 1
      });

      datasets.push({
        label: 'Max',
        data: maxData,
        borderColor: 'rgba(239, 68, 68, 0.6)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: '-1',
        pointRadius: 0,
        borderWidth: 1
      });
    }

    // Packet loss
    if (this.showPacketLoss) {
      const packetLossData = historyData.map(point => ({
        x: new Date(point.timestamp),
        y: ((point.total_count - point.success_count) / point.total_count) * 100 || 0
      }));

      datasets.push({
        label: 'Packet Loss',
        data: packetLossData,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: false,
        yAxisID: 'y1',
        pointRadius: 1,
        borderWidth: 2
      });
    }

    // Event highlighting
    if (this.showEvents) {
      const eventData = historyData
        .filter(point => point.success_rate < 0.5)
        .map(point => ({
          x: new Date(point.timestamp),
          y: point.avg_response_time || 0
        }));

      if (eventData.length > 0) {
        datasets.push({
          label: 'Failures',
          data: eventData,
          borderColor: '#ef4444',
          backgroundColor: '#ef4444',
          pointRadius: 4,
          pointHoverRadius: 6,
          showLine: false,
          pointStyle: 'triangle'
        });
      }
    }

    return { datasets };
  }

  getPingChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          callbacks: {
            title: (context) => {
              return new Date(context[0].parsed.x).toLocaleString();
            },
            label: (context) => {
              const value = context.parsed.y;
              if (value === null) return 'No data';
              
              if (context.datasetIndex === 0) {
                return `Response Time: ${value.toFixed(1)} ms`;
              } else if (context.datasetIndex === 1) {
                return `Min: ${value.toFixed(1)} ms`;
              } else if (context.datasetIndex === 2) {
                return `Max: ${value.toFixed(1)} ms`;
              } else if (context.dataset.label === 'Packet Loss') {
                return `Packet Loss: ${value.toFixed(1)}%`;
              }
              return `${value.toFixed(1)}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            displayFormats: {
              hour: 'HH:mm',
              day: 'MMM dd'
            }
          },
          title: {
            display: true,
            text: 'Time'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Response Time (ms)'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        y1: {
          type: 'linear',
          display: this.showPacketLoss,
          position: 'right',
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Packet Loss (%)'
          },
          grid: {
            drawOnChartArea: false
          }
        }
      },
      elements: {
        point: {
          radius: 2,
          hoverRadius: 4
        },
        line: {
          tension: 0.1
        }
      }
    };
  }

  createDnsQueryTypeChart(targetData, queryType, label, isPrimary) {
    const template = document.getElementById('chartTemplate');
    const chartElement = template.content.cloneNode(true);
    
    // Set target information with query type
    chartElement.querySelector('.target-name').textContent = label;
    chartElement.querySelector('.target-address').textContent = targetData.server_ip;
    
    // Set status badge
    const statusBadge = chartElement.querySelector('.status-badge');
    statusBadge.textContent = targetData.current_status;
    statusBadge.className = `status-badge ${targetData.current_status}`;
    
    // Set metrics
    chartElement.querySelector('.current-value').textContent = 
      `${targetData.current_response_time || '--'} ms`;
    chartElement.querySelector('.uptime-value').textContent = 
      `${targetData.uptime_percentage.toFixed(1)}%`;
    
    // Create chart
    const canvas = chartElement.querySelector('.chart-canvas');
    const chartId = `dns-${queryType}-${targetData.name.replace(/\s+/g, '-').toLowerCase()}`;
    canvas.id = chartId;
    
    // Add to DOM first
    const container = document.createElement('div');
    container.appendChild(chartElement);
    
    // Create Chart.js chart with query type
    setTimeout(() => {
      this.createDnsChartByType(chartId, targetData, queryType, isPrimary);
    }, 0);
    
    return container.firstElementChild;
  }

  createChart(canvasId, targetData, type) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error('Canvas not found:', canvasId);
      return;
    }

    const ctx = canvas.getContext('2d');
    
    // Prepare data for Smokeping-style visualization
    const chartData = this.prepareChartData(targetData.history, type);
    
    const config = {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: 'white',
            bodyColor: 'white',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            callbacks: {
              title: (context) => {
                return new Date(context[0].parsed.x).toLocaleString();
              },
              label: (context) => {
                const value = context.parsed.y;
                if (value === null) return 'No data';
                
                if (context.datasetIndex === 0) { // Response time
                  return `Response Time: ${value.toFixed(1)} ms`;
                } else if (context.datasetIndex === 1) { // Min
                  return `Min: ${value.toFixed(1)} ms`;
                } else if (context.datasetIndex === 2) { // Max
                  return `Max: ${value.toFixed(1)} ms`;
                } else if (context.datasetIndex === 3) { // Packet Loss
                  return `Packet Loss: ${value.toFixed(1)}%`;
                }
                return `${value.toFixed(1)}`;
              }
            }
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x'
            },
            zoom: {
              wheel: {
                enabled: true
              },
              pinch: {
                enabled: true
              },
              mode: 'x'
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                hour: 'HH:mm',
                day: 'MMM dd'
              }
            },
            title: {
              display: true,
              text: 'Time'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: type === 'ping' ? 'Response Time (ms)' : 'Response Time (ms)'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          y1: {
            type: 'linear',
            display: type === 'ping' && this.showPacketLoss,
            position: 'right',
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Packet Loss (%)'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        },
        elements: {
          point: {
            radius: 2,
            hoverRadius: 4
          },
          line: {
            tension: 0.1
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    this.charts.set(canvasId, chart);
    
    return chart;
  }

  prepareChartData(historyData, type) {
    const datasets = [];
    
    // Main response time line (average)
    const responseTimeData = historyData.map(point => ({
      x: new Date(point.timestamp),
      y: point.avg_value
    }));

    datasets.push({
      label: 'Response Time',
      data: responseTimeData,
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      fill: false,
      tension: 0.1,
      pointRadius: 1,
      pointHoverRadius: 3
    });

    // Min/Max area if enabled
    if (this.showMinMax) {
      const minData = historyData.map(point => ({
        x: new Date(point.timestamp),
        y: point.min_value
      }));

      const maxData = historyData.map(point => ({
        x: new Date(point.timestamp),
        y: point.max_value
      }));

      datasets.push({
        label: 'Min',
        data: minData,
        borderColor: 'rgba(16, 185, 129, 0.6)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: false,
        pointRadius: 0,
        borderWidth: 1
      });

      datasets.push({
        label: 'Max',
        data: maxData,
        borderColor: 'rgba(239, 68, 68, 0.6)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: '-1', // Fill to previous dataset (min)
        pointRadius: 0,
        borderWidth: 1
      });
    }

    // Packet loss for ping charts
    if (type === 'ping' && this.showPacketLoss) {
      const packetLossData = historyData.map(point => ({
        x: new Date(point.timestamp),
        y: point.packet_loss || 0
      }));

      datasets.push({
        label: 'Packet Loss',
        data: packetLossData,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: false,
        yAxisID: 'y1',
        pointRadius: 1,
        borderWidth: 2
      });
    }

    // Event highlighting
    if (this.showEvents) {
      const eventData = historyData
        .filter(point => !point.success)
        .map(point => ({
          x: new Date(point.timestamp),
          y: point.avg_value || 0
        }));

      if (eventData.length > 0) {
        datasets.push({
          label: 'Failures',
          data: eventData,
          borderColor: '#ef4444',
          backgroundColor: '#ef4444',
          pointRadius: 4,
          pointHoverRadius: 6,
          showLine: false,
          pointStyle: 'triangle'
        });
      }
    }

    return { datasets };
  }

  async createDnsChartByType(canvasId, targetData, queryType, isPrimary) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error('Canvas not found:', canvasId);
      return;
    }

    // Fetch data for this specific query type with the selected interval
    const isIngress = window.location.pathname.includes('/api/hassio_ingress/');
    let apiUrl;
    if (isIngress) {
      const pathParts = window.location.pathname.split('/');
      const ingressIndex = pathParts.indexOf('api');
      const basePath = pathParts.slice(0, ingressIndex + 3).join('/');
      apiUrl = `${basePath}/api/history/aggregated/dns/${encodeURIComponent(targetData.name)}/${queryType}?interval=${this.dataInterval}`;
    } else {
      apiUrl = `/api/history/aggregated/dns/${encodeURIComponent(targetData.name)}/${queryType}?interval=${this.dataInterval}`;
    }

    try {
      const response = await fetch(apiUrl);
      const result = await response.json();
      
      if (!result.success || !result.data) {
        console.error('Failed to load DNS data for', queryType);
        return;
      }

      const ctx = canvas.getContext('2d');
      const chartData = this.prepareDnsChartDataByType(result.data, queryType, isPrimary);
      
      const config = {
        type: 'line',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index'
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 15
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: 'white',
              bodyColor: 'white',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              callbacks: {
                title: (context) => {
                  return new Date(context[0].parsed.x).toLocaleString();
                },
                label: (context) => {
                  const value = context.parsed.y;
                  if (value === null) return 'No data';
                  return `${context.dataset.label}: ${value.toFixed(1)} ms`;
                }
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                displayFormats: {
                  hour: 'HH:mm',
                  day: 'MMM dd'
                }
              },
              title: {
                display: true,
                text: 'Time'
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Response Time (ms)'
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            }
          },
          elements: {
            point: {
              radius: isPrimary ? 2 : 1,
              hoverRadius: isPrimary ? 4 : 3
            },
            line: {
              tension: 0.1
            }
          }
        }
      };

      const chart = new Chart(ctx, config);
      this.charts.set(canvasId, chart);
      
      return chart;
    } catch (error) {
      console.error('Error creating DNS chart for', queryType, error);
    }
  }

  prepareDnsChartDataByType(historyData, queryType, isPrimary) {
    const datasets = [];
    
    // Main response time line (average)
    const responseTimeData = historyData.map(point => ({
      x: new Date(point.timestamp),
      y: point.avg_response_time
    }));

    datasets.push({
      label: 'Avg Response Time',
      data: responseTimeData,
      borderColor: queryType === 'A' ? '#2563eb' : queryType === 'AAAA' ? '#7c3aed' : '#f59e0b',
      backgroundColor: queryType === 'A' ? 'rgba(37, 99, 235, 0.1)' : queryType === 'AAAA' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(245, 158, 11, 0.1)',
      fill: false,
      tension: 0.1,
      pointRadius: 1,
      pointHoverRadius: 3
    });

    // For A records (primary), show min/max band
    if (isPrimary && this.showMinMax) {
      const minData = historyData.map(point => ({
        x: new Date(point.timestamp),
        y: point.min_response_time
      }));

      const maxData = historyData.map(point => ({
        x: new Date(point.timestamp),
        y: point.max_response_time
      }));

      datasets.push({
        label: 'Min',
        data: minData,
        borderColor: 'rgba(16, 185, 129, 0.6)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: false,
        pointRadius: 0,
        borderWidth: 1
      });

      datasets.push({
        label: 'Max',
        data: maxData,
        borderColor: 'rgba(239, 68, 68, 0.6)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: '-1', // Fill to previous dataset (min)
        pointRadius: 0,
        borderWidth: 1
      });
    }

    // Event highlighting for failures
    if (this.showEvents) {
      const eventData = historyData
        .filter(point => point.success_rate < 0.5)
        .map(point => ({
          x: new Date(point.timestamp),
          y: point.avg_response_time || 0
        }));

      if (eventData.length > 0) {
        datasets.push({
          label: 'Failures',
          data: eventData,
          borderColor: '#ef4444',
          backgroundColor: '#ef4444',
          pointRadius: 4,
          pointHoverRadius: 6,
          showLine: false,
          pointStyle: 'triangle'
        });
      }
    }

    return { datasets };
  }

  updateChartOptions() {
    // Simply reload the dashboard data with current settings
    // This will recreate all charts with the new options
    this.loadDashboardData();
  }

  updatePingChart(targetName, data) {
    const chartId = `ping-${targetName.replace(/\s+/g, '-').toLowerCase()}`;
    const chart = this.charts.get(chartId);
    
    if (chart && data.latest_result) {
      // Add new data point
      const newPoint = {
        x: new Date(data.latest_result.timestamp),
        y: data.latest_result.response_time_ms
      };
      
      chart.data.datasets[0].data.push(newPoint);
      
      // Keep only last 100 points for performance
      if (chart.data.datasets[0].data.length > 100) {
        chart.data.datasets[0].data.shift();
      }
      
      chart.update('none'); // No animation for real-time updates
    }
  }

  updateDnsChart(targetName, data) {
    const chartId = `dns-${targetName.replace(/\s+/g, '-').toLowerCase()}`;
    const chart = this.charts.get(chartId);
    
    if (chart && data.latest_result) {
      // Add new data point
      const newPoint = {
        x: new Date(data.latest_result.timestamp),
        y: data.latest_result.response_time_ms
      };
      
      chart.data.datasets[0].data.push(newPoint);
      
      // Keep only last 100 points for performance
      if (chart.data.datasets[0].data.length > 100) {
        chart.data.datasets[0].data.shift();
      }
      
      chart.update('none'); // No animation for real-time updates
    }
  }

  updateSystemStatus(data) {
    if (data.stats) {
      // Update system statistics if provided
      console.log('System stats updated:', data.stats);
    }
  }

  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    if (this.autoRefresh) {
      this.refreshInterval = setInterval(() => {
        this.loadDashboardData();
      }, 30000); // Refresh every 30 seconds
    }
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorModal').classList.add('show');
  }

  closeErrorModal() {
    document.getElementById('errorModal').classList.remove('show');
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  destroy() {
    // Clean up charts
    this.charts.forEach(chart => {
      chart.destroy();
    });
    this.charts.clear();
    
    // Close WebSocket
    if (this.websocket) {
      this.websocket.close();
    }
    
    // Clear intervals
    this.stopAutoRefresh();
  }
}

// Global functions for modal handling
function closeErrorModal() {
  if (window.dashboard) {
    window.dashboard.closeErrorModal();
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new NetworkDashboard();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (window.dashboard) {
    window.dashboard.destroy();
  }
});