/* Lays a faint weather tint (and optional rain or snow) over every page. Never blocks clicks. */
(() => {
    if (window.top !== window || document.contentType !== 'text/html') return;

    const layer = document.createElement('div');
    layer.id = 'burrow-weather-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;opacity:0;transition:opacity 1.5s ease;';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    layer.appendChild(canvas);
    document.documentElement.appendChild(layer);

    const g = canvas.getContext('2d');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mode = null, raf = 0, drops = [];

    function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }

    function spawn() {
        const snow = mode === 'snow';
        drops = Array.from({ length: snow ? 70 : 110 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            v: snow ? 0.4 + Math.random() * 0.9 : 9 + Math.random() * 7,
            s: snow ? 1 + Math.random() * 2.2 : 8 + Math.random() * 10,
            p: Math.random() * 6.28
        }));
    }

    function frame(t) {
        g.clearRect(0, 0, canvas.width, canvas.height);
        if (mode === 'rain') {
            g.strokeStyle = 'rgba(190,215,255,0.35)';
            g.lineWidth = 1;
            g.beginPath();
            for (const d of drops) {
                g.moveTo(d.x, d.y);
                g.lineTo(d.x - d.s * 0.25, d.y + d.s);
                d.y += d.v; d.x -= d.v * 0.25;
                if (d.y > canvas.height) { d.y = -d.s; d.x = Math.random() * (canvas.width + 100); }
                if (d.x < -20) d.x = canvas.width + 20;
            }
            g.stroke();
        } else {
            g.fillStyle = 'rgba(255,255,255,0.75)';
            for (const d of drops) {
                g.beginPath();
                g.arc(d.x, d.y, d.s, 0, 6.283);
                g.fill();
                d.y += d.v; d.x += Math.sin(t / 1500 + d.p) * 0.5;
                if (d.y > canvas.height + 5) { d.y = -5; d.x = Math.random() * canvas.width; }
            }
        }
        raf = requestAnimationFrame(frame);
    }

    function setMode(next) {
        if (next === mode) return;
        cancelAnimationFrame(raf);
        mode = next;
        g.clearRect(0, 0, canvas.width, canvas.height);
        if (!mode) return;
        resize(); spawn();
        raf = requestAnimationFrame(frame);
    }

    async function apply() {
        const [s, { weather }] = await Promise.all([Burrow.getSettings(), chrome.storage.local.get('weather')]);
        const ws = Burrow.weatherStyle(weather);
        if (!ws) { layer.style.opacity = '0'; setMode(null); return; }
        layer.style.background = s.tint ? ws.tintCss : 'none';
        layer.style.opacity = '1';
        setMode(s.particles && ws.particles && !reduceMotion ? ws.particles : null);
    }

    apply().catch(() => { });
    chrome.storage.onChanged.addListener((c, area) => {
        if (area === 'local' && (c.settings || c.weather)) apply().catch(() => { });
    });
    addEventListener('resize', () => { if (mode) { resize(); spawn(); } });
})();