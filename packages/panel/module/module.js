/**
 * A feature module's own page: its controls, its overlays and its guide.
 *
 * Entirely generic. Everything on this page comes from /api/modules, so a new
 * module gets a working page the moment it's dropped in, and removing one takes
 * its page with it. Nothing here names a module.
 */
import { mountNav } from '/nav.js';

const moduleId = new URLSearchParams(location.search).get('id') || '';
const titleEl = document.getElementById('title');
const subEl = document.getElementById('sub');
const toastEl = document.getElementById('toast');

let toastTimer;

const body = await fetch('/api/modules').then((r) => r.json()).catch(() => ({}));
const module = (body.modules || []).find((m) => m.id === moduleId);
const overlays = (body.overlays || []).filter((o) => o.module === moduleId);
const cards = (body.cards || []).filter((c) => c.module === moduleId);

await mountNav(document.getElementById('nav'), { section: moduleId, page: 'home' });

if (!module) {
  titleEl.textContent = 'Feature not found';
  subEl.textContent = moduleId
    ? `There is no feature called "${moduleId}" running. It may have been removed.`
    : 'No feature was named.';
} else {
  document.title = module.label;
  titleEl.textContent = module.label;
  subEl.textContent = module.description || '';
  await loadCards();
  listOverlays();
  await loadGuide();
}

/** A module ships its own panel markup and behaviour; this page just hosts it. */
async function loadCards() {
  const host = document.getElementById('moduleCards');
  for (const card of cards) {
    try {
      const html = await (await fetch(card.src)).text();
      const holder = document.createElement('div');
      holder.innerHTML = html;
      host.append(...holder.children);
      const script = card.src.replace(/\.html$/, '.js');
      const head = await fetch(script, { method: 'HEAD' }).catch(() => null);
      if (head?.ok) await import(script);
    } catch (err) {
      console.warn(`module card ${card.module} failed:`, err);
    }
  }
}

function listOverlays() {
  const host = document.getElementById('overlayList');
  if (!overlays.length) {
    host.innerHTML = '<p class="sub">This feature has no overlays.</p>';
    return;
  }
  for (const overlay of overlays) {
    const url = `${location.origin}${overlay.path}`;
    const row = document.createElement('div');
    row.className = 'row urlbar';

    const label = document.createElement('span');
    label.className = 'pill';
    label.textContent = overlay.label;

    const input = document.createElement('input');
    input.className = 'grow';
    input.type = 'text';
    input.readOnly = true;
    input.value = url;

    const size = document.createElement('span');
    size.className = 'sub';
    size.textContent = overlay.obsSize ? `${overlay.obsSize.width} × ${overlay.obsSize.height}` : '';

    const copy = document.createElement('button');
    copy.className = 'primary';
    copy.textContent = 'Copy link';
    copy.addEventListener('click', () => copyText(url, `${overlay.label} link copied`));

    row.append(label, input, size, copy);
    if (overlay.settings) {
      const style = document.createElement('a');
      style.className = 'btn';
      style.href = `/settings/?overlay=${overlay.module}.${overlay.id}`;
      style.textContent = 'Change the look';
      row.append(style);
    }
    host.append(row);
  }
}

/** The guide is markdown next to the module; shown here so it's never hunted for. */
async function loadGuide() {
  try {
    const res = await fetch(`/guide/${encodeURIComponent(moduleId)}.md`);
    if (!res.ok) return;
    const text = await res.text();
    document.getElementById('guide').innerHTML = renderMarkdown(text);
    document.getElementById('guideCard').hidden = false;
  } catch {
    // No guide is fine.
  }
}

/**
 * Just enough markdown for a guide: headings, tables, bold, code, links, lists.
 * A parser dependency for one page would be a maintenance cost for nothing.
 */
function renderMarkdown(src) {
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2">$2</a>');

  const out = [];
  const lines = src.split('\n');
  let list = null;
  let table = null;

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closeTable = () => { if (table) { out.push('</tbody></table>'); table = null; } };

  for (const line of lines) {
    const row = /^\|(.+)\|\s*$/.exec(line);
    if (row) {
      const cells = row[1].split('|').map((c) => c.trim());
      if (cells.every((c) => /^-+:?$|^:?-+$/.test(c.replace(/\s/g, '')))) continue;
      if (!table) {
        closeList();
        out.push(`<table><thead><tr>${cells.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>`);
        table = true;
        continue;
      }
      out.push(`<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`);
      continue;
    }
    closeTable();

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(4, heading[1].length + 1);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    if (!line.trim()) { closeList(); continue; }
    if (list) { out.push(`<li>${inline(line)}</li>`); continue; }
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  closeTable();
  return out.join('\n');
}

function copyText(text, message) {
  navigator.clipboard?.writeText(text).then(() => toast(message)).catch(() => toast('Copy failed — select the text instead'));
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
}
