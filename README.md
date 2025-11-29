# FranResearch - Franchise Industry Analytics Platform

**Live Site:** https://monroegamble.github.io/WebApp/

---

## Features

| Feature | Description |
|---------|-------------|
| **Stock Ticker** | Real-time scrolling ticker for 40+ franchise stocks |
| **Interactive Charts** | 10+ years of historical data with zoom, pan, and comparison mode |
| **Franchise Map** | OpenStreetMap-based location explorer |
| **News Feed** | Curated industry news from leading sources |
| **Sports Dashboard** | Live scores for NFL, NBA, NHL, MLB, MLS, WNBA |
| **Financial Calculators** | ROI, loan amortization, and payback period tools |

---

## Quick Start

1. Fork this repository
2. Enable GitHub Pages (Settings → Pages → GitHub Actions)
3. Add Finnhub API key to Secrets (see [Setup Guide](docs/SETUP.md))
4. Run the stock ticker workflow

For detailed setup instructions, see **[docs/SETUP.md](docs/SETUP.md)**

---

## Documentation

| Document | Description |
|----------|-------------|
| [Setup Checklist](docs/SETUP.md) | Step-by-step setup instructions with todo items |
| [API Setup](docs/API_SETUP.md) | Finnhub, Google Analytics, TheSportsDB configuration |
| [Deployment](docs/DEPLOYMENT.md) | GitHub Pages and Actions deployment guide |

### Feature Documentation

Each module has its own README:
- [Stock Ticker](Website/README.md)
- [Stock Charts](StockChart/README.md)
- [News Widget](FranchiseNews/README.md)
- [Sports Dashboard](FootballLive/README.md)
- [Calculators](franchise_calculators_module/README.md)
- [Data Storage](data/README.md)

---

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Charts:** Chart.js with date-fns adapter
- **Maps:** Leaflet.js + OpenStreetMap
- **Data:** CSV files + Finnhub API
- **Hosting:** GitHub Pages
- **CI/CD:** GitHub Actions

---

## Project Structure

```
WebApp/
├── index.html              # Main landing page
├── assets/css/             # Global styles
├── Website/                # Stock ticker widget
├── StockChart/             # Interactive charts
├── FranchiseMap/           # Location map
├── FranchiseNews/          # News aggregator
├── sports.html             # Sports dashboard
├── franchise_calculators_module/  # Financial tools
├── data/                   # Stock CSV data
├── scripts/                # Python automation
├── docs/                   # Documentation
└── .github/workflows/      # GitHub Actions
```

---

## License

MIT License - See LICENSE file for details.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## Support

- Check [docs/SETUP.md](docs/SETUP.md) for setup help
- Review GitHub Actions logs for workflow issues
- Open an issue for bugs or feature requests
