// Floating Draggable Overlay - works "over other apps" via WebView/Android conversion
const overlay = {
    el: null,
    bubble: null,
    signals: [],
    isMinimized: false,
    isExpanded: false,
    pos: { x: null, y: null },
    dragOffset: { x: 0, y: 0 }
};

function $o(sel) { return document.querySelector(sel); }

function initOverlay() {
    overlay.el = $o('#floatingOverlay');
    overlay.bubble = $o('#floatingBubble');

    // Drag header
    makeDraggable(overlay.el, $o('#overlayHeader'));
    makeDraggable(overlay.bubble, overlay.bubble);

    // Resize handle
    initResize();

    // Controls
    $o('#overlayMinimize').addEventListener('click', minimizeOverlay);
    $o('#overlayClose').addEventListener('click', closeOverlay);
    $o('#overlayExpand').addEventListener('click', toggleExpand);

    // Bubble click to restore
    overlay.bubble.addEventListener('click', (e) => {
        if (overlay.bubble.dataset.dragged === 'true') {
            overlay.bubble.dataset.dragged = 'false';
            return;
        }
        restoreOverlay();
    });

    // Input buttons
    document.querySelectorAll('.overlay-input-btn').forEach(b => {
        b.addEventListener('click', () => addOverlaySignal(b.dataset.val));
    });

    $o('#overlayUndo').addEventListener('click', () => {
        overlay.signals.pop();
        renderOverlayHistory();
    });

    $o('#overlayPredict').addEventListener('click', doOverlayPredict);

    // Listen for events
    window.addEventListener('open-overlay', openOverlay);
    window.addEventListener('prediction-updated', (e) => {
        showOverlayResult(e.detail);
    });
}

function makeDraggable(target, handle) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    let moved = false;

    function start(e) {
        // Don't drag when clicking buttons inside header
        if (e.target.closest('.overlay-btn') || e.target.closest('.overlay-controls')) return;

        isDragging = true;
        moved = false;
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        const rect = target.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        target.style.transition = 'none';
        e.preventDefault();
    }

    function move(e) {
        if (!isDragging) return;
        const touch = e.touches ? e.touches[0] : e;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;

        const newLeft = startLeft + dx;
        const newTop = startTop + dy;
        const maxLeft = window.innerWidth - target.offsetWidth;
        const maxTop = window.innerHeight - target.offsetHeight;

        target.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
        target.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
        target.style.right = 'auto';
        e.preventDefault();
    }

    function end(e) {
        if (isDragging && moved) {
            target.dataset.dragged = 'true';
        }
        isDragging = false;
        target.style.transition = '';
    }

    handle.addEventListener('mousedown', start);
    handle.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('mousemove', move);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('mouseup', end);
    document.addEventListener('touchend', end);
}

function initResize() {
    const handle = $o('#overlayResize');
    let resizing = false;
    let startX, startY, startW, startH;

    function start(e) {
        resizing = true;
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        startW = overlay.el.offsetWidth;
        startH = overlay.el.offsetHeight;
        e.preventDefault();
        e.stopPropagation();
    }
    function move(e) {
        if (!resizing) return;
        const touch = e.touches ? e.touches[0] : e;
        const newW = Math.max(220, Math.min(window.innerWidth - 20, startW + (touch.clientX - startX)));
        const newH = Math.max(200, Math.min(window.innerHeight - 20, startH + (touch.clientY - startY)));
        overlay.el.style.width = newW + 'px';
        overlay.el.style.height = newH + 'px';
        e.preventDefault();
    }
    function end() { resizing = false; }

    handle.addEventListener('mousedown', start);
    handle.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('mousemove', move);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('mouseup', end);
    document.addEventListener('touchend', end);
}

function openOverlay() {
    overlay.el.style.display = 'block';
    overlay.bubble.style.display = 'none';
    overlay.isMinimized = false;

    // Load website URL if provided
    const url = $o('#overlayUrl').value.trim();
    const iframe = $o('#overlayIframe');
    if (url) {
        try {
            const u = new URL(url);
            iframe.src = u.href;
        } catch (e) {}
    }
}

function closeOverlay() {
    overlay.el.style.display = 'none';
    overlay.bubble.style.display = 'none';
}

function minimizeOverlay() {
    overlay.el.style.display = 'none';
    overlay.bubble.style.display = 'flex';
    overlay.isMinimized = true;

    // Position bubble where overlay was
    const rect = overlay.el.getBoundingClientRect();
    if (rect.left > 0) {
        overlay.bubble.style.left = rect.left + 'px';
        overlay.bubble.style.top = rect.top + 'px';
        overlay.bubble.style.right = 'auto';
    }
}

function restoreOverlay() {
    overlay.el.style.display = 'block';
    overlay.bubble.style.display = 'none';
    overlay.isMinimized = false;

    // Move overlay to bubble pos
    const rect = overlay.bubble.getBoundingClientRect();
    if (rect.left > 0) {
        overlay.el.style.left = rect.left + 'px';
        overlay.el.style.top = rect.top + 'px';
        overlay.el.style.right = 'auto';
    }
}

function toggleExpand() {
    overlay.isExpanded = !overlay.isExpanded;
    overlay.el.classList.toggle('expanded', overlay.isExpanded);
    const iframe = $o('#overlayIframe');
    const url = $o('#overlayUrl').value.trim();
    if (overlay.isExpanded && url) {
        iframe.style.display = 'block';
        if (!iframe.src || iframe.src === 'about:blank') {
            try { iframe.src = new URL(url).href; } catch(e) {}
        }
    } else {
        iframe.style.display = 'none';
    }
}

function addOverlaySignal(val) {
    if (overlay.signals.length >= 10) overlay.signals.shift();
    overlay.signals.push(val);
    renderOverlayHistory();
    if (navigator.vibrate) navigator.vibrate(10);
}

function renderOverlayHistory() {
    const container = $o('#overlayHistory');
    container.innerHTML = overlay.signals.map(s => {
        const cls = s === 'D' ? 'd' : s === 'T' ? 't' : 'tie';
        const emoji = s === 'D' ? '🐉' : s === 'T' ? '🐅' : '🤝';
        return `<div class="overlay-history-item ${cls}">${emoji}</div>`;
    }).join('');
}

function doOverlayPredict() {
    if (overlay.signals.length < 3) {
        showOverlayMessage('Need 3+ signals');
        return;
    }
    if (!window.predictor) return;

    window.predictor.setTrainingData(window.appState ? window.appState.trainingData : []);
    const result = window.predictor.predict(overlay.signals);
    showOverlayResult(result);

    // Also push to main app history
    if (window.appState) {
        window.appState.history.push({
            prediction: result.prediction,
            confidence: result.confidence,
            inputs: [...overlay.signals],
            timestamp: Date.now(),
            verified: null,
            source: 'overlay'
        });
        if (window.FB && window.FB.ready) {
            window.FB.savePrediction({
                prediction: result.prediction,
                confidence: result.confidence,
                inputs: [...overlay.signals],
                source: 'overlay'
            });
        }
    }
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
}

function showOverlayResult(result) {
    const emoji = result.prediction === 'D' ? '🐉' : result.prediction === 'T' ? '🐅' : '🤝';
    const name = result.prediction === 'D' ? 'DRAGON' : result.prediction === 'T' ? 'TIGER' : 'TIE';
    $o('#overlayPrediction').innerHTML = `
        <div class="overlay-emoji">${emoji}</div>
        <div class="overlay-result-text">${name} • ${result.confidence}%</div>
    `;
}

function showOverlayMessage(msg) {
    $o('#overlayPrediction').innerHTML = `
        <div class="overlay-emoji">⚠️</div>
        <div class="overlay-result-text">${msg}</div>
    `;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOverlay);
} else {
    initOverlay();
}
