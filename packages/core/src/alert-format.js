/**
 * Turns a normalized event into what an alert shows. Pure - no DOM - so the
 * wording, filters and placeholders are testable, and the same code could feed
 * a different alert overlay later.
 */

const ALERT_TYPES = new Set(['follow', 'subscription', 'donation', 'raid']);

/** Which settings toggle governs each event type. */
const TOGGLE = { follow: 'follows', subscription: 'subs', donation: 'donations', raid: 'raids' };

/** Should this event become an alert at all, given the operator's settings? */
export function shouldAlert(event, settings) {
  if (!event || !ALERT_TYPES.has(event.type)) return false;
  if (!settings[TOGGLE[event.type]]) return false;
  if (settings.platforms?.length && !settings.platforms.includes(event.platform)) return false;
  const d = event.data || {};
  if (event.type === 'donation' && (Number(d.amount) || 0) < (settings.minDonation || 0)) return false;
  if (event.type === 'raid' && (Number(d.viewers) || 0) < (settings.minRaid || 0)) return false;
  return true;
}

/** Money is shown in its own currency; Twitch bits are just a count. */
export function formatAmount(amount, currency) {
  const n = Number(amount) || 0;
  if (!currency || currency === 'bits') return `${n.toLocaleString()} bits`;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

/** Replace {placeholders}; unknown ones are left blank rather than shown raw. */
export function fillTemplate(template, vars) {
  return String(template || '')
    .replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? ''))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * @returns {{ kind: string, headline: string, message: string, highlight: string, platform: string, chime: 'soft'|'bright'|'big' }}
 *   `highlight` is the value worth emphasising (amount, viewer count, sub count).
 */
export function formatAlert(event, settings) {
  const d = event.data || {};
  const name = event.user?.displayName || event.user?.name || 'Someone';
  const vars = {
    name,
    platform: event.platform,
    amount: '',
    currency: d.currency || '',
    tier: '',
    months: d.months ?? '',
    count: d.giftCount ?? '',
    viewers: d.viewers ?? '',
    message: settings.showMessage ? (d.message || '') : '',
  };

  switch (event.type) {
    case 'follow':
      return out('follow', fillTemplate(settings.followText, vars), '', '', 'soft');

    case 'subscription': {
      if (d.isGift) {
        vars.count = d.giftCount || 1;
        return out('gift', fillTemplate(settings.giftText, vars), vars.message, `×${vars.count}`, 'bright');
      }
      if ((d.months || 1) > 1) {
        return out('resub', fillTemplate(settings.resubText, vars), vars.message, `${d.months} mo`, 'soft');
      }
      vars.tier = d.tier && d.tier !== '1' ? ` (Tier ${d.tier})` : '';
      return out('sub', fillTemplate(settings.subText, vars), vars.message, d.tier && d.tier !== '1' ? `T${d.tier}` : '', 'soft');
    }

    case 'donation': {
      vars.amount = formatAmount(d.amount, d.currency);
      return out('donation', fillTemplate(settings.donationText, vars), vars.message, vars.amount, 'bright');
    }

    case 'raid':
      return out('raid', fillTemplate(settings.raidText, vars), '', `${Number(d.viewers || 0).toLocaleString()}`, 'big');

    default:
      return null;
  }

  function out(kind, headline, message, highlight, chime) {
    return { kind, headline, message, highlight, platform: event.platform, chime };
  }
}
