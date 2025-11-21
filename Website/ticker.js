// ============================================================================
// STOCK TICKER CONFIGURATION
// Version: 1.1 - CORS Proxy Enabled
// ============================================================================
// Modify this array to add or remove ticker symbols
const TICKER_SYMBOLS = [
  "^GSPC", "^IXIC", "^DJI", // Market Indices
  "MCD", "YUM", "QSR", "WEN", "DPZ", "JACK", "WING", "SHAK", "CAVA",
  "DENN", "DIN", "DNUT", "NATH", "RRGB",
  "DRVN", "HRB", "CAR", "UHAL",
  "PLNT", "BFT",
  "MAR", "HLT", "H", "CHH", "WH", "VAC", "TNL", "CWH",
  "GNC", "RENT",
  "SERV", "ROL",
  "ADUS",
  "LOPE",
  "PLAY", "ARCO",
  "TAST"
];

// Refresh interval in milliseconds (15 minutes = 900 seconds)
const REFRESH_INTERVAL = 900000; // 15 minutes

// Cache for last known prices (for offline fallback)
let lastKnownData = {};
let lastMarketData = {}; // Store last market close data for after-hours

// ============================================================================
// YAHOO FINANCE API INTEGRATION
// ============================================================================

/**
 * Fetch live stock quotes from Yahoo Finance API
 * @returns {Promise<Object>} Stock data keyed by symbol
 */
async function fetchStockData() {
  const symbolsParam = TICKER_SYMBOLS.join(',');
  const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolsParam}`;

  // Try multiple CORS proxies for reliability
  const corsProxies = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    ''  // Try direct as last resort
  ];

  for (let i = 0; i < corsProxies.length; i++) {
    const proxy = corsProxies[i];
    const url = proxy ? proxy + encodeURIComponent(yahooUrl) : yahooUrl;

    try {
      console.log(`Attempt ${i + 1}: Fetching stock data using ${proxy ? 'proxy' : 'direct'}...`);
      console.log(`URL: ${url.substring(0, 100)}...`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log(`Response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();
      console.log('Received data:', data);

      // Check if we got valid data
      if (!data.quoteResponse || !data.quoteResponse.result) {
        throw new Error('Invalid API response structure');
      }

      const quotes = data.quoteResponse.result;
      console.log(`Found ${quotes.length} quotes`);

      const stockData = {};

      quotes.forEach(quote => {
        const symbol = quote.symbol;

        // Use appropriate price based on market status
        const etTime = getEasternTime();
        const marketOpen = isMarketOpen(etTime);

        let price, change;

        if (marketOpen) {
          // During market hours: use regular market price
          price = quote.regularMarketPrice;
          change = quote.regularMarketChangePercent;
        } else {
          // After hours: use previous close (adjusted close if available)
          price = quote.regularMarketPreviousClose || quote.regularMarketPrice;
          change = quote.regularMarketChangePercent;
        }

        stockData[symbol] = {
          symbol: symbol,
          price: price !== undefined && price !== null ? price.toFixed(2) : 'N/A',
          changePercent: change !== undefined && change !== null ? change.toFixed(2) : '–',
          isPositive: change > 0,
          isNegative: change < 0,
          afterHours: !marketOpen
        };
      });

      // Update cache with successful data
      lastKnownData = stockData;

      // Store as last market data if we have valid data
      if (!isMarketOpen(getEasternTime())) {
        lastMarketData = stockData;
      }

      console.log(`✓ Successfully fetched data for ${Object.keys(stockData).length} stocks`);
      return stockData;

    } catch (error) {
      console.error(`Proxy ${i + 1} failed:`, error.message);

      // If this isn't the last proxy, continue to next one
      if (i < corsProxies.length - 1) {
        console.log('Trying next proxy...');
        continue;
      }

      // All proxies failed
      console.error('All fetch attempts failed');

      // Return cached data if available
      if (Object.keys(lastKnownData).length > 0) {
        console.info('Using cached stock data');
        return lastKnownData;
      }

      // Return fallback data with N/A values
      console.warn('No cached data available, using fallback');
      return getFallbackData();
    }
  }

  // This shouldn't be reached, but just in case
  return getFallbackData();
}

/**
 * Generate fallback data when API is unavailable
 * @returns {Object} Fallback stock data
 */
function getFallbackData() {
  const fallbackData = {};

  TICKER_SYMBOLS.forEach(symbol => {
    fallbackData[symbol] = {
      symbol: symbol,
      price: 'N/A',
      changePercent: '–',
      isPositive: false,
      isNegative: false
    };
  });

  return fallbackData;
}

// ============================================================================
// DOM MANIPULATION
// ============================================================================

/**
 * Create a ticker item DOM element
 * @param {Object} stockInfo - Stock information object
 * @returns {HTMLElement} Ticker item element
 */
function createTickerItem(stockInfo) {
  const item = document.createElement('div');
  item.className = 'ticker-item';

  const symbol = document.createElement('span');
  symbol.className = 'ticker-symbol';
  symbol.textContent = stockInfo.symbol;

  const price = document.createElement('span');
  price.className = 'ticker-price';
  price.textContent = stockInfo.price;

  const change = document.createElement('span');
  change.className = 'ticker-change';

  if (stockInfo.isPositive) {
    change.classList.add('positive');
    change.textContent = `+${stockInfo.changePercent}%`;
  } else if (stockInfo.isNegative) {
    change.classList.add('negative');
    change.textContent = `${stockInfo.changePercent}%`;
  } else {
    change.classList.add('neutral');
    change.textContent = stockInfo.changePercent === '–' ? '–' : `${stockInfo.changePercent}%`;
  }

  item.appendChild(symbol);
  item.appendChild(price);
  item.appendChild(change);

  return item;
}

/**
 * Render all ticker items to the DOM
 * @param {Object} stockData - Stock data keyed by symbol
 */
function renderTicker(stockData) {
  const tickerContent = document.getElementById('ticker-content');

  // Clear existing content
  tickerContent.innerHTML = '';

  // Create ticker items for each symbol
  TICKER_SYMBOLS.forEach(symbol => {
    const stockInfo = stockData[symbol];
    if (stockInfo) {
      const item = createTickerItem(stockInfo);
      tickerContent.appendChild(item);
    }
  });

  // Duplicate items for seamless scrolling
  TICKER_SYMBOLS.forEach(symbol => {
    const stockInfo = stockData[symbol];
    if (stockInfo) {
      const item = createTickerItem(stockInfo);
      tickerContent.appendChild(item);
    }
  });
}

/**
 * Update the ticker with fresh data
 */
async function updateTicker() {
  const etTime = getEasternTime();
  const marketOpen = isMarketOpen(etTime);

  if (marketOpen) {
    // Market is open: fetch fresh data
    const stockData = await fetchStockData();
    renderTicker(stockData);
    resetCountdown(); // Reset countdown after refresh
  } else {
    // Market is closed: use last known data or fetch once for previous close
    if (Object.keys(lastMarketData).length === 0) {
      // Fetch once to get previous close data
      const stockData = await fetchStockData();
      lastMarketData = stockData;
      renderTicker(stockData);
    } else {
      // Use cached after-hours data
      renderTicker(lastMarketData);
    }
  }
}

// ============================================================================
// CLOCK AND STATUS MANAGEMENT
// ============================================================================

// Countdown tracking
let countdownSeconds = 900; // 15 minutes
let countdownInterval = null;

/**
 * Get current Eastern Time
 * @returns {Date} Current time in ET
 */
function getEasternTime() {
  const now = new Date();
  // Convert to Eastern Time (handles EST/EDT automatically)
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/**
 * Format time as 12-hour clock with AM/PM
 * @param {Date} date - Date object
 * @returns {string} Formatted time string
 */
function formatTime(date) {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12

  return `${hours}:${minutes}:${seconds} ${ampm}`;
}

/**
 * Check if US stock market is open
 * @param {Date} etTime - Current Eastern Time
 * @returns {boolean} True if market is open
 */
function isMarketOpen(etTime) {
  const day = etTime.getDay(); // 0 = Sunday, 6 = Saturday

  // Market closed on weekends
  if (day === 0 || day === 6) {
    return false;
  }

  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Market hours: 9:30 AM to 4:00 PM ET
  const marketOpen = 9 * 60 + 30;  // 9:30 AM
  const marketClose = 16 * 60;      // 4:00 PM

  return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
}

/**
 * Update clock display
 */
function updateClock() {
  const etTime = getEasternTime();
  const clockElement = document.getElementById('clock');
  const indicatorElement = document.getElementById('market-indicator');
  const labelElement = document.getElementById('market-label');

  if (clockElement) {
    clockElement.textContent = formatTime(etTime);
  }

  // Update market status
  const marketOpen = isMarketOpen(etTime);

  if (indicatorElement && labelElement) {
    if (marketOpen) {
      indicatorElement.className = 'open';
      labelElement.textContent = 'Market Open';
    } else {
      indicatorElement.className = 'closed';
      labelElement.textContent = 'Market Closed';
    }
  }
}

/**
 * Update countdown timer
 */
function updateCountdown() {
  const countdownElement = document.getElementById('countdown');

  if (countdownElement) {
    const minutes = Math.floor(countdownSeconds / 60);
    const seconds = countdownSeconds % 60;
    countdownElement.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  // Only decrement if market is open
  const etTime = getEasternTime();
  if (isMarketOpen(etTime)) {
    countdownSeconds--;

    // When countdown reaches 0, it will be reset by the refresh
    if (countdownSeconds < 0) {
      countdownSeconds = 0;
    }
  }
}

/**
 * Reset countdown to 15 minutes
 */
function resetCountdown() {
  countdownSeconds = 900; // 15 minutes
  const countdownElement = document.getElementById('countdown');
  if (countdownElement) {
    countdownElement.textContent = '15:00';
  }
}

/**
 * Start all timers (clock and countdown)
 */
function startTimers() {
  // Update clock immediately
  updateClock();

  // Update clock every second
  setInterval(updateClock, 1000);

  // Start countdown immediately
  updateCountdown();

  // Update countdown every second
  setInterval(updateCountdown, 1000);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the ticker widget
 */
function init() {
  // Start clock and countdown timers
  startTimers();

  // Initial load
  updateTicker();

  // Auto-refresh every 60 seconds (synced with countdown)
  setInterval(updateTicker, REFRESH_INTERVAL);
}

// Start the ticker when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
