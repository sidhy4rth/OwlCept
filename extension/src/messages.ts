// Messages between content scripts, the popup and the background worker.
// Clipboard text never appears here: only hashes and metadata.

import type { Action, CustodyRecord } from '@owlcept/engine';
import type { BannerData } from './banner.ts';
import type { LangSetting } from './strings.ts';
import type { Mode } from './policy.ts';

export interface OwlEvent {
  time: number;
  kind: 'copy-block' | 'copy-warn' | 'consentfix' | 'override';
  host: string;
  /** Finding ids, e.g. ["download-exec", "hidden-copy"]. */
  ids: string[];
  hash?: string;
  /** Set when the verdict was logged but not shown: audit mode or a trusted site. */
  note?: 'audit' | 'trusted-site';
}

export interface Settings {
  lang: LangSetting;
  /** Optional WhatsApp number (digits, with country code) for "Ask someone I trust". */
  contact: string;
  /** audit: log only · smart: block the dangerous, warn the doubtful · strict: every warning blocks. */
  mode: Mode;
  /** Hosts whose warnings are skipped. Blocks still apply. */
  trustedSites: string[];
}

export const DEFAULT_SETTINGS: Settings = { lang: 'auto', contact: '', mode: 'smart', trustedSites: [] };

export type ToBackground =
  | { type: 'status' }
  | { type: 'custody'; record: CustodyRecord; action: Action; risk: number; ids: string[]; note?: OwlEvent['note']; shown: boolean }
  | { type: 'consentfix'; host: string; provider: string; note?: OwlEvent['note'] }
  | { type: 'override'; host: string; ids: string[] }
  | { type: 'show-banner'; data: BannerData; canCopyAnyway: boolean; show: 'toast' | 'banner' }
  | { type: 'close-tab' }
  | { type: 'popup-state' };

export interface StatusReply {
  agentConnected: boolean;
  settings: Settings;
}

export interface PopupState extends StatusReply {
  events: OwlEvent[];
  /** Settings fixed by the organisation's policy (chrome.storage.managed). */
  locked?: (keyof Settings)[];
}

export type ToContent = { type: 'show-banner'; data: BannerData; canCopyAnyway: boolean; show: 'toast' | 'banner' };
