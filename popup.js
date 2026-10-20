const $ = id => document.getElementById(id);

function skin(ws) {
  if (!ws) return;
  const r = document.documentElement.style;
  r.setProperty('--accent', ws.accent);
  r.setProperty('--bg1', ws.bg[0]);
  r.setProperty('--bg2', ws.bg[1]);
}