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