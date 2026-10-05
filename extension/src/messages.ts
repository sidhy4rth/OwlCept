// Messages between content scripts, the popup and the background worker.
// Clipboard text never appears here: only hashes and metadata.

import type { Action, CustodyRecord } from '@owlcept/engine';
import type { BannerData } from './banner.ts';
import type { LangSetting } from './strings.ts';

export interface OwlEvent {
  time: number;
  kind: 'copy-block' | 'copy-warn' | 'consentfix';
  host: string;
  /** Finding ids, e.g. ["download-exec", "hidden-copy"]. */
  ids: string[];
  hash?: string;
}

export interface Settings {
  lang: LangSetting;
  /** Optional WhatsApp number (digits, with country code) for "Ask someone I trust". */
  contact: string;
}

export const DEFAULT_SETTINGS: Settings = { lang: 'auto', contact: '' };

export type ToBackground =
  | { type: 'status' }
  | { type: 'custody'; record: CustodyRecord; action: Action; risk: number; ids: string[] }
  | { type: 'consentfix'; host: string; provider: string }
  | { type: 'show-banner'; data: BannerData; canCopyAnyway: boolean }
  | { type: 'close-tab' }
  | { type: 'popup-state' };

export interface StatusReply {
  agentConnected: boolean;
  settings: Settings;
}

export interface PopupState extends StatusReply {
  events: OwlEvent[];
}

export type ToContent = { type: 'show-banner'; data: BannerData; canCopyAnyway: boolean };
