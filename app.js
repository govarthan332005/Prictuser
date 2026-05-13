// Main App Logic
const state = {
    signals: [],
    trainingData: [],
    history: [],
    stats: {
        total: 0,
        correct: 0,
        wrong: 0,
        dragonWins: 0,
        tigerWins: 0,
        tieWins: 0
    },
    lastPrediction: null,
    lastTrainedAt: null
};

const STORAGE_KEY = 'dt_app_state_v1';

// ==== STORAGE ====
function saveLocal() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            trainingData: state.trainingData,
            history: state.history.slice(-100),
            stats: state.stats,
            lastTrainedAt: state.lastTrainedAt
        }));
    } catch(e) { console.warn('local save fail', e); }
}

function loadLocal() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            state.trainingData = data.trainingData || [];
            state.history = data.history || [];
            state.stats = data.stats || state.stats;
            state.lastTrainedAt = data.lastTrainedAt || null;
        }
    } catch(e) { console.warn('local load fail', e); }
}

// ==== UI HELPERS ====
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function toast(msg, type = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => t.classList.remove('show'), 2500);
}

function signalToEmoji(s) {
    if (s === 'D' || s === 'Dragon') return '🐉';
    if (s === 'T' || s === 'Tiger') return '🐅';
    return '🤝';
}

function signalToName(s) {
    if (s === 'D') return 'DRAGON';
    if (s === 'T') return 'TIGER';
    return 'TIE';
}

function signalToClass(s) {
    if (s === 'D') return 'dragon';
    if (s === 'T') return 'tiger';
    return 'tie';
}

// ==== RENDER ====
function renderSlots() {
    const container = $('#signalSlots');
    container.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const slot = document.createElement('div');
        const sig = state.signals[i];
        slot.className = 'signal-slot' + (sig ? ' filled ' + signalToClass(sig) : '');
        slot.innerHTML = `<span class="slot-number">${i+1}</span>${sig ? signalToEmoji(sig) : ''}`;
        container.appendChild(slot);
    }
    $('#signalCount').textContent = state.signals.length;
    $('#predictBtn').disabled = state.signals.length < 3;
    renderPatternStats();
}

function renderPatternStats() {
    let d = 0, t = 0, tie = 0;
    state.signals.forEach(s => {
        if (s === 'D') d++; else if (s === 'T') t++; else tie++;
    });
    $('#dragonCount').textContent = d;
    $('#tigerCount').textContent = t;
    $('#tieCount').textContent = tie;

    // streak
    let streak = 0;
    if (state.signals.length > 0) {
        const last = state.signals[state.signals.length - 1];
        streak = 1;
        for (let i = state.signals.length - 2; i >= 0; i--) {
            if (state.signals[i] === last) streak++;
            else break;
        }
    }
    $('#streakCount').textContent = streak;
}

function renderPrediction(result) {
    const container = $('#predictionResult');
    if (!result) {
        container.innerHTML = `
            <div class="prediction-placeholder">
                <div class="placeholder-icon">🎲</div>
                <p>Enter 10 previous signals below to get AI prediction</p>
            </div>`;
        $('#confidenceMeter').style.display = 'none';
        return;
    }
    const name = signalToName(result.prediction);
    const cls = signalToClass(result.prediction);
    const emoji = signalToEmoji(result.prediction);

    container.innerHTML = `
        <div class="prediction-active">
            <div class="pred-big-emoji">${emoji}</div>
            <div class="pred-text ${cls}">${name}</div>
        </div>`;

    $('#confidenceMeter').style.display = 'block';
    $('#confidenceValue').textContent = result.confidence + '%';
    setTimeout(() => {
        $('#confidenceFill').style.width = result.confidence + '%';
    }, 100);
}

function renderTrainingInfo() {
    $('#trainingCount').textContent = state.trainingData.length;
    $('#modelAccuracy').textContent = state.stats.total > 0
        ? Math.round((state.stats.correct / state.stats.total) * 100) + '%'
        : '--';
    $('#lastTrained').textContent = state.lastTrainedAt
        ? new Date(state.lastTrainedAt).toLocaleString()
        : 'Never';
}

function renderHistory() {
    const list = $('#historyList');
    if (state.history.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>No predictions yet</p>
            </div>`;
        return;
    }
    list.innerHTML = state.history.slice().reverse().map(h => `
        <div class="history-item">
            <div class="history-emoji">${signalToEmoji(h.prediction)}</div>
            <div class="history-info">
                <div class="history-pred">${signalToName(h.prediction)}</div>
                <div class="history-time">${new Date(h.timestamp).toLocaleString()}</div>
            </div>
            <div class="history-conf">${h.confidence}%</div>
        </div>
    `).join('');
}

function renderStats() {
    const accuracy = state.stats.total > 0
        ? Math.round((state.stats.correct / state.stats.total) * 100)
        : 0;
    $('#overallAccuracy').textContent = accuracy + '%';
    $('#totalPredictionsCount').textContent = state.stats.total + ' total predictions';
    $('#correctCount').textContent = state.stats.correct;
    $('#wrongCount').textContent = state.stats.wrong;
    $('#dragonWins').textContent = state.stats.dragonWins;
    $('#tigerWins').textContent = state.stats.tigerWins;

    // Performance chart from history
    const chart = $('#performanceChart');
    chart.innerHTML = '';
    const recent = state.history.slice(-20);
    recent.forEach(h => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        const conf = h.confidence || 50;
        bar.style.height = conf + '%';
        if (h.verified === true) bar.classList.add('correct');
        if (h.verified === false) bar.classList.add('wrong');
        chart.appendChild(bar);
    });
    if (recent.length === 0) {
        chart.innerHTML = '<p style="color:var(--text-muted);font-size:12px;text-align:center;width:100%;">No data yet</p>';
    }
}

function renderAll() {
    renderSlots();
    renderTrainingInfo();
    renderHistory();
    renderStats();
}

// ==== SIGNAL INPUT ====
function addSignal(s) {
    if (state.signals.length >= 10) {
        // shift oldest out
        state.signals.shift();
    }
    state.signals.push(s);
    renderSlots();
    // haptic
    if (navigator.vibrate) navigator.vibrate(15);
}

function undoSignal() {
    if (state.signals.length === 0) return;
    state.signals.pop();
    renderSlots();
    if (navigator.vibrate) navigator.vibrate(10);
}

function clearSignals() {
    state.signals = [];
    renderSlots();
    renderPrediction(null);
}

// ==== PREDICTION ====
function doPredict() {
    if (state.signals.length < 3) {
        toast('Need at least 3 signals', 'error');
        return;
    }

    // Apply settings
    window.predictor.minConfidence = parseInt($('#minConfidence').value);
    window.predictor.mode = $('#algorithmMode').value;
    window.predictor.setTrainingData(state.trainingData);

    const result = window.predictor.predict(state.signals);
    state.lastPrediction = {
        prediction: result.prediction,
        confidence: result.confidence,
        inputs: [...state.signals],
        timestamp: Date.now(),
        verified: null
    };
    state.history.push(state.lastPrediction);
    renderPrediction(result);
    renderHistory();
    renderStats();
    saveLocal();

    // Send to Firebase
    if (window.FB && window.FB.ready) {
        window.FB.savePrediction(state.lastPrediction);
    }

    // Send to overlay
    if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('prediction-updated', { detail: result }));
    }

    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    toast(`Prediction: ${signalToName(result.prediction)} (${result.confidence}%)`, 'success');
}

// ==== TRAINING ====
function parseRecords(text) {
    const cleaned = text.replace(/\n/g, ',').replace(/\s+/g, ',');
    return cleaned.split(/[,;|]/).map(s => window.predictor.normalize(s)).filter(Boolean);
}

function addTrainingData(records) {
    if (!records || records.length === 0) {
        toast('No valid signals found', 'error');
        return;
    }
    state.trainingData.push(...records);
    saveLocal();
    renderTrainingInfo();
    toast(`Added ${records.length} training records`, 'success');
    if (window.FB && window.FB.ready) {
        window.FB.saveTraining(state.trainingData);
    }
}

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        let records = [];
        if (file.name.endsWith('.json')) {
            try {
                const data = JSON.parse(text);
                const arr = Array.isArray(data) ? data : (data.records || data.signals || []);
                records = arr.map(r => window.predictor.normalize(r)).filter(Boolean);
            } catch (err) {
                toast('Invalid JSON file', 'error');
                return;
            }
        } else {
            records = parseRecords(text);
        }
        addTrainingData(records);
    };
    reader.readAsText(file);
}

function trainModel() {
    if (state.trainingData.length < 10) {
        toast('Need at least 10 records to train', 'error');
        return;
    }
    window.predictor.setTrainingData(state.trainingData);
    state.lastTrainedAt = Date.now();
    saveLocal();
    renderTrainingInfo();
    toast(`Model trained on ${state.trainingData.length} records!`, 'success');
    if (window.FB && window.FB.ready) {
        window.FB.saveTraining(state.trainingData);
    }
}

// ==== TABS ====
function switchTab(tabName) {
    $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tabName));
}

// ==== SIDE MENU ====
function openMenu() {
    $('#sideMenu').classList.add('open');
    $('#menuOverlay').classList.add('show');
}
function closeMenu() {
    $('#sideMenu').classList.remove('open');
    $('#menuOverlay').classList.remove('show');
}

// ==== EVENT BINDINGS ====
function bindEvents() {
    // Signal input
    $('#addDragon').addEventListener('click', () => addSignal('D'));
    $('#addTiger').addEventListener('click', () => addSignal('T'));
    $('#addTie').addEventListener('click', () => addSignal('Tie'));
    $('#undoBtn').addEventListener('click', undoSignal);
    $('#clearBtn').addEventListener('click', clearSignals);
    $('#predictBtn').addEventListener('click', doPredict);

    // Tabs
    $$('.tab-btn').forEach(b => {
        b.addEventListener('click', () => switchTab(b.dataset.tab));
    });

    // Menu
    $('#menuBtn').addEventListener('click', openMenu);
    $('#closeMenu').addEventListener('click', closeMenu);
    $('#menuOverlay').addEventListener('click', closeMenu);

    // Training
    $('#uploadZone').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
    });
    $('#bulkAddBtn').addEventListener('click', () => {
        const text = $('#bulkInput').value;
        const records = parseRecords(text);
        addTrainingData(records);
        $('#bulkInput').value = '';
    });
    $('#trainModelBtn').addEventListener('click', trainModel);

    // Drag & drop
    const dz = $('#uploadZone');
    ['dragenter','dragover'].forEach(ev => {
        dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragging'); });
    });
    ['dragleave','drop'].forEach(ev => {
        dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragging'); });
    });
    dz.addEventListener('drop', (e) => {
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    // History
    $('#clearHistoryBtn').addEventListener('click', () => {
        if (confirm('Clear all prediction history?')) {
            state.history = [];
            state.stats = { total: 0, correct: 0, wrong: 0, dragonWins: 0, tigerWins: 0, tieWins: 0 };
            saveLocal();
            renderHistory();
            renderStats();
            if (window.FB && window.FB.ready) window.FB.clearAll();
            toast('History cleared');
        }
    });

    // Stats
    $('#syncCloudBtn').addEventListener('click', async () => {
        if (!window.FB || !window.FB.ready) {
            toast('Cloud not connected', 'error');
            return;
        }
        await window.FB.saveTraining(state.trainingData);
        await window.FB.saveStats(state.stats);
        toast('Synced to cloud!', 'success');
    });

    // Overlay button (open)
    $('#overlayToggle').addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('open-overlay'));
        closeMenu();
    });
    $('#openOverlayBtn').addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('open-overlay'));
        closeMenu();
    });

    // Prevent zoom
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('gesturechange', e => e.preventDefault());
    document.addEventListener('gestureend', e => e.preventDefault());

    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd < 300) e.preventDefault();
        lastTouchEnd = now;
    }, { passive: false });
}

// ==== FIREBASE ====
document.addEventListener('firebase-ready', async (e) => {
    $('#authStatus').textContent = 'Connected ✓';
    $('#authStatus').style.color = '#4ade80';
    $('#userIdDisplay').textContent = e.detail.uid.slice(0, 12) + '...';

    // Load remote data
    try {
        const remote = await window.FB.loadTraining();
        if (remote && remote.length > state.trainingData.length) {
            state.trainingData = remote;
            renderTrainingInfo();
        }
        const remoteStats = await window.FB.loadStats();
        if (remoteStats) {
            state.stats = { ...state.stats, ...remoteStats };
            renderStats();
        }
    } catch (err) { console.warn(err); }
});

document.addEventListener('firebase-offline', () => {
    $('#authStatus').textContent = 'Offline Mode';
    $('#authStatus').style.color = '#ffa726';
});

// ==== INIT ====
function init() {
    loadLocal();
    bindEvents();
    renderAll();

    // hide splash
    setTimeout(() => {
        $('#splash').style.transition = 'opacity 0.4s';
        $('#splash').style.opacity = '0';
        setTimeout(() => {
            $('#splash').style.display = 'none';
            $('#app').style.display = 'flex';
        }, 400);
    }, 2000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.appState = state;
