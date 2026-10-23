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
