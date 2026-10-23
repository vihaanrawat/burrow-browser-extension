const COLW = 300, ROWH = 52;
const NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const svg = $('svg'), world = $('world'), tip = $('tip');

let sessions = [], selected = null, needsFit = true;
let view = { x: 60, y: 0, k: 1 };
let lastPos = {}, lastKey = null;

// Page titles come from the web, so every string goes in through textContent, never innerHTML.
function el(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const applyView = () => world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);

/* ---------- layout: depth runs left to right, siblings stack vertically ---------- */
function layout(tree) {
    const pos = {};
    let row = 0;
    const place = k => {
        const ch = tree.children[k];
        const x = tree.depthOf[k] * COLW;
        if (!ch.length) { pos[k] = { x, y: row++ * ROWH }; return; }
        ch.forEach(place);
        pos[k] = { x, y: (pos[ch[0]].y + pos[ch[ch.length - 1]].y) / 2 };
    };
    tree.roots.forEach(r => { place(r); row += 0.6; });
    return pos;
}

/* ---------- render ---------- */
function render() {
    const s = sessions.find(x => x.id === selected);
    world.replaceChildren();
    const hasNodes = !!(s && Object.keys(s.nodes).length);
    $('empty').hidden = hasNodes;
    if (!hasNodes) { renderStats(null); return; }

    const tree = Burrow.buildTree(s);
    const pos = layout(tree);
    lastPos = pos; lastKey = s.last;
    renderStats(s, tree);

    const edges = el('g'), nodes = el('g');
    const treeLinks = new Set(Object.keys(tree.parent).map(k => tree.parent[k] + '\n' + k));
    for (const [a, b, kind] of s.edges) {
        const p = pos[a], q = pos[b];
        if (!p || !q) continue;
        const dx = q.x > p.x ? (q.x - p.x) / 2 : 90;
        edges.append(el('path', {
            d: `M${p.x} ${p.y} C${p.x + dx} ${p.y},${q.x - dx} ${q.y},${q.x} ${q.y}`,
            class: kind === 'c' ? 'edge chain' : treeLinks.has(a + '\n' + b) ? 'edge' : 'edge extra',
            stroke: `hsl(${Burrow.domainHue(s.nodes[a].host)} 60% 62%)`
        }));
    }

    for (const k of tree.keys) {
        const n = s.nodes[k], p = pos[k];
        const color = `hsl(${Burrow.domainHue(n.host)} 70% 62%)`;
        const r = Math.min(22, 6 + Math.sqrt(n.dwell / 1000) * 0.7);
        const g = el('g', { class: 'node', transform: `translate(${p.x} ${p.y})` });
        if (k === s.last) g.append(el('circle', { r: r + 7, class: 'pulse', stroke: color }));
        if (tree.parent[k] === undefined) g.append(el('circle', { r: r + 4, class: 'root-ring' }));
        g.append(el('circle', { r, fill: color, class: 'dot' }));
        g.append(el('circle', { r: r + 8, fill: 'transparent' }));
        g.append(el('text', { x: r + 10, y: -2, class: 'host' }, n.host));
        g.append(el('text', { x: r + 10, y: 12, class: 'title-text' }, clip(n.title || n.url.replace(/^https?:\/\//, ''), 34)));
        g.addEventListener('mouseenter', e => showTip(e, n));
        g.addEventListener('mousemove', moveTip);
        g.addEventListener('mouseleave', () => { tip.hidden = true; });
        g.addEventListener('click', () => chrome.tabs.create({ url: n.url }));
        nodes.append(g);
    }
    world.append(edges, nodes);

    if (needsFit) { fit(); needsFit = false; } else applyView();
}


function renderStats(s, tree) {
    const list = $('stats'), story = $('story');
    list.replaceChildren();
    if (!s) { story.textContent = 'Your next rabbit hole will be drawn here.'; return; }
    const nodes = Object.values(s.nodes);
    const hosts = new Set(nodes.map(n => n.host));
    const time = nodes.reduce((a, n) => a + n.dwell, 0);
    const add = (num, label) => {
        const li = document.createElement('li');
        const b = document.createElement('b');
        b.textContent = num;
        li.append(b, label);
        list.append(li);
    };

    add(nodes.length, 'pages');
    add(tree.maxDepth, tree.maxDepth === 1 ? 'link deep' : 'links deep');
    add(hosts.size, 'sites');
    add(Burrow.fmtDuration(time), 'spent');

    const first = s.nodes[tree.roots[0]], last = s.nodes[s.last];
    story.replaceChildren();
    const strong = t => {
        const b = document.createElement('strong');
        b.textContent = t;
        return b;
    };
    if (tree.maxDepth === 0) story.append('So far you have only visited ', strong(first.host), '. Follow a link to start the trail.');
    else story.append('It began at ', strong(first.host), ' and went ', strong(String(tree.maxDepth)), tree.maxDepth === 1 ? ' link deep across ' : ' links deep across ', strong(String(hosts.size)),
        hosts.size === 1 ? ' site' : ' sites', last ? ', and the latest stop is ' : '.', last ? strong(last.host) : '', last ? '.' : '');
}

/* ---------- view: fit, zoom, pan ---------- */
function fit() {
    const bb = world.getBBox();
    if (!bb.width) return;
    const w = svg.clientWidth, h = svg.clientHeight;
    const natural = Math.min((w - 120) / bb.width, (h - 120) / bb.height);
    const k = Math.max(0.45, Math.min(1.1, natural));
    if (natural >= 0.45) {
        view = { k, x: (w - bb.width * k) / 2 - bb.x * k, y: (h - bb.height * k) / 2 - bb.y * k };
    } else {
        const p = lastPos[lastKey] || { x: 0, y: 0 };
        view = { k, x: w * 0.65 - p.x * k, y: h / 2 - p.y * k };
    }
    applyView();
}

svg.addEventListener('wheel', e => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.min(3, Math.max(0.15, view.k * Math.exp(-e.deltaY * 0.0015)));
    view.x = mx - (mx - view.x) * (k / view.k);
    view.y = my - (my - view.y) * (k / view.k);
    view.k = k;
    applyView();
}, { passive: false });

let drag = null;
svg.addEventListener('pointerdown', e => {
    if (e.target.closest('.node')) return;
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('dragging');
});
svg.addEventListener('pointermove', e => {
    if (!drag) return;
    view.x = drag.vx + e.clientX - drag.x;
    view.y = drag.vy + e.clientY - drag.y;
    applyView();
});
const endDrag = () => { drag = null; svg.classList.remove('dragging'); };
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);


/* ---------- tooltip ---------- */
function showTip(e, n) {
    tip.replaceChildren();
    const b = document.createElement('b'); b.textContent = n.title || n.host;
    const u = document.createElement('span'); u.textContent = clip(n.url, 80);
    const f = document.createElement('span'); f.className = 'facts';
    f.textContent = `Visited ${n.visits} ${n.visits === 1 ? 'time' : 'times'}, ${Burrow.fmtDuration(n.dwell)} here`;
    tip.append(b, u, f);
    tip.hidden = false;
    moveTip(e);
}
function moveTip(e) {
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(e.clientX + 16, innerWidth - w - 8) + 'px';
    tip.style.top = Math.min(e.clientY + 16, innerHeight - h - 8) + 'px';
}


