// ============================================================================
// LIVE FOOTBALL SCORES - MAIN JAVASCRIPT
// ============================================================================

// Configuration
const CONFIG = {
    dataUrl: '../data/football/current-week.json',
    refreshInterval: 60000, // 60 seconds
    supabaseUrl: 'YOUR_SUPABASE_URL', // Replace with actual Supabase URL
    supabaseKey: 'YOUR_SUPABASE_ANON_KEY' // Replace with actual Supabase anon key
};

// Global state
let currentFilter = 'all';
let currentView = 'schedule';
let gamesData = [];
let votesData = {};
let refreshTimer = null;
let supabase = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🏈 Initializing Football Live Scores...');

    // Initialize Supabase if configured
    initializeSupabase();

    // Set up event listeners
    setupEventListeners();

    // Load initial data
    await loadGames();

    // Start auto-refresh
    startAutoRefresh();

    console.log('✓ Football Live Scores initialized');
});

// ============================================================================
// SUPABASE INITIALIZATION
// ============================================================================

function initializeSupabase() {
    // Check if Supabase is configured
    if (CONFIG.supabaseUrl !== 'YOUR_SUPABASE_URL' &&
        CONFIG.supabaseKey !== 'YOUR_SUPABASE_ANON_KEY') {

        // Initialize Supabase client (requires Supabase JS library)
        if (typeof window.supabase !== 'undefined') {
            supabase = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
            console.log('✓ Supabase initialized');

            // Subscribe to vote changes
            subscribeToVotes();
        }
    } else {
        console.warn('⚠️ Supabase not configured - voting will use mock data');
    }
}

function subscribeToVotes() {
    if (!supabase) return;

    // Subscribe to realtime changes on football_votes table
    const subscription = supabase
        .channel('football_votes_changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'football_votes'
        }, (payload) => {
            console.log('Vote update received:', payload);
            loadVotes(); // Refresh votes
        })
        .subscribe();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderGames();
        });
    });

    // View toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentView = e.target.dataset.view;
            renderGames();
        });
    });
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadGames() {
    try {
        showLoading();

        const response = await fetch(CONFIG.dataUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        gamesData = data.games || [];

        // Update current week display
        if (data.week) {
            document.getElementById('current-week').textContent = data.week;
        }

        // Load votes
        await loadVotes();

        // Render games
        renderGames();

        // Update last refresh time
        updateLastRefreshTime();

        hideLoading();

        console.log(`✓ Loaded ${gamesData.length} games`);

    } catch (error) {
        console.error('Failed to load games:', error);
        showError(error.message);
    }
}

async function loadVotes() {
    if (supabase) {
        try {
            // Fetch votes from Supabase
            const { data, error } = await supabase
                .from('football_votes')
                .select('game_id, team_pick, count(*)')
                .group('game_id, team_pick');

            if (error) throw error;

            // Transform to votesData format
            votesData = {};
            data.forEach(row => {
                if (!votesData[row.game_id]) {
                    votesData[row.game_id] = { home: 0, away: 0 };
                }
                votesData[row.game_id][row.team_pick] = row.count || 0;
            });

        } catch (error) {
            console.error('Failed to load votes:', error);
            // Use mock votes as fallback
            generateMockVotes();
        }
    } else {
        // Generate mock votes for demo
        generateMockVotes();
    }
}

function generateMockVotes() {
    votesData = {};
    gamesData.forEach(game => {
        const homeVotes = Math.floor(Math.random() * 200) + 20;
        const awayVotes = Math.floor(Math.random() * 200) + 20;
        votesData[game.id] = { home: homeVotes, away: awayVotes };
    });
}

// ============================================================================
// RENDERING
// ============================================================================

function renderGames() {
    const container = document.getElementById('games-container');

    // Filter games
    let filteredGames = gamesData.filter(game => {
        if (currentFilter === 'all') return true;
        return game.league.toLowerCase() === currentFilter;
    });

    // Further filter by view
    if (currentView === 'live') {
        filteredGames = filteredGames.filter(game => game.status === 'in_progress');
    }

    // Show empty state if no games
    if (filteredGames.length === 0) {
        container.style.display = 'none';
        document.getElementById('empty-state').style.display = 'block';
        return;
    }

    document.getElementById('empty-state').style.display = 'none';
    container.style.display = 'block';

    // Group games by date
    const gamesByDate = groupGamesByDate(filteredGames);

    // Render sections
    container.innerHTML = '';
    Object.keys(gamesByDate).sort().forEach(date => {
        const section = createDateSection(date, gamesByDate[date]);
        container.appendChild(section);
    });
}

function groupGamesByDate(games) {
    const grouped = {};
    games.forEach(game => {
        const date = new Date(game.startTime).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(game);
    });

    // Sort games within each date by start time
    Object.keys(grouped).forEach(date => {
        grouped[date].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    });

    return grouped;
}

function createDateSection(date, games) {
    const section = document.createElement('div');
    section.className = 'date-section';

    const liveCount = games.filter(g => g.status === 'in_progress').length;

    section.innerHTML = `
        <div class="date-header">
            <h2>${date}</h2>
            ${liveCount > 0 ? `<span class="date-badge">🔴 ${liveCount} Live</span>` : ''}
        </div>
        <div class="games-grid" id="games-${date.replace(/\s+/g, '-')}">
        </div>
    `;

    const grid = section.querySelector('.games-grid');
    games.forEach(game => {
        grid.appendChild(createGameCard(game));
    });

    return section;
}

function createGameCard(game) {
    const card = document.createElement('div');
    card.className = `game-card ${game.status === 'in_progress' ? 'live' : ''}`;
    card.dataset.gameId = game.id;

    const votes = votesData[game.id] || { home: 0, away: 0 };
    const totalVotes = votes.home + votes.away;
    const homePercent = totalVotes > 0 ? Math.round((votes.home / totalVotes) * 100) : 50;
    const awayPercent = totalVotes > 0 ? Math.round((votes.away / totalVotes) * 100) : 50;

    const isLive = game.status === 'in_progress';
    const isFinal = game.status === 'final';
    const homeWinning = game.homeScore > game.awayScore;
    const awayWinning = game.awayScore > game.homeScore;

    card.innerHTML = `
        <div class="game-header">
            <span class="league-badge ${game.league.toLowerCase()}">${game.league}</span>
            <div class="game-status">
                <span class="status-dot ${isLive ? 'live' : isFinal ? 'final' : ''}"></span>
                <span>${getStatusText(game)}</span>
            </div>
        </div>

        <div class="matchup">
            <div class="team ${isFinal && homeWinning ? 'winning' : ''}">
                <div class="team-info">
                    ${game.homeTeam.logoUrl ? `<img src="${game.homeTeam.logoUrl}" alt="${game.homeTeam.name}" class="team-logo">` : ''}
                    <span class="team-name">${game.homeTeam.name}</span>
                </div>
                ${game.homeScore !== undefined ? `<span class="team-score">${game.homeScore}</span>` : ''}
            </div>

            <div class="team ${isFinal && awayWinning ? 'winning' : ''}">
                <div class="team-info">
                    ${game.awayTeam.logoUrl ? `<img src="${game.awayTeam.logoUrl}" alt="${game.awayTeam.name}" class="team-logo">` : ''}
                    <span class="team-name">${game.awayTeam.name}</span>
                </div>
                ${game.awayScore !== undefined ? `<span class="team-score">${game.awayScore}</span>` : ''}
            </div>
        </div>

        <div class="game-meta">
            <span class="game-time">${formatGameTime(game)}</span>
            ${game.quarter ? `<span class="game-quarter">Q${game.quarter} ${game.clock || ''}</span>` : ''}
        </div>

        <div class="voting-section">
            <div class="voting-header">
                <span class="voting-title">🗳️ Community Prediction</span>
                <span class="total-votes">${totalVotes} votes</span>
            </div>

            <div class="vote-chart">
                <div class="vote-bar-container">
                    <div class="vote-bar home" style="width: ${homePercent}%">
                        ${homePercent > 15 ? `${homePercent}%` : ''}
                    </div>
                    <div class="vote-bar away" style="width: ${awayPercent}%">
                        ${awayPercent > 15 ? `${awayPercent}%` : ''}
                    </div>
                </div>
            </div>

            ${game.status === 'scheduled' ? `
                <button class="vote-button" onclick="openVoteModal('${game.id}')">
                    Pick Your Winner
                </button>
            ` : ''}
        </div>
    `;

    return card;
}

function getStatusText(game) {
    switch (game.status) {
        case 'scheduled':
            return 'Upcoming';
        case 'in_progress':
            return 'LIVE';
        case 'final':
            return 'Final';
        case 'postponed':
            return 'Postponed';
        case 'canceled':
            return 'Canceled';
        default:
            return game.status;
    }
}

function formatGameTime(game) {
    const date = new Date(game.startTime);
    const now = new Date();

    if (game.status === 'in_progress') {
        return 'Live Now';
    } else if (game.status === 'final') {
        return 'Final';
    } else {
        // Show time
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
}

// ============================================================================
// VOTING
// ============================================================================

window.openVoteModal = function(gameId) {
    const game = gamesData.find(g => g.id === gameId);
    if (!game) return;

    const modal = document.getElementById('vote-modal');
    const title = document.getElementById('modal-title');
    const options = document.getElementById('vote-options');
    const stats = document.getElementById('vote-stats');

    title.textContent = 'Pick the Winner';

    const votes = votesData[gameId] || { home: 0, away: 0 };
    const totalVotes = votes.home + votes.away;
    const homePercent = totalVotes > 0 ? Math.round((votes.home / totalVotes) * 100) : 50;
    const awayPercent = totalVotes > 0 ? Math.round((votes.away / totalVotes) * 100) : 50;

    options.innerHTML = `
        <button class="vote-option-btn" onclick="submitVote('${gameId}', 'home')">
            <div class="vote-option-team">${game.homeTeam.shortName || game.homeTeam.name}</div>
            <div>${homePercent}% (${votes.home} votes)</div>
        </button>
        <button class="vote-option-btn" onclick="submitVote('${gameId}', 'away')">
            <div class="vote-option-team">${game.awayTeam.shortName || game.awayTeam.name}</div>
            <div>${awayPercent}% (${votes.away} votes)</div>
        </button>
    `;

    stats.innerHTML = `
        <p style="text-align: center; color: #666;">
            <strong>${totalVotes}</strong> total predictions • Updates in real-time
        </p>
    `;

    modal.classList.add('active');
};

window.closeVoteModal = function() {
    document.getElementById('vote-modal').classList.remove('active');
};

window.submitVote = async function(gameId, teamPick) {
    try {
        if (supabase) {
            // Submit vote to Supabase
            const { data, error } = await supabase
                .from('football_votes')
                .insert([
                    {
                        game_id: gameId,
                        team_pick: teamPick,
                        voted_at: new Date().toISOString()
                    }
                ]);

            if (error) throw error;

            console.log('✓ Vote submitted');
        } else {
            // Mock vote submission
            if (!votesData[gameId]) {
                votesData[gameId] = { home: 0, away: 0 };
            }
            votesData[gameId][teamPick]++;
            console.log('✓ Mock vote submitted');
        }

        // Refresh votes and re-render
        await loadVotes();
        renderGames();

        // Close modal
        closeVoteModal();

        // Show success message
        showSuccessMessage('Your pick has been recorded!');

    } catch (error) {
        console.error('Failed to submit vote:', error);
        alert('Failed to submit vote. Please try again.');
    }
};

function showSuccessMessage(message) {
    // Create temporary success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #43e97b;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ============================================================================
// AUTO-REFRESH
// ============================================================================

function startAutoRefresh() {
    refreshTimer = setInterval(async () => {
        console.log('🔄 Auto-refreshing data...');
        await loadGames();
    }, CONFIG.refreshInterval);
}

function stopAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

function updateLastRefreshTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    document.getElementById('last-update').textContent = timeString;
}

// ============================================================================
// UI HELPERS
// ============================================================================

function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('games-container').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('games-container').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('error-message').textContent = message;
}

// ============================================================================
// CLEANUP
// ============================================================================

window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});

// Close modal on outside click
document.getElementById('vote-modal').addEventListener('click', (e) => {
    if (e.target.id === 'vote-modal') {
        closeVoteModal();
    }
});
