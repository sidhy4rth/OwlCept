// Warning review: each reviewer scores a pack of real warnings; the Results tab
// merges their files into accuracy and Cohen's kappa. Offline; files are untrusted.

import { parseReviewResult, reviewStats, type Lang, type ReviewItem, type ReviewPack, type ReviewResult, type Score } from '@owlcept/engine';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => Object.assign(document.createElement(tag), { textContent: text, className: cls });
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

let pack: ReviewPack | null = null;
let index = 0;
let scores: ReviewResult['scores'] = {};

// ------------------------------------------------------------------ pack

/** Packs come from our own generator but are still files: keep only well-formed items. */
function parsePack(text: string): ReviewPack {
  const p = JSON.parse(text) as ReviewPack;
  if (p?.format !== 'owlcept-review-pack' || p.version !== 1 || !Array.isArray(p.items)) throw new Error('This is not an OwlCept review pack.');
  const ok = (w: unknown) => {
    const x = w as ReviewItem['warning']['en'];
    return x && typeof x.headline === 'string' && Array.isArray(x.details) && typeof x.advice === 'string';
  };
  const items = p.items.filter((i) => i && typeof i.id === 'string' && typeof i.command === 'string' && ok(i.warning?.en) && ok(i.warning?.hi) && ok(i.warning?.kn)).slice(0, 1000);
  if (!items.length) throw new Error('The pack has no warnings to review.');
  return { ...p, id: String(p.id).slice(0, 80), items };
}

const storeKey = () => `owlcept-review:${pack?.id}:${$<HTMLInputElement>('reviewer').value.trim() || 'anonymous'}:${$<HTMLSelectElement>('lang').value}`;
function persist(): void {
  try {
    localStorage.setItem(storeKey(), JSON.stringify(scores));
    $('saved').textContent = 'saved in this browser';
  } catch {
    $('saved').textContent = 'not saved: download your scores before closing';
  }
}
function restore(): void {
  try {
    scores = JSON.parse(localStorage.getItem(storeKey()) ?? '{}') ?? {};
  } catch {
    scores = {};
  }
}

function show(): void {
  if (!pack) return;
  const item = pack.items[index];
  const lang = $<HTMLSelectElement>('lang').value as Lang;
  const w = item.warning[lang];
  const done = pack.items.filter((i) => scores[i.id]).length;
  $('item').hidden = false;
  $('counter').textContent = `Warning ${index + 1} of ${pack.items.length} · ${done} scored`;
  $('bar').style.width = `${(done / pack.items.length) * 100}%`;
  $('context').textContent = `Pasted into: ${item.target} · From: ${item.source} · OwlCept ${item.action === 'block' ? 'blocked' : 'warned'} (risk ${item.risk})`;
  $('command').textContent = item.command;
  $('warning').className = `warning ${item.action}`;
  $('warning').lang = lang;
  $('w-head').textContent = w.headline;
  $('w-details').replaceChildren(...w.details.map((d) => el('li', d)));
  $('w-prov').textContent = w.provenance ?? '';
  $('w-adv').textContent = w.advice;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-score]')) b.classList.toggle('on', scores[item.id]?.score === b.dataset.score);
  $<HTMLTextAreaElement>('note').value = scores[item.id]?.note ?? '';
  $<HTMLButtonElement>('prev').disabled = index === 0;
  $<HTMLButtonElement>('next').disabled = index === pack.items.length - 1;
}

function score(s: Score): void {
  if (!pack) return;
  const id = pack.items[index].id;
  const note = $<HTMLTextAreaElement>('note').value.trim();
  scores[id] = { score: s, ...(note ? { note } : {}) };
  persist();
  if (index < pack.items.length - 1) index++;
  show();
}

function download(): void {
  if (!pack) return;
  const result: ReviewResult = {
    format: 'owlcept-review-result', version: 1, packId: pack.id,
    reviewer: $<HTMLInputElement>('reviewer').value.trim() || 'anonymous',
    lang: $<HTMLSelectElement>('lang').value as Lang, scores,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
  Object.assign(document.createElement('a'), { href: url, download: `owlcept-review-${result.reviewer.replace(/[^\w-]+/g, '-')}-${result.lang}.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ------------------------------------------------------------------ results

async function loadResults(files: FileList): Promise<void> {
  const results: ReviewResult[] = [];
  let resultsPack: ReviewPack | null = pack;
  const errors: string[] = [];
  for (const f of [...files]) {
    const text = await f.text();
    try {
      results.push(parseReviewResult(text));
    } catch (e) {
      try {
        resultsPack = parsePack(text);
      } catch {
        errors.push(`${f.name}: ${(e as Error).message}`);
      }
    }
  }
  const packIds = new Set(results.map((r) => r.packId));
  if (packIds.size > 1) errors.push(`These scores come from ${packIds.size} different packs; compare reviewers of the same pack.`);
  $('results-err').hidden = !errors.length;
  $('results-err').textContent = errors.join(' ');
  if (!results.length) return;

  const itemIds = resultsPack && packIds.has(resultsPack.id) ? resultsPack.items.map((i) => i.id) : undefined;
  const s = reviewStats(results, itemIds);
  const describe = (id: string) => {
    const it = resultsPack?.items.find((i) => i.id === id);
    return it ? `${id}: ${it.command.length > 70 ? `${it.command.slice(0, 70)}…` : it.command}` : id;
  };
  $('stats').hidden = false;
  $('s-mean').textContent = pct(s.meanAccuracy);
  $('s-mean').className = `big ${s.meanAccuracy >= 0.9 ? 'pass' : 'fail'}`;
  $('s-all').textContent = pct(s.allCorrect);
  $('s-common').textContent = String(s.common);
  $('s-kappa').textContent = s.kappa === null ? '—' : s.kappa.toFixed(2);
  // Landis and Koch's bands, the usual way to read kappa.
  const k = s.kappa;
  $('s-kappa-label').textContent = k === null ? "agreement (Cohen's κ): needs two reviewers" : `agreement (Cohen's κ): ${k < 0 ? 'poor' : k <= 0.2 ? 'slight' : k <= 0.4 ? 'fair' : k <= 0.6 ? 'moderate' : k <= 0.8 ? 'substantial' : 'almost perfect'}`;
  $('s-reviewers').replaceChildren(...s.reviewers.map((r) => {
    const tr = el('tr');
    tr.append(el('td', r.reviewer), el('td', r.lang), el('td', String(r.scored)), el('td', String(r.correct)), el('td', pct(r.accuracy)));
    return tr;
  }));
  const empty = (cols: number) => {
    const tr = el('tr');
    const td = el('td', 'None.', 'meta');
    td.colSpan = cols;
    tr.append(td);
    return tr;
  };
  $('s-wrong').replaceChildren(...(s.wrong.length ? s.wrong.map((w) => {
    const tr = el('tr');
    tr.append(el('td', describe(w.id)), el('td', w.reviewer), el('td', w.note ?? ''));
    return tr;
  }) : [empty(3)]));
  $('s-dis').replaceChildren(...(s.disagreements.length ? s.disagreements.map((d) => {
    const tr = el('tr');
    tr.append(el('td', describe(d.id)), el('td', Object.entries(d.scores).map(([r, v]) => `${r}: ${v}`).join(' · ')));
    return tr;
  }) : [empty(2)]));
}

// ------------------------------------------------------------------ wiring

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
  b.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    $('tab-review').hidden = b.dataset.tab !== 'review';
    $('tab-results').hidden = b.dataset.tab !== 'results';
  });
}
$('pick-pack').addEventListener('click', () => $('pack-file').click());
$<HTMLInputElement>('pack-file').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    pack = parsePack(await f.text());
    index = 0;
    restore();
    $('pack-err').hidden = true;
    $('pack-info').textContent = `${pack.items.length} warnings, drawn with seed ${pack.seed} from ${pack.population} available.`;
    show();
  } catch (err) {
    $('pack-err').hidden = false;
    $('pack-err').textContent = (err as Error).message;
  }
});
for (const id of ['reviewer', 'lang']) $(id).addEventListener('change', () => {
  restore();
  show();
});
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-score]')) b.addEventListener('click', () => score(b.dataset.score as Score));
$('note').addEventListener('change', () => {
  if (!pack) return;
  const id = pack.items[index].id;
  if (scores[id]) {
    const note = $<HTMLTextAreaElement>('note').value.trim();
    scores[id] = { score: scores[id].score, ...(note ? { note } : {}) };
    persist();
  }
});
$('prev').addEventListener('click', () => {
  index = Math.max(0, index - 1);
  show();
});
$('next').addEventListener('click', () => {
  if (pack) index = Math.min(pack.items.length - 1, index + 1);
  show();
});
$('download').addEventListener('click', download);
document.addEventListener('keydown', (e) => {
  if (!pack || $('tab-review').hidden || (e.target as HTMLElement).matches('input, textarea, select')) return;
  if (e.key === '1') score('correct');
  else if (e.key === '2') score('partly');
  else if (e.key === '3') score('wrong');
  else if (e.key === 'ArrowRight' || e.key === 'j') $('next').click();
  else if (e.key === 'ArrowLeft' || e.key === 'k') $('prev').click();
});
$('pick-results').addEventListener('click', () => $('results-file').click());
$<HTMLInputElement>('results-file').addEventListener('change', (e) => {
  const files = (e.target as HTMLInputElement).files;
  if (files?.length) void loadResults(files);
});
