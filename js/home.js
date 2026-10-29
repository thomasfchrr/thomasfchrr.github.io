import { loadManifest } from './site.js';
import { startScope } from './hero.js';
import { STATUS, formatDate, escapeHtml as e } from './engine/format.js';

const canvas = document.getElementById('scope');
if (canvas) startScope(canvas, document.getElementById('scope-tau'));

const list = document.getElementById('project-list');
const filters = document.getElementById('filters');

function row(p, i) {
  const href = `project.html?p=${encodeURIComponent(p.slug)}`;
  const meta = [p.kind, p.domain, p.date ? formatDate(p.date) : ''].filter(Boolean).map(e).join('<br>');
  const label = STATUS[p.status] || '';
  return `<li data-domain="${e(p.domain || '')}">
    <a class="row" href="${href}">
      <span class="row-no">${String(i + 1).padStart(2, '0')}</span>
      <span class="row-main">
        <span class="row-title">${e(p.title)}${p.subtitle ? `<span class="row-sub">${e(p.subtitle)}</span>` : ''}</span>
        ${p.summary ? `<span class="row-sum">${e(p.summary)}</span>` : ''}
      </span>
      <span class="row-meta">${meta}</span>
      <span class="row-status">${label ? `<span class="status status-${e(p.status)}"><span class="status-label">${label}</span></span>` : ''}</span>
    </a></li>`;
}

function show(projects, domain) {
  const items = projects.map((p, i) => ({ p, i })).filter(({ p }) => !domain || p.domain === domain);
  list.innerHTML = items.length ? items.map(({ p, i }) => row(p, i)).join('') : '<li class="empty">Aucun projet dans cette catégorie.</li>';
}

async function main() {
  let projects;
  try {
    projects = await loadManifest();
  } catch (err) {
    list.innerHTML = '<li class="empty">La liste des projets est momentanément indisponible.</li>';
    console.error(err);
    return;
  }
  const domains = [...new Set(projects.map((p) => p.domain).filter(Boolean))];
  show(projects, '');
  if (domains.length > 1) {
    filters.innerHTML = ['', ...domains]
      .map((d) => `<button type="button" data-d="${e(d)}" aria-pressed="${d === ''}">${d ? e(d) : 'Tous'}</button>`)
      .join('');
    filters.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      filters.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      show(projects, b.dataset.d);
    });
  } else {
    filters.hidden = true;
  }
}

main();
