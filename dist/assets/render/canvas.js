export class CanvasView {
    constructor(canvas) {
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: canvas
        });
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        const c = canvas.getContext('2d', { alpha: false });
        if (!c)
            throw Error('Canvas unavailable');
        this.ctx = c;
    }
    resize(w, h) { const d = Math.min(devicePixelRatio || 1, 1.25); this.canvas.width = w * d; this.canvas.height = h * d; this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px'; this.ctx.setTransform(d, 0, 0, d, 0, 0); }
    render(world, t) { const c = this.ctx, w = world.w, h = world.h; c.fillStyle = '#03101f'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(110,230,255,.10)'; for (let y = 20; y < h; y += 18) {
        c.beginPath();
        for (let x = 0; x < w; x += 24)
            c.lineTo(x, y + Math.sin(x * .03 + t * .002 + y) * 3);
        c.stroke();
    } c.lineCap = 'round'; for (const g of world.glass) {
        c.strokeStyle = 'rgba(220,250,255,.45)';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(g.x1, g.y1);
        c.lineTo(g.x2, g.y2);
        c.stroke();
    } for (const e of world.waves) {
        c.strokeStyle = `rgba(90,235,255,${(1 - e.age / e.life) * .8})`;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(e.originX, e.originY, e.radius, 0, 7);
        c.stroke();
    } for (const b of world.beacons) {
        const rg = c.createRadialGradient(b.x, b.y, 2, b.x, b.y, b.radius * 3);
        rg.addColorStop(0, '#ffffe0');
        rg.addColorStop(1, 'rgba(80,230,255,0)');
        c.fillStyle = rg;
        c.beginPath();
        c.arc(b.x, b.y, b.radius * 3, 0, 7);
        c.fill();
        c.fillStyle = '#eaffff';
        c.beginPath();
        c.arc(b.x, b.y, b.radius, 0, 7);
        c.fill();
    } for (const p of world.particles) {
        c.fillStyle = `rgba(190,250,255,${1 - p.age / p.life})`;
        c.fillRect(p.x, p.y, 2, 2);
    } }
}
