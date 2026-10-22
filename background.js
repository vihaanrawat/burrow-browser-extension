importScripts('shared.js');

const SESSION_GAP = 30 * 60 * 1000;   // a pause this long starts a new rabbit hole
const MAX_SESSIONS = 40;
const MAX_DWELL = 5 * 60 * 1000;      // never credit more than this per interval (sleep, lunch...)
const FRESH_START = new Set(['typed', 'generated', 'auto_bookmark', 'start_page', 'keyword', 'keyword_generated']);


/* Events arrive in parallel but our state lives in storage, so run everything one at a time. */
let queue = Promise.resolve();
const enqueue = fn => { queue = queue.then(() => fn()).catch(e => console.error('[burrow]', e)); return queue; };


const load = async () => {
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    const { tabs = {}, active = null } = await chrome.storage.session.get(['tabs', 'active']);
    return { sessions, tabs, active };
};
const save = st => Promise.all([
    chrome.storage.local.set({ sessions: st.sessions }),
    chrome.storage.session.set({ tabs: st.tabs, active: st.active })
]);

function pageKey(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        u.hash = '';
        return u.href;
    } catch { return null; }
}

/* ---------- rabbit hole tracking ---------- */
function recordNav(st, tabId, url, transition, qualifiers, now, chain) {
    const key = pageKey(url);
    if (!key) { delete st.tabs[tabId]; return; }          // chrome://, new tab page, etc.
    const prev = st.tabs[tabId];
    if (prev && prev.key === key) return;                  // reload or duplicate SPA event

    let session = st.sessions[st.sessions.length - 1];
    if (!session || now - session.lastActive > SESSION_GAP) {
        session = { id: now, start: now, lastActive: now, last: null, nodes: {}, edges: [] };
        st.sessions.push(session);
        if (st.sessions.length > MAX_SESSIONS) st.sessions.shift();
    }

    const goingBack = qualifiers.includes('forward_back');
    const fresh = FRESH_START.has(transition);
    let parent = !fresh && !goingBack && prev && prev.sid === session.id ? prev.key : null;
    let kind = 'l';                                        // l = a link you clicked, c = the next page you opened
    if (!parent && chain && !goingBack && session.last && session.last !== key) { parent = session.last; kind = 'c'; }



    let node = session.nodes[key];
    if (!node) node = session.nodes[key] = { url: key, title: '', host: Burrow.hostOf(key), t: now, visits: 0, dwell: 0 };
    node.visits++;
    if (parent && parent !== key && !session.edges.some(e => e[0] === parent && e[1] === key)) {
        session.edges.push([parent, key, kind]);
    }

    session.last = key;
    session.lastActive = now;
    st.tabs[tabId] = { key, sid: session.id };
}

function onNav(d) {
    if (d.frameId !== 0) return;
    enqueue(async () => {
        const st = await load();
        const { chain } = await Burrow.getSettings();
        recordNav(st, d.tabId, d.url, d.transitionType, d.transitionQualifiers || [], Date.now(), chain);
        await save(st);
        await reconcile();
    });
}

chrome.webNavigation.onCommitted.addListener(onNav);
chrome.webNavigation.onHistoryStateUpdated.addListener(onNav);


// A tab opened from a link inherits its opener's place in the hole.
chrome.tabs.onCreated.addListener(tab => {
    if (tab.openerTabId == null) return;
    enqueue(async () => {
        const st = await load();
        const o = st.tabs[tab.openerTabId];
        if (o) { st.tabs[tab.id] = { ...o }; await save(st); }
    });
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.title || info.status === 'complete') {
        enqueue(async () => {
            const st = await load();
            const t = st.tabs[tabId];
            if (!t || !tab.title || pageKey(tab.url) !== t.key) return;
            const s = st.sessions.find(x => x.id === t.sid);
            const n = s && s.nodes[t.key];
            if (n && n.title !== tab.title) { n.title = tab.title; await save(st); }
        });
    }
});

chrome.tabs.onUpdated.addListener((_id, info) => { if (info.audible !== undefined) enqueue(() => reconcile()); });
chrome.tabs.onRemoved.addListener(tabId => enqueue(async () => {
    const st = await load();
    delete st.tabs[tabId];
    await save(st);
    await reconcile();
}));
chrome.tabs.onActivated.addListener(() => enqueue(() => reconcile()));
chrome.windows.onFocusChanged.addListener(() => enqueue(() => reconcile()));


/* Works out which page you're looking at right now, credits time to the previous one,
   . */
async function reconcile(tick = false) {
    const st = await load();
    const now = Date.now();
    const w = await chrome.windows.getLastFocused({ populate: true }).catch(() => null);
    const tab = w && w.focused ? w.tabs.find(t => t.active) : null;
    const entry = tab && st.tabs[tab.id];
    const want = entry ? { tabId: tab.id, key: entry.key, sid: entry.sid } : null;
    const cur = st.active;
    const same = cur && want && cur.tabId === want.tabId && cur.key === want.key && cur.sid === want.sid;

    const credit = () => {
        const s = st.sessions.find(x => x.id === cur.sid);
        const n = s && s.nodes[cur.key];
        if (n) { n.dwell += Math.min(now - cur.since, MAX_DWELL); s.lastActive = now; }
    };

    if (same && tick) {
        credit(); cur.since = now; await save(st);
    } else if (!same) {
        if (cur) credit();
        st.active = want ? { ...want, since: now } : null;
        await save(st);
    }
    await pushMusic(tab);
}


/* ---------- music ---------- */
// Music is global: it plays while Burrow is switched on, and steps aside whenever any tab is making sound.
async function pushMusic(tab) {
    const s = await Burrow.getSettings();
    const { weather } = await chrome.storage.local.get('weather');
    const audible = (await chrome.tabs.query({ audible: true })).length > 0;
    const playing = s.music !== 'off' && !audible;
    const has = (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length > 0;

    if (!has) {
        if (!playing) return;
        await chrome.offscreen.createDocument({
            url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: 'Background music while browsing'
        });
        return; // it announces itself with "offscreen-ready" and we push again
    }
    chrome.runtime.sendMessage({
        target: 'offscreen', type: 'music', playing, mode: s.music, theme: s.theme, volume: s.volume,
        host: tab ? Burrow.hostOf(tab.url) : null, mood: weather ? weather.mood : null
    }).catch(() => { });
}

/* ---------- weather ---------- */
async function geocode(city) {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const j = await r.json();
    const g = j.results && j.results[0];
    if (!g) throw new Error('No city found with that name. Try adding the country.');
    return { name: [g.name, g.country_code].filter(Boolean).join(', '), lat: g.latitude, lon: g.longitude };
}

async function fetchWeather() {
    const { location } = await Burrow.getSettings();
    if (!location) return null;
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,weather_code,is_day&timezone=auto`);
    if (!r.ok) throw new Error('Weather service unavailable');
    const c = (await r.json()).current;
    const w = { code: c.weather_code, temp: Math.round(c.temperature_2m), isDay: c.is_day, mood: Burrow.moodFromCode(c.weather_code), city: location.name, updated: Date.now() };
    await chrome.storage.local.set({ weather: w });
    return w;
}

