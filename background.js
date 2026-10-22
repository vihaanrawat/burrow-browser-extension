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