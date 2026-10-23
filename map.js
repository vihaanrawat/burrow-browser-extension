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

