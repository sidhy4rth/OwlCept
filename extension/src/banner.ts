// The on-page warning. Lives in a closed shadow root so page CSS and scripts
// cannot restyle it or click its buttons.

import type { Lang } from '@owlcept/engine';
import { UI, fill } from './strings.ts';

export interface BannerData {
  kind: 'block' | 'warn' | 'consentfix';
  lang: Lang;
  headline: string;
  details: string[];
  provenance?: string;
  advice: string;
  /** Source host, used in the "Ask someone I trust" message. */
  host: string;
  /** Finding ids, logged with an override. */
  ids?: string[];
}

export interface BannerActions {
  onClose: () => void;
  onAsk: () => void;
  /** Present when the user may restore the original copy after typing COPY. */
  onCopyAnyway?: () => Promise<void>;
}

const OWL = `<svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true">
<path d="M15 22 10 5l14 10q8-3 16 0L54 5l-5 17q7 10 5 22-4 15-22 16-18-1-22-16-2-12 5-22z" fill="#312E81"/>
<ellipse cx="32" cy="49" rx="12" ry="9" fill="#4338CA"/>
<circle cx="23" cy="30" r="10.5" fill="#4F46E5"/><circle cx="41" cy="30" r="10.5" fill="#4F46E5"/>
<circle cx="23" cy="30" r="8" fill="#F59E0B"/><circle cx="23" cy="30" r="3.8" fill="#0F172A"/><circle cx="24.6" cy="28.4" r="1.4" fill="#fff"/>
<circle cx="41" cy="30" r="8" fill="#F59E0B"/>
<g stroke="#B91C1C" stroke-width="1.8" stroke-linecap="round" fill="none"><circle cx="41" cy="30" r="5"/><path d="M41 21.5v4.5M41 34v4.5M32.5 30H37M45 30h4.5"/></g>
<path d="M13 18.5 26 22.5M38 22.5 51 18.5" stroke="#1E1B4B" stroke-width="2.6" stroke-linecap="round"/>
<path d="M29 37h6l-3 6z" fill="#F59E0B"/></svg>`;

const CSS = `
:host { all: initial; }
.wrap { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: flex-start; justify-content: center;
  padding: 24px 16px; background: rgba(15, 23, 42, .55); font-family: "Segoe UI", "Nirmala UI", system-ui, -apple-system, sans-serif; }
.wrap.toast { inset: auto 16px 16px auto; background: none; padding: 0; }
.card { box-sizing: border-box; width: min(560px, 100%); background: #fff; color: #0F172A; border-radius: 14px; padding: 20px 22px;
  box-shadow: 0 20px 50px rgba(0,0,0,.35); border-top: 6px solid #DC2626; line-height: 1.45; font-size: 15px; }
.warn .card, .toast .card { border-top-color: #F59E0B; }
.head { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
.brand { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #4338CA; }
h1 { font-size: 18px; margin: 2px 0 0; line-height: 1.3; }
ul { margin: 8px 0 10px; padding-left: 20px; } li { margin: 4px 0; }
.prov { color: #334155; margin: 6px 0; }
.advice { background: #FEF2F2; border-radius: 8px; padding: 10px 12px; margin: 10px 0 14px; color: #7F1D1D; }
.warn .advice, .toast .advice { background: #FFFBEB; color: #78350F; }
.row { display: flex; flex-wrap: wrap; gap: 8px; }
button { font: inherit; font-size: 14px; border-radius: 8px; padding: 9px 14px; border: 1px solid #CBD5E1; background: #fff; color: #0F172A; cursor: pointer; }
button.primary { background: #DC2626; border-color: #DC2626; color: #fff; font-weight: 600; }
.warn button.primary { background: #B45309; border-color: #B45309; }
button.link { border: none; background: none; color: #475569; text-decoration: underline; padding: 9px 6px; }
.confirm { display: none; gap: 8px; margin-top: 10px; align-items: center; flex-wrap: wrap; }
.confirm.on { display: flex; }
input { font: inherit; font-size: 14px; padding: 8px 10px; border: 1px solid #CBD5E1; border-radius: 8px; width: 120px; }
.note { font-size: 13px; color: #166534; margin-top: 8px; }
@media (prefers-color-scheme: dark) {
  .card { background: #0F172A; color: #E2E8F0; } .prov { color: #94A3B8; }
  .advice { background: #3B0D0D; color: #FECACA; } .warn .advice, .toast .advice { background: #3A2A06; color: #FDE68A; }
  button { background: #1E293B; color: #E2E8F0; border-color: #334155; } button.link { background: none; color: #94A3B8; }
  input { background: #1E293B; color: #E2E8F0; border-color: #334155; } .brand { color: #A5B4FC; }
}`;

let current: HTMLElement | null = null;

export function hideBanner(): void {
  current?.remove();
  current = null;
}

export function showBanner(data: BannerData, actions: BannerActions): void {
  hideBanner();
  const ui = UI[data.lang];
  const host = document.createElement('owlcept-warning');
  const root = host.attachShadow({ mode: 'closed' });
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

  root.innerHTML = `<style>${CSS}</style>
  <div class="wrap ${data.kind === 'warn' ? 'warn' : ''}" role="alertdialog" aria-modal="true" aria-labelledby="h" lang="${data.lang}">
    <div class="card">
      <div class="head">${OWL}<div><div class="brand">OwlCept</div><h1 id="h">${esc(data.headline)}</h1></div></div>
      <ul>${data.details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
      ${data.provenance ? `<p class="prov">${esc(data.provenance)}</p>` : ''}
      <div class="advice">${esc(data.advice)}</div>
      <div class="row">
        <button class="primary" data-a="close">${esc(ui.close)}</button>
        <button data-a="ask">${esc(ui.ask)}</button>
        <button class="link" data-a="dismiss">${esc(ui.dismiss)}</button>
        ${actions.onCopyAnyway ? `<button class="link" data-a="anyway">${esc(ui.copyAnyway)}</button>` : ''}
      </div>
      <div class="confirm"><input aria-label="${esc(ui.typeToConfirm)}" placeholder="${esc(ui.typeToConfirm)}" autocomplete="off">
        <button data-a="confirm" disabled>${esc(ui.confirmCopy)}</button></div>
      <div class="note" hidden></div>
    </div>
  </div>`;

  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const confirmRow = $('.confirm');
  const input = $<HTMLInputElement>('input');
  const confirmBtn = $<HTMLButtonElement>('[data-a="confirm"]');
  input.addEventListener('input', () => (confirmBtn.disabled = input.value.trim().toUpperCase() !== 'COPY'));

  root.addEventListener('click', async (e) => {
    const a = (e.target as Element).closest('button')?.getAttribute('data-a');
    if (a === 'close') actions.onClose();
    else if (a === 'ask') actions.onAsk();
    else if (a === 'dismiss') hideBanner();
    else if (a === 'anyway') {
      confirmRow.classList.add('on');
      input.focus();
    } else if (a === 'confirm' && actions.onCopyAnyway) {
      await actions.onCopyAnyway();
      const note = $<HTMLElement>('.note');
      note.textContent = ui.copied;
      note.hidden = false;
      confirmRow.classList.remove('on');
    }
  });
  // Keep page keyboard shortcuts away from the banner's input.
  for (const type of ['keydown', 'keyup', 'keypress']) host.addEventListener(type, (e) => e.stopPropagation());

  (document.body ?? document.documentElement).appendChild(host);
  current = host;
  $<HTMLButtonElement>('button.primary').focus();
}

/** Small non-blocking note for "warn" verdicts when the Windows agent is not there to check the paste. */
export function showToast(data: BannerData, onDetails: () => void): void {
  hideBanner();
  const ui = UI[data.lang];
  const host = document.createElement('owlcept-warning');
  const root = host.attachShadow({ mode: 'closed' });
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  root.innerHTML = `<style>${CSS}</style><div class="wrap toast" role="status" lang="${data.lang}"><div class="card">
    <div class="head">${OWL}<div><div class="brand">OwlCept</div><h1>${esc(ui.careful)}</h1></div></div>
    <p class="prov">${esc(data.details[0] ?? data.headline)}</p>
    <div class="row"><button data-a="more">${esc(data.headline.split(':')[0])}…</button><button class="link" data-a="dismiss">${esc(ui.dismiss)}</button></div>
  </div></div>`;
  root.addEventListener('click', (e) => {
    const a = (e.target as Element).closest('button')?.getAttribute('data-a');
    if (a === 'dismiss') hideBanner();
    if (a === 'more') onDetails();
  });
  (document.body ?? document.documentElement).appendChild(host);
  current = host;
  setTimeout(() => current === host && hideBanner(), 10_000);
}

export function askMessage(data: BannerData): string {
  return fill(UI[data.lang].askMessage, { host: data.host || '?', detail: data.details[0] ?? '' });
}
