const $ = id => document.getElementById(id);
async function skin() {
    const { weather } = await chrome.storage.local.get('weather');
    const ws = Burrow.weatherStyle(weather);
    if (!ws) return;
    const r = document.documentElement.style;
    r.setProperty('--accent', ws.accent); r.setProperty('--bg1', ws.bg[0]); r.setProperty('--bg2', ws.bg[1]);
}

const tell = () => chrome.runtime.sendMessage({ type: 'tracks-changed' }).catch(() => { });

