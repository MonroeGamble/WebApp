// ============================================================================
// INTERACTIVE STOCK CHART WIDGET
// Using Yahoo Finance API with Adjusted Close Prices
// ============================================================================

// Configuration
const MAX_TICKERS = 10;
const DEFAULT_TICKERS = ['^GSPC', 'MCD', 'YUM', 'QSR', 'WEN', 'DPZ', 'MAR', 'HLT', 'PLNT', 'DNUT'];
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
  ''
];

// State Management
let chartInstance = null;
let currentRange = 'ytd';
let activeTickers = new Map(); // ticker -> {color, width, data}
let showLegend = true;
let showYearMarkers = true; // Toggle for year-end markers
let currentModal = null;

// Color Palette for auto-assignment (^GSPC gets black, others get colors)
const COLOR_PALETTE = [
  '#667eea', '#764ba2', '#f093fb', '#4facfe',
  '#43e97b', '#fa709a', '#fee140', '#30cfd0',
  '#a8edea', '#fed6e3'
];

// ============================================================================
// YAHOO FINANCE API - CHART DATA WITH ADJUSTED CLOSE
// ============================================================================

/**
 * Fetch current quote data for table display
 */
async function fetchQuoteData(ticker) {
  const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`;

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxy = CORS_PROXIES[i];
    const url = proxy ? proxy + encodeURIComponent(yahooUrl) : yahooUrl;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.quoteResponse || !data.quoteResponse.result || data.quoteResponse.result.length === 0) {
        throw new Error('Invalid response structure');
      }

      const quote = data.quoteResponse.result[0];

      return {
        symbol: quote.symbol,
        price: quote.regularMarketPrice || 0,
        change: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume || 0,
        marketCap: quote.marketCap || 0,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0
      };

    } catch (error) {
      console.error(`Proxy ${i + 1} failed for quote ${ticker}:`, error.message);

      if (i < CORS_PROXIES.length - 1) {
        continue;
      }

      throw new Error(`Failed to fetch quote for ${ticker}`);
    }
  }
}

// ============================================================================
// YAHOO FINANCE API - CHART DATA WITH ADJUSTED CLOSE
// ============================================================================

/**
 * Fetch historical chart data with adjusted close prices
 */
async function fetchChartData(ticker, range) {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d`;

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxy = CORS_PROXIES[i];
    const url = proxy ? proxy + encodeURIComponent(yahooUrl) : yahooUrl;

    try {
      console.log(`Fetching ${ticker} via proxy ${i + 1}...`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error('Invalid response structure');
      }

      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const indicators = result.indicators;

      // Get adjusted close prices (CRITICAL for accurate analysis)
      let prices;
      if (indicators.adjclose && indicators.adjclose[0]) {
        prices = indicators.adjclose[0].adjclose;
        console.log(`✓ Using adjusted close for ${ticker}`);
      } else {
        // Fallback to regular close if adjusted not available
        prices = indicators.quote[0].close;
        console.warn(`⚠ Using regular close for ${ticker} (adjusted not available)`);
      }

      // Filter out null values
      const chartData = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (prices[i] !== null && prices[i] !== undefined) {
          chartData.push({
            x: new Date(timestamps[i] * 1000),
            y: prices[i]
          });
        }
      }

      console.log(`✓ Fetched ${chartData.length} data points for ${ticker}`);

      return {
        symbol: ticker,
        data: chartData,
        meta: result.meta
      };

    } catch (error) {
      console.error(`Proxy ${i + 1} failed for ${ticker}:`, error.message);

      if (i < CORS_PROXIES.length - 1) {
        console.log('Trying next proxy...');
        continue;
      }

      throw new Error(`Failed to fetch data for ${ticker}: ${error.message}`);
    }
  }
}

// ============================================================================
// TICKER MANAGEMENT
// ============================================================================

/**
 * Add ticker to chart
 */
async function addTicker(ticker) {
  ticker = ticker.toUpperCase().trim();

  // Validation
  if (!ticker) {
    showError('Please enter a ticker symbol');
    return;
  }

  if (ticker.length > 10) {
    showError('Ticker symbol too long');
    return;
  }

  if (activeTickers.has(ticker)) {
    showError(`${ticker} is already on the chart`);
    return;
  }

  if (activeTickers.size >= MAX_TICKERS) {
    showError(`Maximum ${MAX_TICKERS} tickers allowed`);
    return;
  }

  // Show loading
  showLoading();
  clearError();

  try {
    // Fetch data
    const chartData = await fetchChartData(ticker, currentRange);

    // Special handling for ^GSPC (S&P 500) - thick black line as baseline
    let color, width;
    if (ticker === '^GSPC') {
      color = '#000000'; // Black
      width = 3; // Thicker line
    } else {
      // Auto-assign color from palette
      const colorIndex = activeTickers.size % COLOR_PALETTE.length;
      color = COLOR_PALETTE[colorIndex];
      width = 2;
    }

    // Store ticker data
    activeTickers.set(ticker, {
      color: color,
      width: width,
      data: chartData
    });

    // Update UI
    renderTickerChip(ticker);
    updateChart();
    updateTable(); // Update table with new ticker
    clearInput();

    console.log(`✓ Added ${ticker} to chart`);

  } catch (error) {
    showError(error.message);
    console.error('Error adding ticker:', error);
  } finally {
    hideLoading();
  }
}

/**
 * Remove ticker from chart
 */
function removeTicker(ticker) {
  if (activeTickers.has(ticker)) {
    activeTickers.delete(ticker);
    updateChart();
    renderAllTickerChips();
    updateTable(); // Update table after removing ticker
    console.log(`✓ Removed ${ticker} from chart`);
  }
}

/**
 * Open settings modal for ticker
 */
function openTickerSettings(ticker) {
  const tickerData = activeTickers.get(ticker);
  if (!tickerData) return;

  currentModal = ticker;

  // Set current values
  document.getElementById('modal-title').textContent = `${ticker} Settings`;
  document.getElementById('line-color').value = tickerData.color;
  document.getElementById('line-width').value = tickerData.width;
  document.getElementById('line-width-value').textContent = `${tickerData.width}px`;

  // Show modal
  document.getElementById('settings-modal').classList.add('active');
}

/**
 * Save ticker settings
 */
function saveTickerSettings() {
  if (!currentModal) return;

  const ticker = currentModal;
  const tickerData = activeTickers.get(ticker);
  if (!tickerData) return;

  // Update settings
  tickerData.color = document.getElementById('line-color').value;
  tickerData.width = parseInt(document.getElementById('line-width').value);

  // Close modal and update chart
  closeModal();
  updateChart();

  console.log(`✓ Updated settings for ${ticker}`);
}

// ============================================================================
// CHART RENDERING
// ============================================================================

/**
 * Create or update the chart
 */
function updateChart() {
  const canvas = document.getElementById('stock-chart');
  const ctx = canvas.getContext('2d');

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy();
  }

  // Prepare datasets
  const datasets = [];
  activeTickers.forEach((tickerData, ticker) => {
    datasets.push({
      label: ticker,
      data: tickerData.data.data,
      borderColor: tickerData.color,
      backgroundColor: tickerData.color + '20',
      borderWidth: tickerData.width,
      fill: false,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: tickerData.color,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2
    });
  });

  // Create chart
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: showLegend,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20,
            font: {
              size: 16,
              weight: '600'
            },
            boxWidth: 15,
            boxHeight: 15
          }
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#667eea',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            title: function(context) {
              if (context[0] && context[0].parsed) {
                const date = new Date(context[0].parsed.x);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
              }
              return '';
            },
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              return `${label}: $${value.toFixed(2)}`;
            }
          }
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            modifierKey: 'shift'
          },
          zoom: {
            wheel: {
              enabled: true,
              speed: 0.1
            },
            pinch: {
              enabled: true
            },
            mode: 'x'
          },
          limits: {
            x: { min: 'original', max: 'original' }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: getTimeUnit(currentRange),
            displayFormats: {
              day: 'MMM d',
              week: 'MMM d',
              month: 'MMM yyyy',
              quarter: 'MMM yyyy',
              year: 'yyyy'
            }
          },
          grid: {
            display: showYearMarkers,
            color: function(context) {
              // Show year-end markers as dashed vertical lines
              if (!showYearMarkers) return 'transparent';

              const date = new Date(context.tick.value);
              const month = date.getMonth();
              const day = date.getDate();

              // Check if it's near year-end (December 31st)
              if (month === 11 && day >= 28) {
                return 'rgba(150, 150, 150, 0.3)';
              }
              return 'transparent';
            },
            borderDash: [5, 5],
            lineWidth: 1
          },
          ticks: {
            maxRotation: 0,
            autoSkipPadding: 20,
            font: {
              size: 14,
              weight: '500'
            }
          }
        },
        y: {
          position: 'right',
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: {
              size: 14,
              weight: '500'
            },
            callback: function(value) {
              return '$' + value.toFixed(2);
            }
          }
        }
      }
    }
  });
}

/**
 * Get appropriate time unit for range
 */
function getTimeUnit(range) {
  switch(range) {
    case '1d': return 'hour';
    case '5d': return 'day';
    case '1mo': return 'day';
    case '3mo': return 'week';
    case '6mo': return 'week';
    case 'ytd': return 'week';
    case '1y': return 'month';
    case '2y': return 'month';
    case '5y': return 'month';
    case '10y': return 'year';
    case 'max': return 'year';
    default: return 'day';
  }
}

// ============================================================================
// TIME RANGE MANAGEMENT
// ============================================================================

/**
 * Change time range and reload all ticker data
 */
async function changeTimeRange(range) {
  currentRange = range;

  // Update button states
  document.querySelectorAll('.btn-range').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-range="${range}"]`).classList.add('active');

  // Reload all tickers with new range
  if (activeTickers.size > 0) {
    showLoading();
    clearError();

    try {
      const tickers = Array.from(activeTickers.keys());

      for (const ticker of tickers) {
        const tickerData = activeTickers.get(ticker);
        const newData = await fetchChartData(ticker, range);
        tickerData.data = newData;
        activeTickers.set(ticker, tickerData);
      }

      updateChart();
      console.log(`✓ Loaded ${range} data for all tickers`);

    } catch (error) {
      showError(`Failed to load ${range} data: ${error.message}`);
      console.error('Error changing time range:', error);
    } finally {
      hideLoading();
    }
  }
}

// ============================================================================
// UI MANAGEMENT
// ============================================================================

/**
 * Render ticker chip
 */
function renderTickerChip(ticker) {
  const container = document.getElementById('ticker-list');
  const tickerData = activeTickers.get(ticker);

  const chip = document.createElement('div');
  chip.className = 'ticker-chip';
  chip.style.borderColor = tickerData.color;

  chip.innerHTML = `
    <span class="ticker-name">${ticker}</span>
    <button class="ticker-settings" data-ticker="${ticker}">⚙️</button>
    <button class="ticker-remove" data-ticker="${ticker}">×</button>
  `;

  container.appendChild(chip);
}

/**
 * Render all ticker chips
 */
function renderAllTickerChips() {
  const container = document.getElementById('ticker-list');
  container.innerHTML = '';
  activeTickers.forEach((_, ticker) => renderTickerChip(ticker));
}

/**
 * Show loading indicator
 */
function showLoading() {
  document.getElementById('loading').classList.add('active');
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  document.getElementById('loading').classList.remove('active');
}

/**
 * Show error message
 */
function showError(message) {
  const errorEl = document.getElementById('ticker-error');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

/**
 * Clear error message
 */
function clearError() {
  const errorEl = document.getElementById('ticker-error');
  errorEl.textContent = '';
  errorEl.style.display = 'none';
}

/**
 * Clear input field
 */
function clearInput() {
  document.getElementById('ticker-input').value = '';
}

/**
 * Close modal
 */
function closeModal() {
  document.getElementById('settings-modal').classList.remove('active');
  currentModal = null;
}

/**
 * Update stock data table
 */
async function updateTable() {
  const tableBody = document.getElementById('table-body');

  if (activeTickers.size === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 20px; color: #999;">
          Add tickers to see data in the table
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Loading...</td></tr>';

  const rows = [];

  for (const ticker of activeTickers.keys()) {
    try {
      const quote = await fetchQuoteData(ticker);

      const changeClass = quote.change > 0 ? 'positive-change' : (quote.change < 0 ? 'negative-change' : '');
      const changeSign = quote.change > 0 ? '+' : '';

      rows.push(`
        <tr>
          <td>${quote.symbol}</td>
          <td>$${quote.price.toFixed(2)}</td>
          <td class="${changeClass}">${changeSign}${quote.change.toFixed(2)}%</td>
          <td>${formatNumber(quote.volume)}</td>
          <td>${formatMarketCap(quote.marketCap)}</td>
          <td>$${quote.fiftyTwoWeekHigh.toFixed(2)}</td>
          <td>$${quote.fiftyTwoWeekLow.toFixed(2)}</td>
        </tr>
      `);
    } catch (error) {
      console.error(`Failed to fetch quote for ${ticker}:`, error);
      rows.push(`
        <tr>
          <td>${ticker}</td>
          <td colspan="6" style="color: #fa709a;">Error loading data</td>
        </tr>
      `);
    }
  }

  tableBody.innerHTML = rows.join('');
}

/**
 * Format large numbers (volume)
 */
function formatNumber(num) {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(2) + 'B';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toString();
}

/**
 * Format market cap
 */
function formatMarketCap(num) {
  if (num === 0) return 'N/A';
  if (num >= 1000000000000) {
    return '$' + (num / 1000000000000).toFixed(2) + 'T';
  } else if (num >= 1000000000) {
    return '$' + (num / 1000000000).toFixed(2) + 'B';
  } else if (num >= 1000000) {
    return '$' + (num / 1000000).toFixed(2) + 'M';
  }
  return '$' + num.toString();
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Initialize event listeners
 */
function initEventListeners() {
  // Add ticker button
  document.getElementById('add-ticker-btn').addEventListener('click', () => {
    const input = document.getElementById('ticker-input');
    addTicker(input.value);
  });

  // Add ticker on Enter key
  document.getElementById('ticker-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTicker(e.target.value);
    }
  });

  // Ticker chip actions (event delegation)
  document.getElementById('ticker-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('ticker-remove')) {
      removeTicker(e.target.dataset.ticker);
    } else if (e.target.classList.contains('ticker-settings')) {
      openTickerSettings(e.target.dataset.ticker);
    }
  });

  // Time range buttons
  document.querySelectorAll('.btn-range').forEach(btn => {
    btn.addEventListener('click', () => {
      changeTimeRange(btn.dataset.range);
    });
  });

  // Chart controls
  document.getElementById('reset-zoom-btn').addEventListener('click', () => {
    if (chartInstance) {
      chartInstance.resetZoom();
    }
  });

  document.getElementById('toggle-legend-btn').addEventListener('click', () => {
    showLegend = !showLegend;
    if (chartInstance) {
      chartInstance.options.plugins.legend.display = showLegend;
      chartInstance.update();
    }
  });

  document.getElementById('toggle-year-markers-btn').addEventListener('click', () => {
    showYearMarkers = !showYearMarkers;
    updateChart(); // Need to recreate chart to update grid display
  });

  document.getElementById('refresh-btn').addEventListener('click', () => {
    changeTimeRange(currentRange);
  });

  // Modal controls
  document.querySelector('.modal-close').addEventListener('click', closeModal);
  document.querySelector('.modal-cancel').addEventListener('click', closeModal);
  document.querySelector('.modal-save').addEventListener('click', saveTickerSettings);

  // Line width slider update
  document.getElementById('line-width').addEventListener('input', (e) => {
    document.getElementById('line-width-value').textContent = `${e.target.value}px`;
  });

  // Close modal on outside click
  document.getElementById('settings-modal').addEventListener('click', (e) => {
    if (e.target.id === 'settings-modal') {
      closeModal();
    }
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the application
 */
async function init() {
  console.log('Initializing FranchiseIQ Interactive Stock Chart...');

  // Setup event listeners
  initEventListeners();

  // Load default tickers
  showLoading();

  for (const ticker of DEFAULT_TICKERS) {
    try {
      await addTicker(ticker);
    } catch (error) {
      console.error(`Failed to load default ticker ${ticker}:`, error);
    }
  }

  hideLoading();

  console.log('✓ Chart initialized');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
