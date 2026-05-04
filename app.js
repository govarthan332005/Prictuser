// ============================================================================
// ROULETTE USER APP — v3.0 PREMIUM
// 9-model ensemble · calibrated confidence · adaptive weights
// ============================================================================
import {
  db, auth, ref, set, push, get, onValue, update,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail
} from './firebase-config.js';
import { PredictionEngine } from './prediction-engine.js';

const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const numColor = n => n === 0 ? 'G' : (RED_NUMBERS.has(n) ? 'R' : 'B');
const numEO    = n => n === 0 ? null : (n % 2 === 0 ? 'E' : 'O');
const labelOf  = c => ({ E: 'EVEN', O: 'ODD', R: 'RED', B: 'BLACK' }[c] || '—');

// Strip undefined/null keys before Firebase write
function clean(obj) {
  const r = {};
  Object.keys(obj || {}).forEach(k => {
    if (obj[k] !== undefined && obj[k] !== null) r[k] = obj[k];
  });
  return r;
}

// ---------- Persistent settings ----------
const settings = {
  confThreshold: parseInt(localStorage.getItem('rp_conf') || '55'),
  vibration: localStorage.getItem('rp_vib') !== 'false',
  sound: localStorage.getItem('rp_sound') === 'true',
  breakReminder: localStorage.getItem('rp_break') !== 'false',
  autoSave: localStorage.getItem('rp_autosave') !== 'false',
  tourSeen: localStorage.getItem('rp_tour') === 'done'
};
const saveSetting = (k, v) => localStorage.setItem('rp_' + k, String(v));

// ---------- App state ----------
const engine = new PredictionEngine();
let trainingData = [];
let predictSeq  = [];
let predictMode = 'even_odd';
let predictMethod = 'numbers';
let liveSeq  = [];
let liveMode = 'even_odd';
let lastLivePrediction = null;
let liveStats = { correct: 0, total: 0, streak: 0, maxStreak: 0 };
let userPredHistory = [];
let lastPrediction = null;
let currentUser = null;
let breakTimer = null;
let sessionStart = Date.now();
let _historyUnsub = null;

// ---------- Toast ----------
function toast(msg, type = '') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2800);
}

function showLoginMsg(msg, type) {
  const m = $('loginMsg');
  if (!m) return;
  m.textContent = msg;
  m.className = 'msg ' + type;
}

function vibrate(ms = 12) {
  if (settings.vibration && navigator.vibrate) navigator.vibrate(ms);
}

function beep(freq = 800, dur = 80) {
  if (!settings.sound) return;
  try {
    const ctx = beep._ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    setTimeout(() => osc.stop(), dur);
  } catch {}
}

// ---------- AUTH ----------
$('loginBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  const pw = $('password').value;
  if (!email || !pw) return showLoginMsg('Email & password required', 'error');
  try { await signInWithEmailAndPassword(auth, email, pw); }
  catch (e) { showLoginMsg(prettyAuthErr(e), 'error'); }
});

$('signupBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  const pw = $('password').value;
  if (!email || pw.length < 6) return showLoginMsg('Email + password (6+ chars) required', 'error');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await set(ref(db, `users/${cred.user.uid}`), {
      email, createdAt: Date.now(), predictionCount: 0, correctCount: 0, accuracy: 0, lastActive: Date.now()
    });
    showLoginMsg('✓ Account created! 🎉', 'success');
  } catch (e) { showLoginMsg(prettyAuthErr(e), 'error'); }
});

$('forgotBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  if (!email) return showLoginMsg('Enter your email first', 'error');
  try {
    await sendPasswordResetEmail(auth, email);
    showLoginMsg('✓ Password reset email sent', 'success');
  } catch (e) { showLoginMsg(prettyAuthErr(e), 'error'); }
});

$('guestBtn').addEventListener('click', () => {
  currentUser = { uid: 'guest', email: 'Guest' };
  enterApp();
});

$('signOutBtn').addEventListener('click', () => {
  if (currentUser?.uid === 'guest') {
    currentUser = null;
    location.reload();
  } else {
    signOut(auth);
  }
});

function prettyAuthErr(e) {
  const m = (e.code || e.message || '').toString();
  if (m.includes('user-not-found')) return 'No account with this email';
  if (m.includes('wrong-password') || m.includes('invalid-credential')) return 'Wrong password';
  if (m.includes('invalid-email')) return 'Invalid email format';
  if (m.includes('email-already')) return 'Email already in use';
  if (m.includes('weak-password')) return 'Password too weak (6+ chars)';
  if (m.includes('network')) return 'Network error — check connection';
  return e.message || 'Something went wrong';
}

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = { uid: user.uid, email: user.email };
    enterApp();
    loadUserHistory();
    // Update lastActive timestamp at login (fix: stale data)
    update(ref(db, `users/${user.uid}`), { lastActive: Date.now() }).catch(() => {});
  }
});

function enterApp() {
  $('loginScreen').classList.remove('active');
  $('app').classList.add('active');
  $('userBoxEmail').textContent = currentUser.email;
  initApp();
  startBreakTimer();
  if (!settings.tourSeen) {
    setTimeout(() => $('welcomeTour').classList.remove('hidden'), 400);
  }
  if (settings.autoSave) restoreSequence();
}

// ---------- TABS ----------
$$('.tab').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.remove('active'));
  $$('.tab-panel').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $(`[data-panel="${t.dataset.tab}"]`).classList.add('active');
  if (t.dataset.tab === 'insights') renderInsights();
  if (t.dataset.tab === 'history') renderHistory();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}));

// ---------- METHOD TABS ----------
$$('.method-tab').forEach(b => b.addEventListener('click', () => {
  $$('.method-tab').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  predictMethod = b.dataset.method;
  $$('.input-method').forEach(x => x.classList.remove('active'));
  document.querySelector(`[data-input="${predictMethod}"]`).classList.add('active');
}));

// ---------- MODE TABS ----------
$$('.mode-tab').forEach(b => b.addEventListener('click', () => {
  const isLive = b.dataset.livemode !== undefined;
  b.parentElement.querySelectorAll('.mode-tab').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  if (isLive) {
    liveMode = b.dataset.livemode;
    updateLivePrediction();
  } else {
    predictMode = b.dataset.pmode;
    renderSeq();
    persistSequence();
  }
}));

// ---------- DATA LOADING ----------
function initApp() {
  if (_historyUnsub) try { _historyUnsub(); } catch {}
  _historyUnsub = onValue(ref(db, 'history'), snap => {
    const hist = snap.val() || {};
    trainingData = Object.values(hist)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    engine.setHistory(trainingData);
    updateDataPill();
    // Re-render insights if currently visible
    const insightsVisible = document.querySelector('[data-panel="insights"]')?.classList.contains('active');
    if (insightsVisible) renderInsights();
  });
  buildNumberPads();
}

function updateDataPill() {
  const count = trainingData.length;
  const pill = $('dataPill');
  if (count === 0) {
    pill.textContent = '⚠ No data';
    pill.className = 'data-pill bad';
  } else if (count < 100) {
    pill.textContent = `🟡 ${count} spins`;
    pill.className = 'data-pill warn';
  } else {
    pill.textContent = `🟢 ${count.toLocaleString()} spins`;
    pill.className = 'data-pill good';
  }
}

// ---------- NUMBER PADS ----------
function buildNumberPads() {
  const buildPad = (id, onTap) => {
    const c = $(id);
    if (!c || c._built) return;
    c._built = true;
    let html = '';
    for (let n = 1; n <= 36; n++) {
      const cls = RED_NUMBERS.has(n) ? 'red' : 'black';
      html += `<button class="num-btn ${cls}" data-n="${n}">${n}</button>`;
    }
    html += `<button class="num-btn green" data-n="0">0 (Zero)</button>`;
    c.innerHTML = html;
    c.querySelectorAll('.num-btn').forEach(b => {
      b.addEventListener('click', () => {
        const n = parseInt(b.dataset.n);
        b.style.transform = 'scale(0.78)';
        setTimeout(() => b.style.transform = '', 130);
        vibrate(15);
        onTap(n);
      });
    });
  };
  buildPad('predictPad', n => addToPredict({ n, eo: numEO(n), color: numColor(n) }));
  buildPad('livePad', n => addToLive({ n, eo: numEO(n), color: numColor(n) }));
}

// ---------- PREDICT TAB INPUT ----------
function addToPredict(entry) {
  if (predictSeq.length >= 50) return toast('Maximum 50 entries reached', 'warn');
  predictSeq.push(clean(entry));
  renderSeq();
  persistSequence();
}

// Manual E/O / R/B buttons
$$('[data-input]').forEach(b => {
  if (!b.dataset.input || b.dataset.input === 'numbers' || b.dataset.input === 'manual') return;
  b.addEventListener('click', () => {
    const v = b.dataset.input;
    const entry = {};
    if (v === 'E' || v === 'O') entry.eo = v;
    if (v === 'R' || v === 'B') entry.color = v;
    addToPredict(entry);
    vibrate(15);
  });
});

$('undoBtn').addEventListener('click', () => { predictSeq.pop(); renderSeq(); persistSequence(); });
$('clearBtn').addEventListener('click', () => {
  predictSeq = []; renderSeq(); persistSequence();
  $('predictionCard').classList.add('hidden');
});

function renderSeq() {
  const display = $('seqDisplay');
  display.innerHTML = predictSeq.map((e, i) => {
    let label, cls;
    if (typeof e.n === 'number') {
      label = e.n;
      cls = e.color || '';
    } else if (e.eo) { label = e.eo; cls = e.eo; }
    else if (e.color) { label = e.color; cls = e.color; }
    else { label = '?'; cls = ''; }
    return `<div class="seq-chip ${cls}"><span class="seq-idx">${i+1}</span>${label}</div>`;
  }).join('');
  $('seqCount').textContent = predictSeq.length;
  const pct = Math.min(predictSeq.length / 10 * 100, 100);
  $('seqFill').style.width = pct + '%';
  const status = $('seqStatus');
  if (predictSeq.length >= 5) {
    status.textContent = predictSeq.length >= 10 ? '✓ optimal' : '✓ ready';
    status.className = 'seq-status ready';
  } else {
    status.textContent = `need ${5 - predictSeq.length} more`;
    status.className = 'seq-status';
  }
}

// ---------- AUTO-SAVE ----------
function persistSequence() {
  if (!settings.autoSave) return;
  try {
    localStorage.setItem('rp_seq', JSON.stringify({ seq: predictSeq, mode: predictMode, ts: Date.now() }));
  } catch {}
}
function restoreSequence() {
  try {
    const raw = localStorage.getItem('rp_seq');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > 86400000) {
      localStorage.removeItem('rp_seq'); return;
    }
    predictSeq = data.seq || [];
    if (predictSeq.length > 0) {
      renderSeq();
      toast(`✓ Restored ${predictSeq.length} previous entries`, 'success');
    }
  } catch {}
}

// ---------- DEMO MODE ----------
$('demoBtn').addEventListener('click', () => {
  if (predictSeq.length > 0 && !confirm('Replace current sequence with demo data?')) return;
  const demoNums = [17, 32, 19, 4, 21, 11, 28, 7, 14, 23];
  predictSeq = demoNums.map(n => ({ n, eo: numEO(n), color: numColor(n) }));
  predictMethod = 'numbers';
  $$('.method-tab').forEach(x => x.classList.toggle('active', x.dataset.method === 'numbers'));
  $$('.input-method').forEach(x => x.classList.toggle('active', x.dataset.input === 'numbers'));
  renderSeq();
  persistSequence();
  toast('🎬 Demo loaded — now hit PREDICT', 'success');
});

$('kbHintBtn').addEventListener('click', () => $('helpModal').classList.remove('hidden'));
$$('.inline-help').forEach(b => b.addEventListener('click', () => $('helpModal').classList.remove('hidden')));

// ---------- PREDICT ----------
$('predictBtn').addEventListener('click', async () => {
  if (predictSeq.length < 5) return toast('Need at least 5 entries (10 recommended)', 'error');

  $('loader').classList.remove('hidden');
  await new Promise(r => setTimeout(r, 500));

  const eoArr = predictSeq.map(e => e.eo).filter(Boolean);
  const colArr = predictSeq.map(e => e.color).filter(c => c === 'R' || c === 'B');

  let result;
  try {
    if (predictMode === 'even_odd') {
      if (eoArr.length < 5) {
        $('loader').classList.add('hidden');
        return toast(`Need 5+ Even/Odd entries (have ${eoArr.length})`, 'error');
      }
      result = engine.predict(eoArr, 'even_odd');
    } else if (predictMode === 'color') {
      if (colArr.length < 5) {
        $('loader').classList.add('hidden');
        return toast(`Need 5+ Red/Black entries (have ${colArr.length})`, 'error');
      }
      result = engine.predict(colArr, 'color');
    } else {
      const eo = eoArr.length >= 5 ? engine.predict(eoArr, 'even_odd') : null;
      const col = colArr.length >= 5 ? engine.predict(colArr, 'color') : null;
      if (!eo && !col) {
        $('loader').classList.add('hidden');
        return toast('Need 5+ of either type', 'error');
      }
      result = { eo, col, both: true };
    }
  } catch (e) {
    $('loader').classList.add('hidden');
    return toast('Prediction error: ' + e.message, 'error');
  }

  $('loader').classList.add('hidden');
  beep(900, 100);
  showPrediction(result);
  lastPrediction = { result, seq: [...predictSeq], mode: predictMode, timestamp: Date.now() };

  if (currentUser && currentUser.uid !== 'guest') {
    try {
      const hRef = push(ref(db, `userPredictions/${currentUser.uid}`));
      // Sanitize for Firebase: deep-clean undefined keys
      const sanitized = JSON.parse(JSON.stringify({ ...lastPrediction, status: 'pending' }));
      await set(hRef, sanitized);
      lastPrediction.id = hRef.key;
    } catch (e) { console.warn('Save prediction failed', e); }
  }
});

function showPrediction(result) {
  const card = $('predictionCard');
  card.classList.remove('hidden');

  if (result.both) {
    const r1 = result.eo, r2 = result.col;
    const parts = [];
    if (r1) parts.push(`<div><div class="pred-value">${r1.prediction || '?'}</div><div class="pred-name">${labelOf(r1.prediction)}</div></div>`);
    if (r2) parts.push(`<div style="margin-top:14px"><div class="pred-value" style="font-size:48px">${r2.prediction || '?'}</div><div class="pred-name">${labelOf(r2.prediction)}</div></div>`);
    $('predMain').innerHTML = parts.join('');
    const conf = ((r1?.confidence || 0) + (r2?.confidence || 0)) / (r1 && r2 ? 2 : 1);
    $('predConfidence').textContent = `${Math.round(conf)}%`;
    $('confFill').style.width = conf + '%';
    renderModelBars((r1 || r2).models);
    renderProbs((r1 || r2).probabilities, (r1 || r2).prediction);
    checkConfWarn(conf);
  } else {
    $('predMain').innerHTML = `
      <div class="pred-value">${result.prediction}</div>
      <div class="pred-name">${labelOf(result.prediction)}</div>
    `;
    $('predConfidence').textContent = result.confidence + '%';
    $('confFill').style.width = result.confidence + '%';
    renderModelBars(result.models);
    renderProbs(result.probabilities, result.prediction);
    checkConfWarn(result.confidence);
  }

  const agreement = (result.both ? (result.eo || result.col)?.agreement : result.agreement) || 0;
  $('predMeta').innerHTML = `
    Trained on <b style="color:var(--gold)">${trainingData.length.toLocaleString()}</b> spins ·
    <b style="color:var(--gold)">${predictSeq.length}</b> your inputs ·
    <b style="color:var(--gold)">${agreement}%</b> model agreement<br>
    <span style="opacity:0.7">9 models: Markov · Pattern · Streak · Bayesian · Cyclic · Recency · Bias · Sector · Neural</span>
  `;

  setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
}

function checkConfWarn(conf) {
  if (conf < settings.confThreshold) {
    $('confWarn').classList.remove('hidden');
    $('confWarn').textContent = `⚠ Low confidence (${Math.round(conf)}%) — model isn't sure. Consider adding more data.`;
  } else {
    $('confWarn').classList.add('hidden');
  }
}

function renderModelBars(models) {
  if (!models) { $('modelBars').innerHTML = ''; return; }
  const names = {
    markov: 'Markov Chain', pattern: 'Pattern Match', streak: 'Streak Break',
    bayesian: 'Bayesian', cyclic: 'Cyclic Detect', recency: 'Recency',
    bias: 'Wheel Bias', sector: 'Sector Heat', neural: 'Neural Net'
  };
  $('modelBars').innerHTML = Object.entries(models).map(([key, probs]) => {
    if (!probs || Object.keys(probs).length === 0) return '';
    const winner = Object.keys(probs).reduce((a, b) => probs[a] > probs[b] ? a : b);
    const conf = (probs[winner] * 100).toFixed(1);
    return `
      <div class="model-bar">
        <div class="model-bar-head">
          <span class="model-bar-name">${names[key] || key}</span>
          <span class="model-bar-val">${winner} · ${conf}%</span>
        </div>
        <div class="model-bar-track"><div class="model-bar-fill" style="width:${conf}%"></div></div>
      </div>
    `;
  }).join('');
}

function renderProbs(probs, winner) {
  $('probGrid').innerHTML = Object.entries(probs).map(([k, v]) => `
    <div class="prob-cell ${k === winner ? 'win' : ''}">
      <div class="prob-cell-name">${labelOf(k)}</div>
      <div class="prob-cell-val">${(v * 100).toFixed(1)}%</div>
    </div>
  `).join('');
}

// ---------- FEEDBACK ----------
$('markCorrectBtn').addEventListener('click', () => recordFeedback(true));
$('markWrongBtn').addEventListener('click', () => recordFeedback(false));

async function recordFeedback(correct) {
  if (!lastPrediction) return;
  const status = correct ? 'correct' : 'wrong';
  toast(correct ? '✓ Recorded as correct!' : '✕ Recorded — engine adapting', correct ? 'success' : '');
  beep(correct ? 1200 : 400, 120);

  if (currentUser && currentUser.uid !== 'guest' && lastPrediction.id) {
    try {
      await update(ref(db, `userPredictions/${currentUser.uid}/${lastPrediction.id}`), { status });
      const userRef = ref(db, `users/${currentUser.uid}`);
      const snap = await get(userRef);
      const u = snap.val() || {};
      const total = (u.predictionCount || 0) + 1;
      const correctCount = (u.correctCount || 0) + (correct ? 1 : 0);
      await update(userRef, {
        predictionCount: total,
        correctCount,
        accuracy: correctCount / total * 100,
        lastActive: Date.now()
      });
    } catch (e) { console.warn('Feedback save failed', e); }
  }
  userPredHistory.unshift({ ...lastPrediction, status });
  $('predictionCard').classList.add('hidden');
  predictSeq = [];
  renderSeq();
  persistSequence();
}

async function loadUserHistory() {
  if (!currentUser || currentUser.uid === 'guest') return;
  onValue(ref(db, `userPredictions/${currentUser.uid}`), snap => {
    const data = snap.val() || {};
    userPredHistory = Object.entries(data).map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderHistory();
  });
}

// ---------- LIVE TRACK ----------
function addToLive(entry) {
  const cleaned = clean(entry);
  const v = liveMode === 'even_odd' ? cleaned.eo : cleaned.color;
  if (lastLivePrediction && v && lastLivePrediction.prediction) {
    liveStats.total++;
    if (v === lastLivePrediction.prediction) {
      liveStats.correct++;
      liveStats.streak++;
      liveStats.maxStreak = Math.max(liveStats.streak, liveStats.maxStreak);
      beep(1200, 80);
    } else {
      liveStats.streak = 0;
      beep(400, 80);
    }
  }
  liveSeq.push(cleaned);
  if (liveSeq.length > 200) liveSeq.shift();
  renderLiveSeq();
  updateLivePrediction();
}

$('liveUndoBtn').addEventListener('click', () => {
  liveSeq.pop();
  renderLiveSeq();
  updateLivePrediction();
});

$('liveClearBtn').addEventListener('click', () => {
  if (liveSeq.length > 0 && !confirm('Reset live tracking session?')) return;
  liveSeq = [];
  liveStats = { correct: 0, total: 0, streak: 0, maxStreak: 0 };
  lastLivePrediction = null;
  renderLiveSeq();
  updateLivePrediction();
});

function renderLiveSeq() {
  $('liveSeq').innerHTML = liveSeq.slice(-40).map(e => {
    const label = typeof e.n === 'number' ? e.n : (e.eo || e.color || '?');
    const cls = e.color || (e.eo || '');
    return `<div class="seq-chip compact ${cls}">${label}</div>`;
  }).join('');
}

function updateLivePrediction() {
  const arr = liveMode === 'even_odd'
    ? liveSeq.map(e => e.eo).filter(Boolean)
    : liveSeq.map(e => e.color).filter(c => c === 'R' || c === 'B');

  if (arr.length < 5) {
    $('liveNext').textContent = '—';
    $('liveConf').textContent = `Add ${5 - arr.length} more ${liveMode === 'even_odd' ? 'E/O' : 'R/B'} entries`;
    lastLivePrediction = null;
  } else {
    const result = engine.predict(arr, liveMode);
    $('liveNext').textContent = result.prediction;
    $('liveConf').textContent = `${labelOf(result.prediction)} · ${result.confidence}% confidence · ${result.agreement}% agree`;
    lastLivePrediction = result;
  }
  $('liveAcc').textContent = liveStats.total ? Math.round(liveStats.correct / liveStats.total * 100) + '%' : '—';
  $('liveStreak').textContent = liveStats.maxStreak || '—';
  $('liveTotal').textContent = liveStats.total;
}

// ---------- HISTORY ----------
function renderHistory() {
  const settled = userPredHistory.filter(p => p.status === 'correct' || p.status === 'wrong');
  const correct = settled.filter(p => p.status === 'correct').length;
  const wrong = settled.length - correct;
  const total = userPredHistory.length;
  const acc = settled.length > 0 ? (correct / settled.length * 100).toFixed(1) : 0;

  $('totalPreds').textContent = total;
  $('correctPreds').textContent = correct;
  $('wrongPreds').textContent = wrong;
  $('accValue').textContent = settled.length > 0 ? acc + '%' : '—';

  const ring = $('accRing');
  ring.style.strokeDashoffset = 283 - (acc / 100 * 283);

  const badges = [];
  if (correct >= 1) badges.push({ icon: '🎯', label: 'First win' });
  if (correct >= 10) badges.push({ icon: '🔥', label: '10 wins' });
  if (correct >= 50) badges.push({ icon: '💎', label: '50 wins', gold: true });
  if (acc >= 60 && settled.length >= 10) badges.push({ icon: '🏆', label: 'Sharp', gold: true });
  let maxRun = 0, run = 0;
  userPredHistory.slice().reverse().forEach(p => {
    if (p.status === 'correct') { run++; maxRun = Math.max(maxRun, run); }
    else if (p.status === 'wrong') run = 0;
  });
  if (maxRun >= 5) badges.push({ icon: '⚡', label: `${maxRun} streak` });
  $('badges').innerHTML = badges.map(b => `<span class="badge ${b.gold ? 'gold' : ''}">${b.icon} ${b.label}</span>`).join('');

  if (total === 0) {
    $('historyList').innerHTML = '<div class="empty-hint">No predictions yet. Make your first one!</div>';
    return;
  }

  $('historyList').innerHTML = userPredHistory.slice(0, 50).map(p => {
    const r = p.result || {};
    const pred = r.prediction || (r.eo && r.eo.prediction) || '?';
    const conf = r.confidence || (r.eo && r.eo.confidence) || 0;
    return `
      <div class="history-item ${p.status || 'pending'}">
        <div>
          <div class="history-pred">${labelOf(pred)} · ${conf}%</div>
          <div class="history-meta">${new Date(p.timestamp).toLocaleString()}</div>
        </div>
        <div style="font-size:20px">${p.status === 'correct' ? '✓' : p.status === 'wrong' ? '✕' : '⏳'}</div>
      </div>
    `;
  }).join('');
}

$('exportHistBtn').addEventListener('click', () => {
  if (userPredHistory.length === 0) return toast('No history to export', 'error');
  const rows = ['timestamp,mode,prediction,confidence,status,sequence'];
  userPredHistory.forEach(p => {
    const r = p.result || {};
    const pred = r.prediction || (r.eo && r.eo.prediction) || '';
    const conf = r.confidence || (r.eo && r.eo.confidence) || '';
    const seq = (p.seq || []).map(e => typeof e.n === 'number' ? e.n : (e.eo || e.color || '')).join(' ');
    rows.push([new Date(p.timestamp).toISOString(), p.mode || '', pred, conf, p.status, `"${seq}"`].join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `roulette_history_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  toast('✓ CSV exported', 'success');
});

$('clearHistBtn').addEventListener('click', () => {
  if (!confirm('Clear local prediction history view? (cloud copy is kept)')) return;
  userPredHistory = [];
  renderHistory();
  toast('Local view cleared', 'success');
});

// ---------- INSIGHTS ----------
function renderInsights() {
  const total = trainingData.length;
  $('insTotal').textContent = total.toLocaleString();
  $('insSub').textContent = total > 0 ? 'spins available' : 'Awaiting admin upload';

  if (total === 0) return;

  const eos = trainingData.filter(r => r.even_odd === 'E' || r.even_odd === 'O');
  const evens = eos.filter(r => r.even_odd === 'E').length;
  const cols = trainingData.filter(r => r.color === 'R' || r.color === 'B');
  const reds = cols.filter(r => r.color === 'R').length;

  if (eos.length > 0) {
    $('insEvenBias').textContent = (evens / eos.length * 100).toFixed(1) + '%';
    $('insEvenSub').textContent = `${evens} even / ${eos.length - evens} odd`;
  }
  if (cols.length > 0) {
    $('insRedBias').textContent = (reds / cols.length * 100).toFixed(1) + '%';
    $('insRedSub').textContent = `${reds} red / ${cols.length - reds} black`;
  }

  const patterns = {};
  for (let i = 0; i < eos.length - 3; i++) {
    const k = eos.slice(i, i + 3).map(d => d.even_odd).join('');
    patterns[k] = (patterns[k] || 0) + 1;
  }
  const sorted = Object.entries(patterns).sort((a, b) => b[1] - a[1]);
  if (sorted.length) {
    $('insPattern').textContent = sorted[0][0];
    $('insPatternSub').textContent = `${sorted[0][1]} occurrences`;
  }

  const canvas = $('pulseCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const recent = eos.slice(-100);
    if (recent.length > 0) {
      const cellW = w / recent.length;
      recent.forEach((d, i) => {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        if (d.even_odd === 'E') {
          grad.addColorStop(0, '#3b82f6'); grad.addColorStop(1, '#1e40af');
        } else {
          grad.addColorStop(0, '#f97316'); grad.addColorStop(1, '#c2410c');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(i * cellW, 0, cellW + 0.5, h);
      });
    }
  }

  const trans = { EE: 0, EO: 0, OE: 0, OO: 0 };
  for (let i = 1; i < eos.length; i++) {
    const k = eos[i - 1].even_odd + eos[i].even_odd;
    if (trans[k] !== undefined) trans[k]++;
  }
  const eTotal = trans.EE + trans.EO || 1;
  const oTotal = trans.OE + trans.OO || 1;
  $('transGrid').innerHTML = `
    <div class="trans-cell"><span>E → E</span><b>${(trans.EE / eTotal * 100).toFixed(1)}%</b></div>
    <div class="trans-cell"><span>E → O</span><b>${(trans.EO / eTotal * 100).toFixed(1)}%</b></div>
    <div class="trans-cell"><span>O → E</span><b>${(trans.OE / oTotal * 100).toFixed(1)}%</b></div>
    <div class="trans-cell"><span>O → O</span><b>${(trans.OO / oTotal * 100).toFixed(1)}%</b></div>
  `;
}

// ---------- WELCOME TOUR ----------
let tourStep = 1;
const totalSteps = 4;
$('tourNext').addEventListener('click', () => {
  if (tourStep === totalSteps) {
    $('welcomeTour').classList.add('hidden');
    settings.tourSeen = true;
    saveSetting('tour', 'done');
    return;
  }
  tourStep++;
  $$('.tour-step').forEach(s => s.classList.toggle('active', parseInt(s.dataset.step) === tourStep));
  $$('.tour-dots .dot').forEach((d, i) => d.classList.toggle('active', i + 1 === tourStep));
  $('tourNext').textContent = tourStep === totalSteps ? 'Get started 🚀' : 'Next →';
});
$('tourSkip').addEventListener('click', () => {
  $('welcomeTour').classList.add('hidden');
  settings.tourSeen = true;
  saveSetting('tour', 'done');
});
$('replayTourBtn')?.addEventListener('click', () => {
  $('settingsModal').classList.add('hidden');
  tourStep = 1;
  $$('.tour-step').forEach(s => s.classList.toggle('active', parseInt(s.dataset.step) === 1));
  $$('.tour-dots .dot').forEach((d, i) => d.classList.toggle('active', i === 0));
  $('tourNext').textContent = 'Next →';
  $('welcomeTour').classList.remove('hidden');
});

// ---------- SETTINGS MODAL ----------
$('settingsBtn').addEventListener('click', () => {
  $('confThreshold').value = settings.confThreshold;
  $('confThresholdVal').textContent = settings.confThreshold + '%';
  $('vibToggle').checked = settings.vibration;
  $('soundToggle').checked = settings.sound;
  $('breakToggle').checked = settings.breakReminder;
  $('autoSaveToggle').checked = settings.autoSave;
  $('settingsModal').classList.remove('hidden');
});
$('settingsClose').addEventListener('click', () => $('settingsModal').classList.add('hidden'));
$('settingsModal').addEventListener('click', e => { if (e.target.id === 'settingsModal') $('settingsModal').classList.add('hidden'); });

$('confThreshold').addEventListener('input', e => {
  settings.confThreshold = parseInt(e.target.value);
  $('confThresholdVal').textContent = settings.confThreshold + '%';
  saveSetting('conf', settings.confThreshold);
});
$('vibToggle').addEventListener('change', e => { settings.vibration = e.target.checked; saveSetting('vib', settings.vibration); });
$('soundToggle').addEventListener('change', e => { settings.sound = e.target.checked; saveSetting('sound', settings.sound); });
$('breakToggle').addEventListener('change', e => { settings.breakReminder = e.target.checked; saveSetting('break', settings.breakReminder); restartBreakTimer(); });
$('autoSaveToggle').addEventListener('change', e => {
  settings.autoSave = e.target.checked;
  saveSetting('autosave', settings.autoSave);
  if (!settings.autoSave) localStorage.removeItem('rp_seq');
});

// ---------- HELP MODAL ----------
$('helpBtn').addEventListener('click', () => $('helpModal').classList.remove('hidden'));
$('helpClose').addEventListener('click', () => $('helpModal').classList.add('hidden'));
$('helpModal').addEventListener('click', e => { if (e.target.id === 'helpModal') $('helpModal').classList.add('hidden'); });

// ---------- BREAK TIMER ----------
function startBreakTimer() {
  if (!settings.breakReminder) return;
  clearTimeout(breakTimer);
  breakTimer = setTimeout(() => {
    const minutes = Math.round((Date.now() - sessionStart) / 60000);
    $('breakDur').textContent = minutes;
    $('breakModal').classList.remove('hidden');
  }, 30 * 60 * 1000);
}
function restartBreakTimer() {
  clearTimeout(breakTimer);
  if (settings.breakReminder) startBreakTimer();
}
$('breakClose').addEventListener('click', () => {
  $('breakModal').classList.add('hidden');
  sessionStart = Date.now();
  startBreakTimer();
});

// ---------- KEYBOARD SHORTCUTS ----------
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  if (e.key === 'Escape') {
    $('settingsModal').classList.add('hidden');
    $('helpModal').classList.add('hidden');
    $('breakModal').classList.add('hidden');
    return;
  }
  const onPredict = document.querySelector('[data-panel="predict"]')?.classList.contains('active');
  const onTrack = document.querySelector('[data-panel="track"]')?.classList.contains('active');
  if (!onPredict && !onTrack) return;

  const k = e.key.toUpperCase();
  if (/^[0-9]$/.test(k)) {
    const n = parseInt(k);
    if (n >= 0 && n <= 9) {
      if (onPredict && predictMethod === 'numbers') addToPredict({ n, eo: numEO(n), color: numColor(n) });
      if (onTrack) addToLive({ n, eo: numEO(n), color: numColor(n) });
      vibrate(10);
    }
  }
  if (k === 'E' || k === 'O') {
    if (onPredict && predictMethod === 'manual') addToPredict({ eo: k });
    if (onTrack) addToLive({ eo: k });
  }
  if (k === 'R' || k === 'B') {
    if (onPredict && predictMethod === 'manual') addToPredict({ color: k });
    if (onTrack) addToLive({ color: k });
  }
  if (e.key === 'Backspace') {
    if (onPredict) { predictSeq.pop(); renderSeq(); persistSequence(); }
    if (onTrack)   { liveSeq.pop(); renderLiveSeq(); updateLivePrediction(); }
  }
  if (e.key === 'Enter' && onPredict) $('predictBtn').click();
});

// Prevent pinch-zoom on iOS Safari (extra safety)
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// ---------- INIT ----------
renderSeq();
