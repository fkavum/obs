/**
 * The panel's navigation, in two levels.
 *
 * The toolkit grew more tabs than one row can carry, so the top row picks a
 * SECTION and the second row shows only that section's pages. Sections are
 * discovered, never listed: the streaming tools are the built-in overlays, and
 * every feature module becomes a section of its own. Adding a module therefore
 * adds a section with no edit here — the same rule that keeps a module
 * drop-in removable.
 */
import { OVERLAYS } from '/core/settings-schema.js';

export const STREAM_SECTION = 'stream';

/**
 * @returns {Promise<Array<{id, label, href, pages: Array<{id, label, href}>}>>}
 */
export async function loadSections() {
  const stream = {
    id: STREAM_SECTION,
    label: 'Streaming tools',
    href: '/',
    pages: [
      { id: 'setup', label: 'Setup', href: '/' },
      ...Object.values(OVERLAYS).map((o) => ({
        id: o.id, label: `${o.label} style`, href: `/settings/?overlay=${o.id}`,
      })),
      { id: 'commands', label: 'Chat commands', href: '/commands/' },
    ],
  };

  const sections = [stream];
  let modules = [];
  let overlays = [];
  try {
    const body = await (await fetch('/api/modules')).json();
    modules = body.modules || [];
    overlays = body.overlays || [];
  } catch {
    // No bridge, or no modules: the streaming tools still work on their own.
    return sections;
  }

  for (const m of modules) {
    const own = overlays.filter((o) => o.module === m.id && o.settings);
    sections.push({
      id: m.id,
      label: m.label,
      href: `/module/?id=${encodeURIComponent(m.id)}`,
      pages: [
        { id: 'home', label: 'Overview', href: `/module/?id=${encodeURIComponent(m.id)}` },
        ...own.map((o) => ({
          id: `${m.id}.${o.id}`,
          label: `${o.label} style`,
          href: `/settings/?overlay=${m.id}.${o.id}`,
        })),
      ],
    });
  }
  return sections;
}

/**
 * Draw both rows into `host`.
 *
 * @param {HTMLElement} host
 * @param {{sections: Array, section: string, page?: string}} state
 */
export function renderNav(host, { sections, section, page }) {
  host.replaceChildren();
  const current = sections.find((s) => s.id === section) || sections[0];

  // The top row only appears once there is somewhere else to go.
  if (sections.length > 1) {
    const top = document.createElement('nav');
    top.className = 'tabs sections';
    for (const s of sections) {
      const a = document.createElement('a');
      a.href = s.href;
      a.textContent = s.label;
      if (s.id === current.id) a.setAttribute('aria-current', 'page');
      top.append(a);
    }
    host.append(top);
  }

  const row = document.createElement('nav');
  row.className = 'tabs';
  for (const p of current.pages) {
    const a = document.createElement('a');
    a.href = p.href;
    a.textContent = p.label;
    if (p.id === page) a.setAttribute('aria-current', 'page');
    row.append(a);
  }
  host.append(row);
}

/** Which section does an overlay id belong to? `<module>.<overlay>` -> `<module>`. */
export function sectionOf(overlayId) {
  const dot = String(overlayId).indexOf('.');
  return dot === -1 ? STREAM_SECTION : String(overlayId).slice(0, dot);
}

/** Load and draw in one call, for pages that have nothing else to decide. */
export async function mountNav(host, { section, page }) {
  const sections = await loadSections();
  renderNav(host, { sections, section, page });
  return sections;
}
