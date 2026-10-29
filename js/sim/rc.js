// Simulateur interactif d'un circuit RC (solution analytique exacte, pas d'intégration numérique).
// Source : échelon ou créneau 0 → V ; composants pris dans la série E12, comme sur une vraie nomenclature.

import { Plot } from '../engine/plot.js';
import { eng, fmt, fixed } from '../engine/format.js';

const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];

function e12(minExp, maxExp, tail) {
  const out = [];
  for (let e = minExp; e <= maxExp; e++) for (const m of E12) out.push(Number((m * Math.pow(10, e)).toPrecision(3)));
  return out.concat(tail || []);
}

const R_VALUES = e12(1, 5, [1e6]); // 10 Ω … 1 MΩ
const C_VALUES = e12(-10, -4, [1e-3]); // 100 pF … 1 mF
const V_VALUES = [1, 1.8, 2.5, 3.3, 5, 9, 12, 24];
const F_VALUES = [];
for (let e = 0; e <= 5; e++) for (const m of [1, 2, 5]) F_VALUES.push(m * Math.pow(10, e)); // 1 Hz … 500 kHz

function nearest(list, v) {
  let best = 0;
  list.forEach((x, i) => {
    if (Math.abs(Math.log(x / v)) < Math.abs(Math.log(list[best] / v))) best = i;
  });
  return best;
}

function timeUnit(tEnd) {
  if (tEnd >= 1) return ['s', 1];
  if (tEnd >= 1e-3) return ['ms', 1e3];
  if (tEnd >= 1e-6) return ['µs', 1e6];
  return ['ns', 1e9];
}

function currentUnit(imax) {
  if (imax >= 1) return ['A', 1];
  if (imax >= 1e-3) return ['mA', 1e3];
  if (imax >= 1e-6) return ['µA', 1e6];
  return ['nA', 1e9];
}

// Calcule les courbes pour un état donné.
export function compute(st) {
  const tau = st.R * st.C;
  const V = st.V;
  const t = [], vc = [], i = [];
  const vsT = [], vsV = [];
  let tEnd;
  if (st.mode === 'step') {
    tEnd = 6 * tau;
    const N = 240;
    for (let k = 0; k <= N; k++) {
      const tk = (tEnd * k) / N;
      const v = V * (1 - Math.exp(-tk / tau));
      t.push(tk);
      vc.push(v);
      i.push((V - v) / st.R);
    }
    vsT.push(0, tEnd);
    vsV.push(V, V);
  } else {
    const T = 1 / st.f;
    const h = T / 2;
    const periods = 3;
    tEnd = periods * T;
    const N = 70;
    let v0 = 0;
    for (let k = 0; k < periods * 2; k++) {
      const high = k % 2 === 0;
      const target = high ? V : 0;
      const tk = k * h;
      vsT.push(tk);
      vsV.push(target);
      for (let j = 0; j <= N; j++) {
        if (k > 0 && j === 0) continue; // point déjà donné par la demi-période précédente
        const u = j / N;
        const dt = h * Math.pow(u, 3);
        const v = target + (v0 - target) * Math.exp(-dt / tau);
        t.push(tk + dt);
        vc.push(v);
        i.push((target - v) / st.R);
      }
      v0 = target + (v0 - target) * Math.exp(-h / tau);
    }
    vsT.push(tEnd);
    vsV.push(vsV[vsV.length - 1]);
  }
  return { tau, t, vc, i, vsT, vsV, tEnd };
}

function slider(label, id, list, idx, format) {
  return `<label class="sim-row" for="${id}"><span class="sim-label">${label}</span>
    <input type="range" id="${id}" min="0" max="${list.length - 1}" step="1" value="${idx}">
    <output for="${id}" class="sim-value">${format(list[idx])}</output></label>`;
}

export function mountRC(el, opts = {}) {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st = {
    mode: opts.mode === 'step' ? 'step' : 'square',
    R: R_VALUES[nearest(R_VALUES, Number(opts.R) || 1000)],
    C: C_VALUES[nearest(C_VALUES, Number(opts.C) || 1e-6)],
    V: V_VALUES[nearest(V_VALUES, Number(opts.V) || 5)],
    f: F_VALUES[nearest(F_VALUES, Number(opts.f) || 100)],
    showI: false,
    playing: !reduced,
  };

  const uid = `rc${Math.random().toString(36).slice(2, 7)}`;
  el.classList.add('sim');
  el.innerHTML = `
    <div class="sim-controls">
      <div class="sim-seg" role="group" aria-label="Forme de la source">
        <button type="button" data-mode="square" aria-pressed="${st.mode === 'square'}">Créneau</button>
        <button type="button" data-mode="step" aria-pressed="${st.mode === 'step'}">Échelon</button>
      </div>
      ${slider('R', `${uid}-r`, R_VALUES, nearest(R_VALUES, st.R), (v) => eng(v, 'Ω'))}
      ${slider('C', `${uid}-c`, C_VALUES, nearest(C_VALUES, st.C), (v) => eng(v, 'F'))}
      ${slider('V', `${uid}-v`, V_VALUES, nearest(V_VALUES, st.V), (v) => eng(v, 'V', 2))}
      <div class="sim-freq">${slider('f', `${uid}-f`, F_VALUES, nearest(F_VALUES, st.f), (v) => eng(v, 'Hz', 2))}</div>
      <div class="sim-actions">
        <label class="sim-check"><input type="checkbox" id="${uid}-i"> courant <i>i</i>(<i>t</i>)</label>
        <button type="button" class="sim-play" aria-pressed="${st.playing}">${st.playing ? 'Pause' : 'Animer'}</button>
      </div>
    </div>
    <div class="sim-plots">
      <div class="sim-plot-v"></div>
      <div class="sim-plot-i" hidden></div>
    </div>
    <dl class="sim-readout"></dl>`;

  const q = (s) => el.querySelector(s);
  const readout = q('.sim-readout');
  const plotV = new Plot(q('.sim-plot-v'), { xlabel: 'Temps t (ms)', ylabel: 'Tension (V)', ghost: true, height: 290, ymin: 0 });
  const plotI = new Plot(q('.sim-plot-i'), { xlabel: 'Temps t (ms)', ylabel: 'Courant (mA)', ghost: true, height: 190, legend: false });
  let model = null;
  let tScale = 1;

  function refresh() {
    model = compute(st);
    const [tu, tf] = timeUnit(model.tEnd);
    tScale = tf;
    const imax = Math.max(...model.i.map(Math.abs), 1e-15);
    const [iu, itf] = currentUnit(imax);
    const X = (a) => a.map((v) => v * tf);

    const vlines = [];
    const hlines = [];
    if (st.mode === 'step') {
      [1, 3, 5].forEach((k) => vlines.push({ x: k * model.tau * tf, label: k === 1 ? 'τ' : `${k}τ` }));
      hlines.push({ y: 0.632 * st.V, label: '63,2 % de V' });
    }
    plotV.update({
      xlabel: `Temps t (${tu})`,
      ymax: st.V * 1.12,
      series: [
        { name: 'Source', x: X(model.vsT), y: model.vsV, style: 'step', dash: '5 4', color: 'var(--plot-3)', width: 1.4 },
        { name: 'Condensateur', x: X(model.t), y: model.vc, color: 'var(--plot-1)' },
      ],
      vlines,
      hlines,
    });
    plotI.update({
      xlabel: `Temps t (${tu})`,
      ylabel: `Courant (${iu})`,
      series: [{ name: 'Courant', x: X(model.t), y: model.i.map((v) => v * itf), color: 'var(--plot-2)' }],
    });
    updateReadout();
    el.dataset.tau = String(model.tau);
  }

  function updateReadout() {
    const tau = model.tau;
    const rows = [
      ['Constante de temps τ = RC', eng(tau, 's')],
      ['Fréquence de coupure f<sub>c</sub> = 1/(2πτ)', eng(1 / (2 * Math.PI * tau), 'Hz')],
      ['Temps de montée 10–90 % ≈ 2,2 τ', eng(Math.log(9) * tau, 's')],
      ['Charge finale Q = CV', eng(st.C * st.V, 'C')],
      ['Énergie stockée ½CV²', eng(0.5 * st.C * st.V * st.V, 'J')],
    ];
    if (st.mode === 'square') {
      const h = 1 / st.f / 2;
      const ratio = h / tau;
      const first = 1 - Math.exp(-h / tau);
      let regime;
      if (ratio >= 5) regime = 'charge complète à chaque alternance';
      else if (ratio >= 0.5) regime = 'charge partielle, arrondi visible';
      else regime = 'régime intégrateur (ondulation faible)';
      rows.push(['Demi-période / τ', fmt(ratio, 3)]);
      rows.push(['v<sub>C</sub> après la 1<sup>re</sup> demi-période', `${fixed(first * 100, first > 0.999 ? 2 : 1)} % de V`]);
      rows.push(['Régime', regime]);
    }
    readout.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }

  // Entrées
  const bind = (suffix, list, key, fmtFn) => {
    const input = q(`#${uid}-${suffix}`);
    const out = input.parentElement.querySelector('output');
    input.addEventListener('input', () => {
      st[key] = list[Number(input.value)];
      out.textContent = fmtFn(st[key]);
      refresh();
    });
  };
  bind('r', R_VALUES, 'R', (v) => eng(v, 'Ω'));
  bind('c', C_VALUES, 'C', (v) => eng(v, 'F'));
  bind('v', V_VALUES, 'V', (v) => eng(v, 'V', 2));
  bind('f', F_VALUES, 'f', (v) => eng(v, 'Hz', 2));

  const freqRow = q('.sim-freq');
  const setMode = (m) => {
    st.mode = m;
    el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    freqRow.hidden = m === 'step';
    refresh();
  };
  el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  freqRow.hidden = st.mode === 'step';

  q(`#${uid}-i`).addEventListener('change', (e) => {
    st.showI = e.target.checked;
    q('.sim-plot-i').hidden = !st.showI;
    if (st.showI) plotI.render();
  });

  const playBtn = q('.sim-play');
  let t0 = performance.now();
  let raf = 0;
  let visible = true;

  function frame(now) {
    raf = 0;
    if (!st.playing) return;
    if (visible && model) {
      const loop = 5000;
      const p = ((now - t0) % loop) / loop;
      const x = p * model.tEnd * tScale;
      plotV.reveal(x);
      if (st.showI) plotI.reveal(x);
    }
    raf = requestAnimationFrame(frame);
  }

  function setPlaying(on) {
    st.playing = on;
    playBtn.textContent = on ? 'Pause' : 'Animer';
    playBtn.setAttribute('aria-pressed', String(on));
    if (on) {
      t0 = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    } else {
      plotV.reveal(null);
      plotI.reveal(null);
    }
  }
  playBtn.addEventListener('click', () => setPlaying(!st.playing));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
    }).observe(el);
  }

  refresh();
  if (st.playing) setPlaying(true);
  return { st, refresh, plotV, plotI };
}
