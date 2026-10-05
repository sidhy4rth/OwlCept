// Where a clipboard item came from, in words a person recognises: "WhatsApp Web",
// "Outlook", "a PDF", "ChatGPT". Shared by the extension (page URL), the agent
// (source process) and the scorer, so every checkpoint names a source the same way.

import type { CustodyRecord } from './types.ts';
import { hostOfUrl } from './hosts.ts';

export type SourceCategory = 'chat' | 'email' | 'pdf' | 'ai-chat' | 'web' | 'app' | 'unknown';

export interface SourceInfo {
  category: SourceCategory;
  /** Display name: "WhatsApp Web", "Gmail", "ChatGPT", or the host / process name. */
  name: string;
  host?: string;
}

// Web apps people copy from, by exact host or parent domain.
const WEB_APPS: [string, SourceCategory, string][] = [
  ['web.whatsapp.com', 'chat', 'WhatsApp Web'],
  ['web.telegram.org', 'chat', 'Telegram Web'],
  ['discord.com', 'chat', 'Discord'],
  ['app.slack.com', 'chat', 'Slack'],
  ['teams.microsoft.com', 'chat', 'Microsoft Teams'],
  ['teams.live.com', 'chat', 'Microsoft Teams'],
  ['teams.cloud.microsoft', 'chat', 'Microsoft Teams'],
  ['messenger.com', 'chat', 'Messenger'],
  ['chat.google.com', 'chat', 'Google Chat'],
  ['web.skype.com', 'chat', 'Skype'],
  ['app.zoom.us', 'chat', 'Zoom'],
  ['mail.google.com', 'email', 'Gmail'],
  ['outlook.live.com', 'email', 'Outlook'],
  ['outlook.office.com', 'email', 'Outlook'],
  ['outlook.office365.com', 'email', 'Outlook'],
  ['outlook.cloud.microsoft', 'email', 'Outlook'],
  ['mail.yahoo.com', 'email', 'Yahoo Mail'],
  ['mail.proton.me', 'email', 'Proton Mail'],
  ['mail.zoho.com', 'email', 'Zoho Mail'],
  ['mail.zoho.in', 'email', 'Zoho Mail'],
  ['mail.rediff.com', 'email', 'Rediffmail'],
  ['chatgpt.com', 'ai-chat', 'ChatGPT'],
  ['chat.openai.com', 'ai-chat', 'ChatGPT'],
  ['claude.ai', 'ai-chat', 'Claude'],
  ['gemini.google.com', 'ai-chat', 'Gemini'],
  ['copilot.microsoft.com', 'ai-chat', 'Copilot'],
  ['perplexity.ai', 'ai-chat', 'Perplexity'],
  ['chat.deepseek.com', 'ai-chat', 'DeepSeek'],
  ['grok.com', 'ai-chat', 'Grok'],
  ['meta.ai', 'ai-chat', 'Meta AI'],
  ['poe.com', 'ai-chat', 'Poe'],
  ['chat.mistral.ai', 'ai-chat', 'Le Chat'],
];

// Desktop processes, as the agent's clipboard listener reports them.
const APPS: [RegExp, SourceCategory, string][] = [
  [/^whatsapp/i, 'chat', 'WhatsApp'],
  [/^telegram/i, 'chat', 'Telegram'],
  [/^discord/i, 'chat', 'Discord'],
  [/^signal/i, 'chat', 'Signal'],
  [/^slack/i, 'chat', 'Slack'],
  [/^(?:ms-)?teams/i, 'chat', 'Microsoft Teams'],
  [/^zoom/i, 'chat', 'Zoom'],
  [/^skype/i, 'chat', 'Skype'],
  [/^messenger/i, 'chat', 'Messenger'],
  [/^wechat/i, 'chat', 'WeChat'],
  [/^line\.exe$/i, 'chat', 'LINE'],
  [/^(?:outlook|olk)/i, 'email', 'Outlook'],
  [/^thunderbird/i, 'email', 'Thunderbird'],
  [/^mailbird/i, 'email', 'Mailbird'],
  [/^mailclient/i, 'email', 'eM Client'],
  [/^(?:acrord32|acrobat|acrocef)/i, 'pdf', 'Adobe Acrobat'],
  [/^foxit/i, 'pdf', 'Foxit PDF'],
  [/^sumatra/i, 'pdf', 'Sumatra PDF'],
  [/pdf/i, 'pdf', 'a PDF reader'],
  [/^chatgpt/i, 'ai-chat', 'ChatGPT'],
  [/^claude/i, 'ai-chat', 'Claude'],
  [/^copilot/i, 'ai-chat', 'Copilot'],
];

export function classifySource(custody: CustodyRecord | null | undefined): SourceInfo {
  if (!custody) return { category: 'unknown', name: '' };
  if (custody.sourceKind === 'app' && custody.sourceApp) {
    const exe = custody.sourceApp.split(/[\\/]/).pop() ?? custody.sourceApp;
    const hit = APPS.find(([re]) => re.test(exe));
    return hit ? { category: hit[1], name: hit[2] } : { category: 'app', name: exe.replace(/\.exe$/i, '') };
  }
  const host = hostOfUrl(custody.originUrl);
  if (!host) return { category: 'unknown', name: '' };
  const hit = WEB_APPS.find(([h]) => host === h || host.endsWith(`.${h}`));
  if (hit) return { category: hit[1], name: hit[2], host };
  if (/\.pdf(?:$|[?#])/i.test(custody.originUrl ?? '')) return { category: 'pdf', name: 'a PDF', host };
  return { category: 'web', name: host, host };
}
