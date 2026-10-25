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

$('files').addEventListener('change', async e => {
    const files = [...e.target.files].filter(f => f.type.startsWith('audio/') || /\.(mp3|ogg|wav|flac|m4a|aac|opus)$/i.test(f.name));
    let added = 0;
    for (const f of files) {
        try { await Burrow.addTrack(f); added++; $('status').textContent = `Added ${added} of ${files.length}...`; }
        catch { $('status').textContent = `Could not store ${f.name}. The browser may be out of space.`; }
    }
    e.target.value = '';
    if (added) $('status').textContent = `Added ${added} ${added === 1 ? 'track' : 'tracks'}. Pick "My own tracks" in the Burrow popup to play them.`;
    else if (!files.length) $('status').textContent = 'Those do not look like audio files.';
    await render(); tell();
});

skin(); render();