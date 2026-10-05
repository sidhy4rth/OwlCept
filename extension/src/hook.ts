// Runs in the page's own JavaScript world at document_start (manifest
// "world": "MAIN"). It only reports clipboard writes to the isolated content
// script and applies the replacement it sends back. Every decision is made in
// the isolated world, where page scripts cannot reach.
//
// A page can undo these wrappers (for example by borrowing a clean Clipboard
// from a fresh iframe). That is expected: the isolated copy listener and the
// Windows agent's clipboard listener are the backstops.

const TAG = '__owlcept__';
type Via = 'writeText' | 'write' | 'setData' | 'execCommand';

(() => {
  if ((window as unknown as Record<string, unknown>)[TAG]) return;
  Object.defineProperty(window, TAG, { value: true });

  let seq = 0;
  const pending = new Map<number, (replace: string | null) => void>();
  // How long a page's clipboard write may wait for a verdict before it goes through unchanged.
  const DECISION_TIMEOUT_MS = 400;

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window || !e.data || e.data[TAG] !== 'decision') return;
    const resolve = pending.get(e.data.id);
    if (!resolve) return;
    pending.delete(e.data.id);
    resolve(typeof e.data.replace === 'string' ? e.data.replace : null);
  });

  function report(text: string, via: Via): number {
    const id = ++seq;
    window.postMessage({ [TAG]: 'write', id, text, via }, '*');
    return id;
  }

  function decide(text: string, via: Via): Promise<string | null> {
    const id = report(text, via);
    return new Promise((resolve) => {
      pending.set(id, resolve);
      setTimeout(() => {
        if (pending.delete(id)) resolve(null);
      }, DECISION_TIMEOUT_MS);
    });
  }

  const Clip = window.Clipboard?.prototype;
  if (Clip?.writeText) {
    const writeText = Clip.writeText;
    Clip.writeText = function (this: Clipboard, data: string): Promise<void> {
      const text = String(data);
      return decide(text, 'writeText').then((replace) => writeText.call(this, replace ?? text));
    };
  }

  if (Clip?.write) {
    const write = Clip.write;
    Clip.write = async function (this: Clipboard, items: ClipboardItems): Promise<void> {
      const item = items?.[0];
      if (!item || !item.types.includes('text/plain')) return write.call(this, items);
      const text = await (await item.getType('text/plain')).text();
      const replace = await decide(text, 'write');
      if (replace === null) return write.call(this, items);
      return write.call(this, [new ClipboardItem({ 'text/plain': new Blob([replace], { type: 'text/plain' }) })]);
    };
  }

  // Copy-event handlers and drag-and-drop both go through DataTransfer.setData.
  // It is synchronous, so the content script overwrites the clipboard afterwards if needed.
  const setData = DataTransfer.prototype.setData;
  DataTransfer.prototype.setData = function (this: DataTransfer, format: string, data: string): void {
    setData.call(this, format, data);
    if (/^text(?:\/plain)?$/i.test(format)) report(String(data), 'setData');
  };

  // The classic lure: put the command in an off-screen textarea, select it, execCommand('copy').
  const execCommand = Document.prototype.execCommand;
  Document.prototype.execCommand = function (this: Document, command: string, ...rest: unknown[]): boolean {
    if (typeof command === 'string' && command.toLowerCase() === 'copy') {
      const text = selectedText(this);
      if (text) report(text, 'execCommand');
    }
    return (execCommand as (...a: unknown[]) => boolean).call(this, command, ...rest);
  };

  function selectedText(doc: Document): string {
    const el = doc.activeElement;
    if (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && /^(?:text|search|url|tel|password)?$/i.test(el.type))) {
      const { selectionStart: a, selectionEnd: b, value } = el;
      if (a !== null && b !== null && b > a) return value.slice(a, b);
    }
    return doc.getSelection()?.toString() ?? '';
  }
})();
