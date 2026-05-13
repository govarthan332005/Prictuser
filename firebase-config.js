// Firebase Configuration & Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getDatabase, ref, set, get, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDAisnBAmG3qGyjA_lkzSDrWccNxyr2jMc",
    authDomain: "slice-investment.firebaseapp.com",
    databaseURL: "https://slice-investment-default-rtdb.firebaseio.com",
    projectId: "slice-investment",
    storageBucket: "slice-investment.firebasestorage.app",
    messagingSenderId: "263752083276",
    appId: "1:263752083276:web:03b4f22872ccec55c3d1e9",
    measurementId: "G-4J9033N8WS"
};

// Initialize
const app = initializeApp(firebaseConfig);
let analytics = null;
try { analytics = getAnalytics(app); } catch (e) { console.log('Analytics unavailable'); }

const db = getDatabase(app);
const auth = getAuth(app);

// State
window.FB = {
    app, db, auth, analytics,
    user: null,
    ready: false
};

// Anonymous sign-in to enable per-device persistence in Firebase
signInAnonymously(auth).catch(err => {
    console.warn('Anonymous auth failed (offline mode):', err.message);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.FB.user = user;
        window.FB.ready = true;
        document.dispatchEvent(new CustomEvent('firebase-ready', { detail: { uid: user.uid } }));
    } else {
        document.dispatchEvent(new CustomEvent('firebase-offline'));
    }
});

// Helpers
window.FB.savePrediction = async function(data) {
    if (!window.FB.user) return;
    try {
        const refPath = ref(db, `users/${window.FB.user.uid}/predictions`);
        await push(refPath, { ...data, timestamp: Date.now() });
    } catch(e) { console.warn('save fail', e); }
};

window.FB.saveTraining = async function(records) {
    if (!window.FB.user) return;
    try {
        const refPath = ref(db, `users/${window.FB.user.uid}/training`);
        await set(refPath, { records, updatedAt: Date.now() });
    } catch(e) { console.warn('train save fail', e); }
};

window.FB.loadTraining = async function() {
    if (!window.FB.user) return [];
    try {
        const snapshot = await get(ref(db, `users/${window.FB.user.uid}/training`));
        if (snapshot.exists()) return snapshot.val().records || [];
    } catch(e) { console.warn('train load fail', e); }
    return [];
};

window.FB.loadPredictions = async function() {
    if (!window.FB.user) return [];
    try {
        const snapshot = await get(ref(db, `users/${window.FB.user.uid}/predictions`));
        if (snapshot.exists()) {
            return Object.entries(snapshot.val()).map(([k,v]) => ({id: k, ...v}));
        }
    } catch(e) { console.warn('pred load fail', e); }
    return [];
};

window.FB.saveStats = async function(stats) {
    if (!window.FB.user) return;
    try {
        await set(ref(db, `users/${window.FB.user.uid}/stats`), stats);
    } catch(e) { console.warn('stats save fail', e); }
};

window.FB.loadStats = async function() {
    if (!window.FB.user) return null;
    try {
        const snapshot = await get(ref(db, `users/${window.FB.user.uid}/stats`));
        if (snapshot.exists()) return snapshot.val();
    } catch(e) { console.warn('stats load fail', e); }
    return null;
};

window.FB.clearAll = async function() {
    if (!window.FB.user) return;
    try {
        await remove(ref(db, `users/${window.FB.user.uid}/predictions`));
    } catch(e) {}
};
