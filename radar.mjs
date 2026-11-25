import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const origin = 'https://make.fun';
const slugPattern = /^[a-z0-9][a-z0-9-]{0,119}$/;
const outsideScope = /\b(?:exploit|vulnerabilit\w*|bug bounty|penetration test|credential\w*|malware|phishing|offensive security|pump\.fun|token launch|trading|referral|wager|gambling)\b/i;
const supportedWork = /\b(?:design|art|game|puzzle|chess|app|website|software|visualization|guide|documentation|writing|comedy|roast|poem|changelog|fortune cookie)\b/i;
const money = value => (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(value))
  && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

async function get(path) {
  const response = await fetch(origin + path, {
    method: 'GET',
    redirect: 'error',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status}`);
  }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 4_000_000) throw new Error('Response exceeded size limit');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function scan(read = get, now = Date.now()) {
  const list = await read('/api/competitions?status=open');
  if (!Array.isArray(list?.items) || (list.items.length && !list.items.some(item =>
    typeof item?.slug === 'string' && typeof item?.deadline === 'string'))) {
    throw new Error('Unexpected competition list format');
  }
  const candidates = new Map();
  for (const item of list.items) {
    if (typeof item?.slug !== 'string' || !slugPattern.test(item.slug) ||
        typeof item.title !== 'string' || !item.title.trim() ||
        !(Date.parse(item.publishedAt) <= now && Date.parse(item.deadline) > now)) continue;
    const topic = [item.slug.replaceAll('-', ' '), item.title, item.category].join(' ');
    if (supportedWork.test(topic) && !outsideScope.test(topic + ' ' + item.description)) {
      candidates.set(item.slug, item);
    }
  }

  const results = [];
  const selected = [...candidates.values()].sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline)).slice(0, 16);
  for (const item of selected) {
    const path = `/api/competitions/${item.slug}`;
    const result = {
      title: item.title.slice(0, 140), url: `${origin}/bounty/${item.slug}`,
      rules: `${origin}${path}/requirements`, closes: new Date(item.deadline).toISOString(),
      entries: count(item.submissionCount),
      fee: 'unknown', pool: null, firstPrize: null, paidPlaces: null,
      prerequisites: [], sealedRecording: null, status: 'review', notes: [],
    };
    results.push(result);
    try {
      const detail = await read(path);
      if (detail?.acceptingSubmissions === false) {
        result.status = 'skip';
        result.notes.push('Organizer is not accepting entries');
        continue;
      }
      const rules = await read(path + '/requirements');
      if (rules?.competition?.slug !== item.slug) throw new Error('Unexpected requirements format');
      const deadline = Date.parse(rules.deadlines?.entries_close);
      if (Number.isFinite(deadline)) result.closes = new Date(deadline).toISOString();
      const task = [detail.title, detail.description, rules.competition.harness].join(' ');
      if (outsideScope.test(task) || rules.competition.harness === 'referral/v1') {
        results.pop();
        continue;
      }
      result.fee = rules.entry_fee === null ? 'free' : rules.entry_fee?.amount_usd != null ? 'paid' : 'unknown';
      result.pool = money(rules.payout_curve?.total_usd);
      const places = rules.payout_curve?.places;
      if (Array.isArray(places)) {
        result.paidPlaces = places.filter(place => money(place?.amount_usd) > 0).length;
        result.firstPrize = money(places.find(place => place?.place === 1)?.amount_usd);
      }
      const prerequisites = rules.prerequisites ?? detail.prerequisites ?? item.prerequisites;
      if (Array.isArray(prerequisites)) {
        result.prerequisites = prerequisites.map(item =>
          String(item?.label ?? item?.name ?? 'See official rules').slice(0, 100)).slice(0, 10);
      }
      if (Array.isArray(rules.deliverables)) {
        result.sealedRecording = rules.deliverables.some(item => item?.name === 'recording_ids' && item.required !== false);
      }
      if (result.fee === 'paid' || deadline <= now) {
        result.status = 'skip';
        result.notes.push(result.fee === 'paid' ? 'Entry fee required' : 'Deadline passed');
      } else {
        if (result.fee !== 'free') result.notes.push('Entry fee unconfirmed');
        if (detail.acceptingSubmissions !== true || !Number.isFinite(deadline)) result.notes.push('Entry window unconfirmed');
        if (!(result.firstPrize > 0)) result.notes.push('USD prize unconfirmed');
        if (result.prerequisites.length || (prerequisites && !Array.isArray(prerequisites))) {
          result.notes.push('Check required tools and accounts');
        }
        if (result.sealedRecording !== false) result.notes.push('Check session recording and disclosure');
        if (!result.notes.length) result.status = 'shortlist';
      }
    } catch {
      result.notes.push('Official detail or requirements unavailable');
    }
  }
  const order = { shortlist: 0, review: 1, skip: 2 };
  results.sort((a, b) => order[a.status] - order[b.status] ||
    (b.firstPrize ?? 0) - (a.firstPrize ?? 0) || a.closes.localeCompare(b.closes));
  return { scannedAt: new Date(now).toISOString(), matches: candidates.size, checked: selected.length, results };
}

export function render(report) {
  const safe = value => String(value).replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\p{L}\p{N} .,:+$/()-]/gu, ' ').trim();
  const usd = value => value == null ? 'unknown' : `$${value.toFixed(2)}`;
  const lines = [
    '# Make.fun bounty radar', '',
    `Checked ${report.checked} of ${report.matches} matching listings · ${report.scannedAt}`, '',
    'Shortlist means worth human review. Check eligibility, current AI and disclosure rules, and actual tool costs before entering.',
    'Entry count is a snapshot of submissions, and listed prizes are conditional on rank.', '',
  ];
  if (!report.results.length) lines.push('No candidates in this scan.');
  for (const item of report.results) {
    lines.push(`### [${safe(item.title) || 'Contest'}](${item.url})`, '',
      `**${item.status}** · Closes ${item.closes} · Fee ${item.fee} · First prize ${usd(item.firstPrize)} · Pool ${usd(item.pool)}`,
      `Entries ${item.entries ?? 'unknown'} · Paid places ${item.paidPlaces ?? 'unknown'} · [Official requirements](${item.rules})`, '');
    if (item.prerequisites.length) lines.push(`Listed prerequisites — ${item.prerequisites.map(safe).join(', ')}`, '');
    for (const note of item.notes) lines.push(`- ${note}`);
    lines.push('');
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  try {
    const report = await scan();
    const markdown = render(report);
    if (summary) await writeFile(summary, markdown, { flag: 'a' });
    else console.log(markdown);
    if (report.results.length && report.results.every(item =>
      item.notes.includes('Official detail or requirements unavailable'))) process.exitCode = 1;
  } catch (error) {
    const message = 'Could not read the official make.fun competition list.';
    if (summary) await writeFile(summary, `## ${message}\n`, { flag: 'a' });
    console.error(message, error.cause?.code ?? error.name);
    process.exitCode = 1;
  }
}
