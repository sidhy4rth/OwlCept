// Messages between content scripts, the popup and the background worker.
// Clipboard text never appears here: only hashes and metadata.

import type { Action, ActivityEvent, CustodyRecord } from '@owlcept/engine';
import type { BannerData } from './banner.ts';
import type { LangSetting } from './strings.ts';
import type { Mode } from './policy.ts';

/** One entry in the local activity log: hashes and metadata only. */
export type OwlEvent = ActivityEvent;

export interface Settings {
  lang: LangSetting;
  /** Optional WhatsApp number (digits, with country code) for "Ask someone I trust". */
  contact: string;
  /** audit: log only · smart: block the dangerous, warn the doubtful · strict: every warning blocks. */
  mode: Mode;
  /** Hosts whose warnings are skipped. Blocks still apply. */
  trustedSites: string[];
  /** Opt-in: offer "Report this page" on blocks, which opens a public report form. Nothing is sent automatically. */
  reportLures: boolean;
  /** Name for this device in exported reports, e.g. "Library PC 4". */
  deviceLabel: string;
  /** Whether "Copy anyway" is offered on a block. Organisations can turn it off. */
  allowCopyAnyway: boolean;
  /** Organisation only: hosts a command may never contact (from the fleet view). */
  blockedHosts: string[];
  /** Organisation only: SHA-256 fingerprints of exact commands that never prompt. */
  approvedCommands: string[];
}

export const DEFAULT_SETTINGS: Settings = { lang: 'auto', contact: '', mode: 'smart', trustedSites: [], reportLures: false, deviceLabel: '', allowCopyAnyway: true, blockedHosts: [], approvedCommands: [] };

export type ToBackground =
  | { type: 'status' }
  | { type: 'custody'; record: CustodyRecord; action: Action; risk: number; ids: string[]; note?: OwlEvent['note']; shown: boolean }
  | { type: 'consentfix'; host: string; provider: string; url: string; note?: OwlEvent['note'] }
  | { type: 'override'; host: string; ids: string[] }
  | { type: 'show-banner'; data: BannerData; canCopyAnyway: boolean; show: 'toast' | 'banner' }
  | { type: 'close-tab' }
  | { type: 'popup-state' };

export interface StatusReply {
  agentConnected: boolean;
  settings: Settings;
  /** Settings fixed by the organisation's policy (chrome.storage.managed). */
  locked: (keyof Settings)[];
}

export interface PopupState extends StatusReply {
  events: OwlEvent[];
  deviceId: string;
  version: string;
}

export type ToContent = { type: 'show-banner'; data: BannerData; canCopyAnyway: boolean; show: 'toast' | 'banner' };
