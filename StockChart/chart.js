// Global state
let chartInstance = null;
let tickers = [];
let currentRange = '1y';
let showLegend = true;
let showGrid = true;

const MAX_TICKERS = 10;
const DEFAULT_COLORS = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    initializeChart();
    showEmptyState();
}

function setupEventListeners() {
    // Add ticker
    document.getElementById('addTickerBtn').addEventListener('click', addTicker);
    document.getElementById('tickerInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTicker();
    });

    // Time range buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRange = btn.dataset.range;
            refreshChart();
        });
    });

    // Chart controls
    document.getElementById('resetZoomBtn').addEventListener('click', resetZoom);
    document.getElementById('toggleLegendBtn').addEventListener('click', toggleLegend);
    document.getElementById('showGridLines').addEventListener('change', toggleGridLines);

    // Help modal
    document.getElementById('helpBtn').addEventListener('click', () => {
        document.getElementById('helpModal').style.display = 'block';
    });
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('helpModal').style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('helpModal');
        if (e.target === modal) modal.style.display = 'none';
    });
}

function initializeChart() {
    const ctx = document.getElementById('stockChart').getContext('2d');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += '$' + context.parsed.y.toFixed(2);
                            }
                            return label;
                        },
                        afterLabel: function(context) {
                            const dataset = context.dataset;
                            if (dataset.rawData && dataset.rawData[context.dataIndex]) {
                                const point = dataset.rawData[context.dataIndex];
                                return [
                                    `Open: $${point.open?.toFixed(2) || 'N/A'}`,
                                    `High: $${point.high?.toFixed(2) || 'N/A'}`,
                                    `Low: $${point.low?.toFixed(2) || 'N/A'}`,
                                    `Volume: ${formatVolume(point.volume)}`
                                ];
                            }
                            return '';
                        }
                    }
                },
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                    },
                    limits: {
                        x: {min: 'original', max: 'original'},
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'MMM d',
                            week: 'MMM d',
                            month: 'MMM yyyy',
                            year: 'yyyy'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        font: {
                            size: 14,
                            weight: '600'
                        }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Price (USD)',
                        font: {
                            size: 14,
                            weight: '600'
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

async function addTicker() {
    const input = document.getElementById('tickerInput');
    const ticker = input.value.trim().toUpperCase();

    if (!ticker) {
        showError('Please enter a ticker symbol');
        return;
    }

    if (tickers.length >= MAX_TICKERS) {
        showError(`Maximum ${MAX_TICKERS} tickers allowed`);
        return;
    }

    if (tickers.find(t => t.symbol === ticker)) {
        showError(`${ticker} is already added`);
        return;
    }

    // Show loading
    showLoading(true);

    try {
        // Fetch data to validate ticker
        const data = await fetchAdjustedPrices(ticker, currentRange);

        if (!data || data.length === 0) {
            throw new Error('No data available');
        }

        // Add ticker to list
        const tickerObj = {
            symbol: ticker,
            color: DEFAULT_COLORS[tickers.length % DEFAULT_COLORS.length],
            lineWidth: 2,
            data: data
        };

        tickers.push(tickerObj);
        input.value = '';

        renderTickerList();
        updateChart();
        hideEmptyState();

    } catch (error) {
        console.error('Error adding ticker:', error);
        showError(`Failed to load data for ${ticker}. Please check the ticker symbol.`);
    } finally {
        showLoading(false);
    }
}

function removeTicker(symbol) {
    tickers = tickers.filter(t => t.symbol !== symbol);
    renderTickerList();

    if (tickers.length === 0) {
        showEmptyState();
        chartInstance.data.datasets = [];
        chartInstance.update();
    } else {
        updateChart();
    }
}

function renderTickerList() {
    const container = document.getElementById('tickerList');

    if (tickers.length === 0) {
        container.innerHTML = '<p class="no-tickers">No tickers added yet</p>';
        return;
    }

    container.innerHTML = tickers.map(ticker => `
        <div class="ticker-item">
            <div class="ticker-info">
                <input type="color"
                       class="color-picker"
                       value="${ticker.color}"
                       onchange="updateTickerColor('${ticker.symbol}', this.value)"
                       title="Change line color">
                <span class="ticker-symbol">${ticker.symbol}</span>
            </div>
            <div class="ticker-controls">
                <label class="width-control">
                    <span>Width:</span>
                    <input type="range"
                           min="1"
                           max="5"
                           value="${ticker.lineWidth}"
                           oninput="updateTickerWidth('${ticker.symbol}', this.value)"
                           class="width-slider">
                    <span class="width-value">${ticker.lineWidth}px</span>
                </label>
                <button class="btn-remove" onclick="removeTicker('${ticker.symbol}')" title="Remove ticker">✕</button>
            </div>
        </div>
    `).join('');
}

function updateTickerColor(symbol, color) {
    const ticker = tickers.find(t => t.symbol === symbol);
    if (ticker) {
        ticker.color = color;
        updateChart();
    }
}

function updateTickerWidth(symbol, width) {
    const ticker = tickers.find(t => t.symbol === symbol);
    if (ticker) {
        ticker.lineWidth = parseInt(width);
        // Update display
        const widthValue = document.querySelector(`[onclick="updateTickerWidth('${symbol}', this.value)"]`)
            ?.parentElement.querySelector('.width-value');
        if (widthValue) widthValue.textContent = width + 'px';
        updateChart();
    }
}

async function refreshChart() {
    if (tickers.length === 0) return;

    showLoading(true);

    try {
        // Fetch new data for all tickers
        const promises = tickers.map(async ticker => {
            const data = await fetchAdjustedPrices(ticker.symbol, currentRange);
            ticker.data = data;
        });

        await Promise.all(promises);
        updateChart();
    } catch (error) {
        console.error('Error refreshing chart:', error);
        showError('Failed to refresh chart data');
    } finally {
        showLoading(false);
    }
}

function updateChart() {
    if (!chartInstance || tickers.length === 0) return;

    const datasets = tickers.map(ticker => ({
        label: ticker.symbol,
        data: ticker.data.map(d => ({
            x: d.date,
            y: d.price
        })),
        rawData: ticker.data,
        borderColor: ticker.color,
        backgroundColor: ticker.color + '20',
        borderWidth: ticker.lineWidth,
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: ticker.color,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2
    }));

    chartInstance.data.datasets = datasets;
    chartInstance.update('none');
    chartInstance.resetZoom();
}

async function fetchAdjustedPrices(ticker, range) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${range}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const json = await response.json();

        if (!json.chart || !json.chart.result || json.chart.result.length === 0) {
            throw new Error('No data in response');
        }

        const result = json.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];

        // Try to get adjusted close, fall back to regular close
        let prices = null;
        if (result.indicators.adjclose && result.indicators.adjclose[0]) {
            prices = result.indicators.adjclose[0].adjclose;
        } else {
            prices = quote.close;
        }

        if (!timestamps || !prices) {
            throw new Error('Missing required data fields');
        }

        // Combine all data
        const data = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (prices[i] !== null) {
                data.push({
                    date: new Date(timestamps[i] * 1000),
                    price: prices[i],
                    open: quote.open?.[i],
                    high: quote.high?.[i],
                    low: quote.low?.[i],
                    volume: quote.volume?.[i]
                });
            }
        }

        return data;

    } catch (error) {
        console.error(`Error fetching data for ${ticker}:`, error);
        throw error;
    }
}

function resetZoom() {
    if (chartInstance) {
        chartInstance.resetZoom();
    }
}

function toggleLegend() {
    showLegend = !showLegend;
    if (chartInstance) {
        chartInstance.options.plugins.legend.display = showLegend;
        chartInstance.update();
    }
}

function toggleGridLines() {
    showGrid = document.getElementById('showGridLines').checked;
    if (chartInstance) {
        chartInstance.options.scales.x.grid.display = showGrid;
        chartInstance.options.scales.y.grid.display = showGrid;
        chartInstance.update();
    }
}

function showEmptyState() {
    document.getElementById('emptyState').style.display = 'flex';
    document.querySelector('.chart-container').style.display = 'none';
}

function hideEmptyState() {
    document.getElementById('emptyState').style.display = 'none';
    document.querySelector('.chart-container').style.display = 'block';
}

function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const toast = document.getElementById('errorToast');
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function formatVolume(volume) {
    if (!volume) return 'N/A';
    if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
    if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
    if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
    return volume.toString();
}

// Make functions available globally for inline event handlers
window.removeTicker = removeTicker;
window.updateTickerColor = updateTickerColor;
window.updateTickerWidth = updateTickerWidth;
