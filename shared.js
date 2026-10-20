/* Burrow shared helpers: settings, weather moods, session tree.
   Loaded as a plain script everywhere (service worker, content script, pages). */
const Burrow = (() => {
  const DEFAULTS = { tint: true, particles: true, chain: true, music: 'off', theme: 'hallownest', volume: 0.4, location: null };

  async function getSettings() {
    const { settings } = await chrome.storage.local.get('settings');
    return { ...DEFAULTS, ...(settings || {}) };
  }
  async function saveSettings(patch) {
    const next = { ...(await getSettings()), ...patch };
    await chrome.storage.local.set({ settings: next });
    return next;
  }

  /* ---------- sites ---------- */
  function hostOf(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.hostname.replace(/^www\./, '');
    } catch { return null; }
  }
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const domainHue = host => hashStr(host) % 360;

  /* ---------- weather ---------- */
  function moodFromCode(c) {
    if (c <= 1) return 'clear';
    if (c <= 3) return 'cloudy';
    if (c === 45 || c === 48) return 'fog';
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
    if (c >= 95) return 'storm';
    return 'cloudy';
  }

  // tint = [r,g,b,alpha] laid over every page.
  const MOODS = {
    clear: { label: 'Clear', tint: [255, 196, 110, 0.07], particles: null, accent: '#f0b34a', bg: ['#1f1a12', '#2e2415'] },
    night: { label: 'Clear night', tint: [30, 45, 120, 0.14], particles: null, accent: '#8da2ff', bg: ['#0a0e1d', '#151c38'] },
    cloudy: { label: 'Cloudy', tint: [140, 152, 168, 0.10], particles: null, accent: '#a3b3c4', bg: ['#14181d', '#212730'] },
    fog: { label: 'Fog', tint: [205, 210, 214, 0.14], particles: null, accent: '#cdd5d8', bg: ['#181b1d', '#272c2f'] },
    rain: { label: 'Rain', tint: [60, 100, 150, 0.12], particles: 'rain', accent: '#5aa9d6', bg: ['#0c151c', '#16242f'] },
    snow: { label: 'Snow', tint: [215, 228, 255, 0.10], particles: 'snow', accent: '#d9e7ff', bg: ['#131a23', '#212c39'] },
    storm: { label: 'Thunderstorm', tint: [55, 42, 100, 0.16], particles: 'rain', accent: '#a98bff', bg: ['#110e1c', '#1e1834'] }
  };
  const NIGHT_LAYER = [10, 20, 60, 0.12];


  function weatherStyle(w) {
    if (!w) return null;
    const night = !w.isDay;
    const key = night && w.mood === 'clear' ? 'night' : (MOODS[w.mood] ? w.mood : 'cloudy');
    const base = MOODS[key];
    const layer = c => `linear-gradient(rgba(${c[0]},${c[1]},${c[2]},${c[3]}),rgba(${c[0]},${c[1]},${c[2]},${c[3]}))`;
    const layers = [layer(base.tint)];
    if (night && key !== 'night') layers.push(layer(NIGHT_LAYER));
    const vignette = 'radial-gradient(ellipse at center,rgba(0,0,0,0) 60%,rgba(0,0,0,0.10) 100%)';
    return { ...base, key, night, tintCss: [vignette, ...layers].join(',') };
  }


   /* ---------- sessions ---------- */
  // A session is { id, start, lastActive, last, nodes:{key:{url,title,host,t,visits,dwell}}, edges:[[from,to]] }.
  // Edges can loop back, so for layout we keep the first parent of each page and treat the rest as extra links.
  function buildTree(session) {
    const keys = Object.keys(session.nodes).sort((a, b) => session.nodes[a].t - session.nodes[b].t);
    const parent = {};
    const hasAncestor = (anc, k) => {
      for (let c = k, n = 0; c !== undefined && n < 20000; c = parent[c], n++) if (c === anc) return true;
      return false;
    };
    for (const [a, b] of session.edges) {
      if (parent[b] === undefined && a !== b && !hasAncestor(b, a)) parent[b] = a;
    }
    const children = {};
    keys.forEach(k => { children[k] = []; });
    keys.forEach(k => { if (parent[k] !== undefined && children[parent[k]]) children[parent[k]].push(k); });
    const roots = keys.filter(k => parent[k] === undefined);
    const depthOf = {};
    let maxDepth = 0;
    const stack = roots.map(r => [r, 0]);
    while (stack.length) {
      const [k, d] = stack.pop();
      depthOf[k] = d;
      if (d > maxDepth) maxDepth = d;
      children[k].forEach(c => stack.push([c, d + 1]));
    }
    return { keys, parent, children, roots, depthOf, maxDepth };
  }


   function fmtDuration(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm';
    return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm';
  }


  
   /* ---------- your own tracks (kept in this extension's own storage, never uploaded) ---------- */
  const openTracksDb = () => new Promise((res, rej) => {
    const r = indexedDB.open('burrow-music', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const asPromise = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const trackStore = async mode => (await openTracksDb()).transaction('tracks', mode).objectStore('tracks');
  const listTracks = async () => asPromise((await trackStore('readonly')).getAll());
  const addTrack = async file => asPromise((await trackStore('readwrite')).add({ name: file.name, blob: file }));
  const removeTrack = async id => asPromise((await trackStore('readwrite')).delete(id));

  return { DEFAULTS, getSettings, saveSettings, hostOf, hashStr, domainHue,
           moodFromCode, weatherStyle, buildTree, fmtDuration,
           listTracks, addTrack, removeTrack };
})();