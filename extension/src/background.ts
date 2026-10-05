// Background service worker. Holds the custody store (hash + metadata, 24 h,
// in memory via storage.session), relays records to the Windows agent over
// Native Messaging, and keeps a short local event log for the popup.

import type { CustodyRecord } from '@owlcept/engine';
import { type OwlEvent, type PopupState, type StatusReply, type ToBackground, type ToContent } from './messages.ts';
import { deviceId, loadSettings } from './settings-store.ts';

const NATIVE_HOST = 'com.owlcept.agent';
const CUSTODY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 1000;
const RECONNECT_ALARM = 'owlcept-agent-reconnect';

let port: chrome.runtime.Port | null = null;
let agentConnected = false;

// ------------------------------------------------------------ Windows agent link

function connectAgent(): void {
  if (port) return;
  try {
    port = chrome.runtime.connectNative(NATIVE_HOST);
  } catch {
    port = null;
    return;
  }
  port.onMessage.addListener((msg: { type?: string }) => {
    if (msg?.type === 'hello') agentConnected = true;
  });
  port.onDisconnect.addListener(() => {
    void chrome.runtime.lastError; // "native messaging host not found" when the agent is not installed
    port = null;
    agentConnected = false;
  });
  port.postMessage({ type: 'hello', from: 'extension', version: chrome.runtime.getManifest().version });
}

chrome.alarms.create(RECONNECT_ALARM, { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === RECONNECT_ALARM && !port) connectAgent();
});
chrome.runtime.onStartup.addListener(connectAgent);
chrome.runtime.onInstalled.addListener(connectAgent);
connectAgent();

// ------------------------------------------------------------ custody store

async function storeCustody(record: CustodyRecord): Promise<void> {
  if (!record.hash) return;
  const { custody = {} } = (await chrome.storage.session.get('custody')) as { custody?: Record<string, CustodyRecord> };
  const now = Date.now();
  for (const [h, r] of Object.entries(custody)) if (now - (r.time ?? 0) > CUSTODY_TTL_MS) delete custody[h];
  custody[record.hash] = record;
  await chrome.storage.session.set({ custody });
  port?.postMessage({ type: 'custody', record });
}

async function logEvent(e: OwlEvent): Promise<void> {
  const { events = [] } = (await chrome.storage.local.get('events')) as { events?: OwlEvent[] };
  events.unshift(e);
  await chrome.storage.local.set({ events: events.slice(0, MAX_EVENTS) });
}

const hostOf = (url?: string): string => {
  try {
    return url ? new URL(url).hostname : '';
  } catch {
    return '';
  }
};

// ------------------------------------------------------------ messages

chrome.runtime.onMessage.addListener((msg: ToBackground, sender, reply) => {
  const tabId = sender.tab?.id;
  switch (msg?.type) {
    case 'status':
      void loadSettings().then(({ settings, locked }) => reply({ agentConnected, settings, locked } satisfies StatusReply));
      return true;
    case 'popup-state':
      void Promise.all([loadSettings(), chrome.storage.local.get('events'), deviceId()]).then(([{ settings, locked }, stored, id]) => {
        const events = (stored.events as OwlEvent[] | undefined) ?? [];
        reply({ agentConnected, settings, locked, events, deviceId: id, version: chrome.runtime.getManifest().version } satisfies PopupState);
      });
      return true;
    case 'custody': {
      void storeCustody(msg.record);
      if (msg.action !== 'allow') {
        void logEvent({
          time: Date.now(),
          kind: msg.action === 'block' ? 'copy-block' : 'copy-warn',
          host: hostOf(msg.record.originUrl),
          ids: msg.ids,
          hash: msg.record.hash,
          note: msg.note,
          url: msg.action === 'block' ? msg.record.originUrl : undefined,
        });
        if (msg.shown && msg.action === 'block' && tabId !== undefined) {
          void chrome.action.setBadgeBackgroundColor({ tabId, color: '#DC2626' });
          void chrome.action.setBadgeText({ tabId, text: '!' });
        }
      }
      return false;
    }
    case 'consentfix':
      void logEvent({ time: Date.now(), kind: 'consentfix', host: msg.host, ids: ['consentfix', msg.provider], note: msg.note, url: msg.url });
      if (!msg.note && tabId !== undefined) void chrome.action.setBadgeText({ tabId, text: '!' });
      return false;
    case 'override':
      void logEvent({ time: Date.now(), kind: 'override', host: msg.host, ids: msg.ids });
      return false;
    case 'show-banner':
      if (tabId !== undefined) {
        const out: ToContent = { type: 'show-banner', data: msg.data, canCopyAnyway: false, show: msg.show };
        void chrome.tabs.sendMessage(tabId, out, { frameId: 0 });
      }
      return false;
    case 'close-tab':
      if (tabId !== undefined) void chrome.tabs.remove(tabId);
      return false;
  }
  return false;
});
