// Bandeau d'accueil : un « oscilloscope » qui montre la réponse d'un circuit RC à un créneau.
// La constante de temps varie lentement : on voit l'arrondi des fronts changer.
// Solution analytique en régime périodique établi (pas de simulation temporelle).

import { fixed } from './engine/format.js';

export function startScope(canvas, readout) {
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DIV_X = 10;
  const DIV_Y = 6;
  const HALF = 2.6; // demi-période, en divisions
  let w = 0, h = 0, dpr = 1, colors = {}, visible = true, raf = 0;
  const t0 = performance.now();

  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function readColors() {
    colors = { grid: css('--rule-soft'), axis: css('--rule'), src: css('--faint'), cap: css('--plot-1'), text: css('--faint'), fg: css('--fg') };
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }

  // Tension aux bornes du condensateur à la phase p (en divisions), régime établi.
  function vc(p, tau) {
    const a = Math.exp(-HALF / tau);
    const vmin = a / (1 + a);
    const vmax = 1 / (1 + a);
    const ph = ((p % (2 * HALF)) + 2 * HALF) % (2 * HALF);
    return ph < HALF ? 1 + (vmin - 1) * Math.exp(-ph / tau) : vmax * Math.exp(-(ph - HALF) / tau);
  }

  function draw(now) {
    if (!w) return;
    const t = reduced ? 0 : (now - t0) / 1000;
    const tau = reduced ? 0.6 : 0.78 + 0.5 * Math.sin((2 * Math.PI * t) / 22);
    const offset = reduced ? 0.4 : t * 0.55;
    ctx.clearRect(0, 0, w, h);
    const dx = w / DIV_X;
    const dy = h / DIV_Y;
    // Graticule
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.grid;
    ctx.beginPath();
    for (let i = 1; i < DIV_X; i++) { ctx.moveTo(Math.round(i * dx) + 0.5, 0); ctx.lineTo(Math.round(i * dx) + 0.5, h); }
    for (let j = 1; j < DIV_Y; j++) { ctx.moveTo(0, Math.round(j * dy) + 0.5); ctx.lineTo(w, Math.round(j * dy) + 0.5); }
    ctx.stroke();
    ctx.strokeStyle = colors.axis;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(h / 2) + 0.5); ctx.lineTo(w, Math.round(h / 2) + 0.5);
    ctx.moveTo(Math.round(w / 2) + 0.5, 0); ctx.lineTo(Math.round(w / 2) + 0.5, h);
    ctx.stroke();
    // Traces : échelle verticale 1 V = 3,4 divisions, zéro à 1,1 division du bas
    const y0 = h - dy * 1.1;
    const yv = (v) => y0 - v * dy * 3.6;
    const span = DIV_X;
    const N = Math.max(120, Math.round(w / 2));
    // Source (créneau)
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = colors.src;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    let prev = null;
    for (let k = 0; k <= N; k++) {
      const p = (k / N) * span + offset;
      const high = ((p % (2 * HALF)) + 2 * HALF) % (2 * HALF) < HALF;
      const v = high ? 1 : 0;
      const x = (k / N) * w;
      if (prev === null) ctx.moveTo(x, yv(v));
      else { if (v !== prev) ctx.lineTo(x, yv(prev)); ctx.lineTo(x, yv(v)); }
      prev = v;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Condensateur
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = colors.cap;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let k = 0; k <= N; k++) {
      const p = (k / N) * span + offset;
      const x = (k / N) * w;
      const y = yv(vc(p, tau));
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Légende de l'écran
    ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillStyle = colors.src;
    ctx.fillText('CH1  source', 12, 18);
    ctx.fillStyle = colors.cap;
    ctx.fillText('CH2  condensateur', 12, 34);
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'right';
    ctx.fillText(`1 ms/div`, w - 12, 18);
    ctx.textAlign = 'left';
    if (readout) readout.textContent = `τ = RC = ${fixed(tau, 2)} ms`;
  }

  function loop(now) {
    raf = 0;
    if (visible && !document.hidden) draw(now);
    raf = requestAnimationFrame(loop);
  }

  readColors();
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('themechange', () => { readColors(); draw(performance.now()); });
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { readColors(); draw(performance.now()); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); }).observe(canvas);
  }
  resize();
  if (!reduced) raf = requestAnimationFrame(loop);
}
