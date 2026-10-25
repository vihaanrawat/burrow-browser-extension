const $ = id => document.getElementById(id);
async function skin() {
    const { weather } = await chrome.storage.local.get('weather');
    const ws = Burrow.weatherStyle(weather);
    if (!ws) return;
    const r = document.documentElement.style;
    r.setProperty('--accent', ws.accent); r.setProperty('--bg1', ws.bg[0]); r.setProperty('--bg2', ws.bg[1]);
}

const tell = () => chrome.runtime.sendMessage({ type: 'tracks-changed' }).catch(() => { });

async function render() {
    const tracks = await Burrow.listTracks();
    const list = $('list');
    list.replaceChildren();
    $('empty').hidden = tracks.length > 0;
    for (const t of tracks) {
        const li = document.createElement('li');
        const name = document.createElement('span'); name.className = 'name'; name.textContent = t.name; name.title = t.name;
        const size = document.createElement('span'); size.className = 'size'; size.textContent = (t.blob.size / 1048576).toFixed(1) + ' MB';
        const del = document.createElement('button'); del.textContent = 'Remove';
        del.addEventListener('click', async () => { await Burrow.removeTrack(t.id); await render(); tell(); });
        li.append(name, size, del);
        list.append(li);
    }
}