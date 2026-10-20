const $ = id => document.getElementById(id);

function skin(ws) {
  if (!ws) return;
  const r = document.documentElement.style;
  r.setProperty('--accent', ws.accent);
  r.setProperty('--bg1', ws.bg[0]);
  r.setProperty('--bg2', ws.bg[1]);
}

async function showWeather() {
  const { weather } = await chrome.storage.local.get('weather');
  const ws = Burrow.weatherStyle(weather);
  skin(ws);
  $('wx').textContent = ws ? `${ws.label}, ${weather.temp}°C in ${weather.city}` : 'Set your city to wake the weather.';
}

async function showStats() {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  const s = sessions[sessions.length - 1];
  if (!s || !Object.keys(s.nodes).length) { $('stats').textContent = 'Nothing mapped yet. Click a few links.'; return; }
  const tree = Burrow.buildTree(s);
  const time = Object.values(s.nodes).reduce((a, n) => a + n.dwell, 0);
  $('stats').textContent =
    `This hole: ${tree.keys.length} pages, ${tree.maxDepth} links deep, ${Burrow.fmtDuration(time)} spent.`;
}
