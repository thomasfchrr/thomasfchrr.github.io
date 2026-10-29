// Tracé de courbes scientifiques en SVG : axes linéaires ou logarithmiques,
// grille fine, légende, repères, lecture des valeurs au survol et « révélation »
// progressive (utilisée par le simulateur). Aucune dépendance.

import { fmt } from './format.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

function s(name, attrs, parent) {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

export function niceTicks(min, max, target = 6) {
  const span = max - min || 1;
  const raw = span / Math.max(2, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks = [];
  const start = Math.ceil(min / step - 1e-9) * step;
  for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(+v.toPrecision(12));
  return { ticks, step };
}

export function logTicks(min, max) {
  const major = [];
  const minor = [];
  const e0 = Math.floor(Math.log10(min));
  const e1 = Math.ceil(Math.log10(max));
  for (let e = e0; e <= e1; e++) {
    for (let m = 1; m < 10; m++) {
      const v = m * Math.pow(10, e);
      if (v < min * (1 - 1e-9) || v > max * (1 + 1e-9)) continue;
      (m === 1 ? major : minor).push(v);
    }
  }
  return { major, minor };
}

function tickLabel(v, step) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return fmt(v, 2);
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return fmt(Number(v.toFixed(Math.min(dec, 8))), Math.max(1, Math.floor(Math.log10(a)) + 1 + dec));
}

function logLabel(v) {
  const e = Math.round(Math.log10(v));
  if (Math.abs(e) <= 3) return fmt(v, 1);
  return `10${String(e).split('').map((c) => ({ '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }[c])).join('')}`;
}

export class Plot {
  constructor(container, spec = {}) {
    this.container = container;
    this.id = ++uid;
    this.spec = { logx: false, logy: false, xlabel: '', ylabel: '', legend: true, ghost: false, series: [], vlines: [], hlines: [], ...spec };
    this.revealX = null;
    this.m = null;
    container.classList.add('plot');
    this.svg = s('svg', { role: 'img', 'aria-label': this.spec.label || this.spec.ylabel || 'Graphique' });
    this.tip = document.createElement('div');
    this.tip.className = 'plot-tip';
    this.tip.hidden = true;
    container.append(this.svg, this.tip);
    this.svg.addEventListener('pointermove', (e) => this.onMove(e));
    this.svg.addEventListener('pointerleave', () => this.onLeave());
    this.svg.addEventListener('pointerdown', (e) => this.onMove(e));
    this._raf = 0;
    this.ro = new ResizeObserver(() => {
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => this.render());
    });
    this.ro.observe(container);
    this.render();
  }

  update(partial = {}) {
    Object.assign(this.spec, partial);
    this.render();
  }

  destroy() {
    this.ro.disconnect();
  }

  named() {
    return this.spec.series.filter((x) => x.name).length;
  }

  render() {
    const sp = this.spec;
    const W = Math.round(this.container.clientWidth);
    if (W < 120) return;
    const H = sp.height || Math.round(Math.min(420, Math.max(260, W * 0.56)));
    const m = {
      l: sp.ylabel ? 66 : 50,
      r: 18,
      t: sp.legend && this.named() ? 32 : 16,
      b: sp.xlabel ? 50 : 32,
    };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    this.W = W;
    this.H = H;

    // Données compactées (valeurs finies, et strictement positives en échelle log).
    for (const se of sp.series) {
      const xs = [];
      const ys = [];
      for (let i = 0; i < se.x.length; i++) {
        const x = se.x[i];
        const y = se.y[i];
        if (!isFinite(x) || !isFinite(y)) continue;
        if (sp.logx && x <= 0) continue;
        if (sp.logy && y <= 0) continue;
        xs.push(x);
        ys.push(y);
      }
      se._x = xs;
      se._y = ys;
    }

    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const se of sp.series) {
      for (let i = 0; i < se._x.length; i++) {
        const x = se._x[i], y = se._y[i];
        if (x < xmin) xmin = x;
        if (x > xmax) xmax = x;
        if (y < ymin) ymin = y;
        if (y > ymax) ymax = y;
      }
    }
    if (!isFinite(xmin)) { xmin = 0; xmax = 1; ymin = 0; ymax = 1; }
    if (sp.xmin != null) xmin = sp.xmin;
    if (sp.xmax != null) xmax = sp.xmax;
    if (!(xmax > xmin)) xmax = xmin + 1;

    let yt;
    if (sp.logy) {
      if (sp.ymin != null) ymin = sp.ymin; else ymin = Math.pow(10, Math.floor(Math.log10(ymin)));
      if (sp.ymax != null) ymax = sp.ymax; else ymax = Math.pow(10, Math.ceil(Math.log10(ymax)));
      if (!(ymax > ymin)) ymax = ymin * 10;
    } else {
      if (sp.ymin == null || sp.ymax == null) {
        const pad = (ymax - ymin) * 0.06 || 1;
        if (sp.ymin == null) { ymin = ymin >= 0 && ymin - pad < 0 ? 0 : ymin - pad; }
        if (sp.ymax == null) { ymax = ymax <= 0 && ymax + pad > 0 ? 0 : ymax + pad; }
      }
      if (sp.ymin != null) ymin = sp.ymin;
      if (sp.ymax != null) ymax = sp.ymax;
      if (!(ymax > ymin)) ymax = ymin + 1;
      yt = niceTicks(ymin, ymax, ph / 48);
      if (sp.ymin == null) ymin = Math.min(ymin, yt.ticks[0] ?? ymin);
      if (sp.ymax == null) ymax = Math.max(ymax, yt.ticks[yt.ticks.length - 1] ?? ymax);
      yt = niceTicks(ymin, ymax, ph / 48);
    }

    const lx = (v) => Math.log10(v);
    const sx = sp.logx
      ? (v) => m.l + ((lx(v) - lx(xmin)) / (lx(xmax) - lx(xmin))) * pw
      : (v) => m.l + ((v - xmin) / (xmax - xmin)) * pw;
    const sy = sp.logy
      ? (v) => m.t + ph - ((Math.log10(v) - Math.log10(ymin)) / (Math.log10(ymax) - Math.log10(ymin))) * ph
      : (v) => m.t + ph - ((v - ymin) / (ymax - ymin)) * ph;
    const invX = sp.logx
      ? (px) => Math.pow(10, lx(xmin) + ((px - m.l) / pw) * (lx(xmax) - lx(xmin)))
      : (px) => xmin + ((px - m.l) / pw) * (xmax - xmin);
    this.m = { ...m, pw, ph, xmin, xmax, ymin, ymax, sx, sy, invX };

    const svg = this.svg;
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);

    const defs = s('defs', {}, svg);
    const clip = s('clipPath', { id: `pc${this.id}` }, defs);
    s('rect', { x: m.l, y: m.t - 2, width: pw, height: ph + 4 }, clip);
    const clipR = s('clipPath', { id: `rv${this.id}` }, defs);
    this.revealRect = s('rect', { x: m.l, y: m.t - 2, width: pw, height: ph + 4 }, clipR);

    // Grille et graduations
    const g = s('g', { class: 'grid' }, svg);
    const ticksG = s('g', { class: 'ticks' }, svg);
    let xticks;
    let xstep = 1;
    if (sp.logx) {
      const lt = logTicks(xmin, xmax);
      xticks = lt.major;
      lt.minor.forEach((v) => s('line', { x1: sx(v), x2: sx(v), y1: m.t, y2: m.t + ph, class: 'minor' }, g));
    } else {
      const t = niceTicks(xmin, xmax, pw / 90);
      xticks = t.ticks;
      xstep = t.step;
    }
    xticks.forEach((v) => {
      const x = sx(v);
      s('line', { x1: x, x2: x, y1: m.t, y2: m.t + ph }, g);
      s('line', { x1: x, x2: x, y1: m.t + ph, y2: m.t + ph + 4, class: 'tk' }, ticksG);
      const t = s('text', { x, y: m.t + ph + 17, 'text-anchor': 'middle' }, ticksG);
      t.textContent = sp.logx ? logLabel(v) : tickLabel(v, xstep);
    });
    let yticks;
    let ystep = 1;
    if (sp.logy) {
      const lt = logTicks(ymin, ymax);
      yticks = lt.major;
      lt.minor.forEach((v) => s('line', { x1: m.l, x2: m.l + pw, y1: sy(v), y2: sy(v), class: 'minor' }, g));
    } else {
      yticks = yt.ticks;
      ystep = yt.step;
    }
    yticks.forEach((v) => {
      const y = sy(v);
      s('line', { x1: m.l, x2: m.l + pw, y1: y, y2: y }, g);
      s('line', { x1: m.l - 4, x2: m.l, y1: y, y2: y, class: 'tk' }, ticksG);
      const t = s('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end' }, ticksG);
      t.textContent = sp.logy ? logLabel(v) : tickLabel(v, ystep);
    });
    s('rect', { x: m.l, y: m.t, width: pw, height: ph, class: 'frame' }, svg);

    // Titres d'axes
    if (sp.xlabel) {
      const t = s('text', { x: m.l + pw / 2, y: H - 8, 'text-anchor': 'middle', class: 'axlabel' }, svg);
      t.textContent = sp.xlabel;
    }
    if (sp.ylabel) {
      const t = s('text', { transform: `translate(14 ${m.t + ph / 2}) rotate(-90)`, 'text-anchor': 'middle', class: 'axlabel' }, svg);
      t.textContent = sp.ylabel;
    }

    // Repères (lignes verticales / horizontales annotées)
    const ann = s('g', { class: 'annot', 'clip-path': `url(#pc${this.id})` }, svg);
    for (const v of sp.vlines || []) {
      const x = sx(v.x);
      if (x < m.l || x > m.l + pw) continue;
      s('line', { x1: x, x2: x, y1: m.t, y2: m.t + ph }, ann);
      if (v.label) {
        const t = s('text', { x: x + 4, y: m.t + 12 }, ann);
        t.textContent = v.label;
      }
    }
    for (const h of sp.hlines || []) {
      const y = sy(h.y);
      if (y < m.t || y > m.t + ph) continue;
      s('line', { x1: m.l, x2: m.l + pw, y1: y, y2: y }, ann);
      if (h.label) {
        const t = s('text', { x: m.l + pw - 4, y: y - 5, 'text-anchor': 'end' }, ann);
        t.textContent = h.label;
      }
    }

    // Séries
    const data = s('g', { 'clip-path': `url(#pc${this.id})` }, svg);
    sp.series.forEach((se, k) => {
      const color = se.color || `var(--plot-${(k % 6) + 1})`;
      const style = se.style || 'line';
      const draw = (parent, cls) => {
        if (style === 'points' || style === 'linepoints') {
          const pts = s('g', { class: `pts ${cls}`, fill: color }, parent);
          const stride = Math.max(1, Math.ceil(se._x.length / 600));
          for (let i = 0; i < se._x.length; i += stride) s('circle', { cx: sx(se._x[i]).toFixed(1), cy: sy(se._y[i]).toFixed(1), r: 3 }, pts);
        }
        if (style !== 'points') {
          let d = '';
          for (let i = 0; i < se._x.length; i++) {
            const px = sx(se._x[i]).toFixed(1);
            const py = sy(se._y[i]).toFixed(1);
            if (style === 'step' && i > 0) d += `L${px} ${sy(se._y[i - 1]).toFixed(1)}`;
            d += `${i ? 'L' : 'M'}${px} ${py}`;
          }
          const p = s('path', { d, class: `line ${cls}`, stroke: color }, parent);
          if (se.dash) p.setAttribute('stroke-dasharray', se.dash);
          if (se.width) p.setAttribute('stroke-width', se.width);
        }
      };
      if (sp.ghost) draw(data, 'ghost');
      const holder = sp.ghost ? s('g', { 'clip-path': `url(#rv${this.id})` }, data) : data;
      draw(holder, 'main');
    });

    // Curseur de révélation
    this.cursor = s('line', { class: 'cursor', y1: m.t, y2: m.t + ph, x1: -10, x2: -10 }, svg);
    this.applyReveal();

    // Légende
    if (sp.legend && this.named()) {
      let lx0 = m.l;
      sp.series.forEach((se, k) => {
        if (!se.name) return;
        const color = se.color || `var(--plot-${(k % 6) + 1})`;
        const gg = s('g', { class: 'legend', transform: `translate(${lx0} ${12})` }, svg);
        s('line', { x1: 0, x2: 18, y1: 0, y2: 0, stroke: color, 'stroke-dasharray': se.dash || '', 'stroke-width': 2 }, gg);
        if (se.style === 'points' || se.style === 'linepoints') s('circle', { cx: 9, cy: 0, r: 3, fill: color }, gg);
        const t = s('text', { x: 24, y: 4 }, gg);
        t.textContent = se.name;
        lx0 += 24 + se.name.length * 6.8 + 18;
      });
    }

    // Surcouche de lecture au survol
    this.hover = s('g', { class: 'hover', visibility: 'hidden' }, svg);
    this.hvLine = s('line', { y1: m.t, y2: m.t + ph }, this.hover);
    this.hvDots = sp.series.map((se, k) => s('circle', { r: 4, fill: se.color || `var(--plot-${(k % 6) + 1})`, class: 'dot' }, this.hover));
  }

  // Dévoile les courbes jusqu'à l'abscisse x (null = tout).
  reveal(x) {
    this.revealX = x;
    this.applyReveal();
  }

  applyReveal() {
    if (!this.m || !this.revealRect) return;
    const { sx, l, pw } = this.m;
    if (this.revealX == null) {
      this.revealRect.setAttribute('width', pw);
      this.cursor.setAttribute('x1', -10);
      this.cursor.setAttribute('x2', -10);
    } else {
      const x = Math.max(l, Math.min(l + pw, sx(this.revealX)));
      this.revealRect.setAttribute('width', Math.max(0, x - l));
      this.cursor.setAttribute('x1', x);
      this.cursor.setAttribute('x2', x);
    }
  }

  onMove(e) {
    if (!this.m) return;
    const rect = this.svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const { l, pw, t, ph, invX, sx, sy } = this.m;
    if (px < l || px > l + pw) return this.onLeave();
    const xv = invX(px);
    const rows = [];
    let xs = null;
    this.spec.series.forEach((se, k) => {
      const n = se._x.length;
      if (!n) return;
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (se._x[mid] < xv) lo = mid; else hi = mid;
      }
      const i = Math.abs(se._x[lo] - xv) <= Math.abs(se._x[hi] - xv) ? lo : hi;
      if (xs === null) xs = se._x[i];
      const dot = this.hvDots[k];
      dot.setAttribute('cx', sx(se._x[i]));
      dot.setAttribute('cy', sy(se._y[i]));
      dot.style.display = '';
      rows.push({ name: se.name || `série ${k + 1}`, y: se._y[i], color: se.color || `var(--plot-${(k % 6) + 1})` });
    });
    if (xs === null) return;
    const hx = sx(xs);
    this.hvLine.setAttribute('x1', hx);
    this.hvLine.setAttribute('x2', hx);
    this.hover.setAttribute('visibility', 'visible');
    const xname = (this.spec.xlabel || 'x').replace(/\s*\(.*$/, '');
    const xunit = (/\(([^)]*)\)/.exec(this.spec.xlabel || '') || [])[1] || '';
    const yunit = (/\(([^)]*)\)/.exec(this.spec.ylabel || '') || [])[1] || '';
    this.tip.innerHTML =
      `<div class="plot-tip-x">${xname} = ${fmt(xs, 4)}${xunit ? ' ' + xunit : ''}</div>` +
      rows
        .map((r) => `<div><span class="sw" style="background:${r.color}"></span>${r.name}<b>${fmt(r.y, 4)}${yunit ? ' ' + yunit : ''}</b></div>`)
        .join('');
    this.tip.hidden = false;
    const cw = this.container.clientWidth;
    const tw = this.tip.offsetWidth;
    let left = hx + 14;
    if (left + tw > cw - 4) left = hx - tw - 14;
    this.tip.style.left = `${Math.max(4, left)}px`;
    this.tip.style.top = `${t + 8}px`;
  }

  onLeave() {
    if (this.hover) this.hover.setAttribute('visibility', 'hidden');
    this.tip.hidden = true;
  }
}
