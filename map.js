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