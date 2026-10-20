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

async function showMusic() {
  const s = await Burrow.getSettings();
  $('themeRow').hidden = s.music !== 'generated';
  const note = $('musicNote');
  if (s.music === 'own') {
    const n = (await Burrow.listTracks().catch(() => [])).length;
    note.textContent = n ? `${n} ${n === 1 ? 'track' : 'tracks'} ready, played in shuffled order.` : 'No tracks yet. Add some below.';
  } else if (s.music === 'generated') note.textContent = 'Made on the fly, and each site nudges the key.';
  else note.textContent = 'Music is off.';
}

function say(text) { $('msg').textContent = text; }


async function setCity() {
  const city = $('city').value.trim();
  if (!city) return say('Type a city first.');
  say('Looking it up...');
  const res = await chrome.runtime.sendMessage({ type: 'setCity', city });
  if (res && res.ok) { say(`Weather set for ${res.name}.`); $('city').value = res.name; showWeather(); }
  else say((res && res.error) || 'Could not set that city.');
}

function useGeo() {
  say('Asking the browser for your location...');
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const res = await chrome.runtime.sendMessage({ type: 'setCoords', lat: pos.coords.latitude, lon: pos.coords.longitude });
      say(res && res.ok ? 'Location set.' : (res && res.error) || 'Could not fetch the weather.');
      showWeather();
    },
    () => say('Location was blocked. Type your city instead.'),
    { timeout: 10000 }
  );
}

(async function init() {
  const s = await Burrow.getSettings();
  for (const id of ['tint', 'particles', 'chain']) {
    $(id).checked = s[id];
    $(id).addEventListener('change', async () => { await Burrow.saveSettings({ [id]: $(id).checked }); });
  }
  if (s.location) $('city').value = s.location.name;

  $('music').value = s.music; $('theme').value = s.theme; $('volume').value = s.volume;
  $('music').addEventListener('change', async () => { await Burrow.saveSettings({ music: $('music').value }); showMusic(); });
  $('theme').addEventListener('change', () => Burrow.saveSettings({ theme: $('theme').value }));
  $('volume').addEventListener('input', () => Burrow.saveSettings({ volume: +$('volume').value }));
  $('tracks').addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('music.html') }); window.close(); });

  $('set').addEventListener('click', setCity);
  $('city').addEventListener('keydown', e => { if (e.key === 'Enter') setCity(); });
  $('geo').addEventListener('click', useGeo);
  $('open').addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('map.html') }); window.close(); });

  showWeather(); showStats(); showMusic();
})();