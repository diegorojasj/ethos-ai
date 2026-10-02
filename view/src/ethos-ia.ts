import { css, html, LitElement, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './components/shoelace.ts';
import './components/chat-launcher.ts';
import './components/chat-window.ts';
import { DEFAULT_PERSONA, type AIStatus, type ChatMessage, type Persona } from './components/types.ts';

/** How often the assistant's status is re-checked while the page is visible. */
const STATUS_POLL_MS = 60_000;
const OFFLINE_MESSAGE = "Can't reach the assistant service. Check your connection or try again shortly.";

/** The browser's session key, issued by the service; shared by every <ethos-ia> on the origin. */
const SESSION_HEADER = 'X-Ethos-Session';
const SESSION_STORAGE_KEY = 'ethos-ia:session';
/** Fallback when localStorage is blocked: the session then lasts as long as the page. */
let memorySession: string | null = null;

function loadSession() {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY) ?? memorySession;
  } catch {
    return memorySession;
  }
}

/** Keeps the key the service answered with: a new one when ours was missing or unknown. */
function rememberSession(res: Response) {
  const key = res.headers.get(SESSION_HEADER);
  if (!key || key === loadSession()) return;
  memorySession = key;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, key);
  } catch {
    // Storage blocked; the in-memory key still works for this page.
  }
}

function sessionHeaders(json: boolean): Record<string, string> {
  const session = loadSession();
  return { ...(json && { 'Content-Type': 'application/json' }), ...(session && { [SESSION_HEADER]: session }) };
}

/** A chat request that failed because the assistant can't answer, as opposed to a bad request. */
class StatusError extends Error {
  constructor(
    readonly state: 'unavailable' | 'offline',
    message: string,
  ) {
    super(message);
  }
}

interface StoredConversation {
  conversationId: string;
  persona: Pick<Persona, 'name' | 'systemPrompt'>;
  messages: ChatMessage[];
}

/**
 * Messenger-style AI chat docked to the bottom-right corner.
 *
 * <ethos-ia name="Ethos" endpoint="/api/chat"></ethos-ia>
 *
 * `endpoint` receives `POST { conversationId, message, persona }` and answers
 * `{ conversationId, reply }`. The server keeps the conversation memory (messages and the
 * persona's name and system prompt) in MongoDB; its sibling routes `persona` and
 * `conversations/:id` serve the defaults and read, update or forget that memory. Every request
 * carries the browser's `X-Ethos-Session` key, so each browser only reaches its own conversations.
 */
@customElement('ethos-ia')
export class EthosIA extends LitElement {
  /** Default assistant name, used until the user personalizes it. */
  @property() name = DEFAULT_PERSONA.name;
  @property() endpoint = '';
  /** Namespaces saved persona/history so several instances can coexist. */
  @property({ attribute: 'storage-key' }) storageKey = 'default';

  @state() private open = false;
  @state() private personalizing = false;
  @state() private typing = false;
  @state() private busy = false;
  @state() private unread = 0;
  @state() private persona: Persona = { ...DEFAULT_PERSONA };
  @state() private messages: ChatMessage[] = [];
  @state() private status: AIStatus = { state: 'unknown', message: '', checking: false };
  private conversationId: string | null = null;
  private defaultSystemPrompt = '';
  private statusTimer?: number;
  private readonly onVisible = () => {
    if (document.visibilityState === 'visible') this.checkStatus();
  };
  private readonly onOnline = () => this.checkStatus(true);

  static styles = css`
    :host {
      --ethos-surface: #fff;
      --ethos-incoming: #f0f2f5;
      --ethos-hover: #f2f2f2;
      --ethos-border: #e4e6eb;
      --ethos-text: #050505;
      --ethos-muted: #65676b;
      --ethos-accent: #0084ff;
      --sl-color-primary-500: color-mix(in srgb, var(--ethos-accent) 85%, #fff);
      --sl-color-primary-600: var(--ethos-accent);
      --sl-color-primary-700: color-mix(in srgb, var(--ethos-accent) 85%, #000);

      position: fixed;
      right: 16px;
      bottom: 0;
      z-index: 1000;
      display: flex;
      align-items: flex-end;
      gap: 12px;
      font-family: var(--sl-font-sans);
      color: var(--ethos-text);
    }
    ethos-chat-launcher {
      margin-bottom: 16px;
    }
    @media (max-width: 480px) {
      :host([open]) {
        right: 0;
      }
    }
  `;

  private get key() {
    return `ethos-ia:${this.storageKey}`;
  }

  connectedCallback() {
    super.connectedCallback();
    this.persona = { ...DEFAULT_PERSONA, name: this.name };
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) ?? 'null');
      const { name = this.persona.name, avatar = this.persona.avatar, systemPrompt = '' } = saved?.persona ?? {};
      this.persona = { name, avatar, systemPrompt };
      if (Array.isArray(saved?.messages)) this.messages = saved.messages;
      if (typeof saved?.conversationId === 'string') this.conversationId = saved.conversationId;
    } catch {
      // Storage unavailable or corrupt — start fresh.
    }
    this.sync().catch((err) => console.error('[ethos-ia]', err));
    this.checkStatus();
    this.statusTimer = window.setInterval(() => document.visibilityState === 'visible' && this.checkStatus(), STATUS_POLL_MS);
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('online', this.onOnline);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.statusTimer);
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('online', this.onOnline);
  }

  /** Asks the server whether the AI can answer. `refresh` skips the server's short-lived cache. */
  private async checkStatus(refresh = false) {
    if (!this.endpoint || this.status.checking) return;
    this.status = { ...this.status, checking: true };
    try {
      const res = await fetch(this.apiUrl(refresh ? 'status?refresh=1' : 'status'));
      if (!res.ok) throw new Error(`status responded ${res.status}`);
      // The service names the state `status`.
      const { status, ...body }: Omit<AIStatus, 'state' | 'checking'> & { status: AIStatus['state'] } = await res.json();
      this.status = { ...body, state: status, checking: false };
    } catch {
      this.status = { state: 'offline', message: OFFLINE_MESSAGE, checking: false, checkedAt: Date.now() };
    }
  }

  /** A sibling of `endpoint`, e.g. `/api/chat` -> `/api/conversations/123`. */
  private apiUrl(path: string) {
    const [pathname, query = ''] = path.split('?');
    const url = new URL(this.endpoint, location.href);
    url.pathname = url.pathname.replace(/\/chat\/?$/, `/${pathname}`);
    url.search = query;
    return url;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T | null> {
    const res = await fetch(this.apiUrl(path), { ...init, headers: sessionHeaders(Boolean(init?.body)) });
    rememberSession(res);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} responded ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  /** Loads the default persona and, when a conversation exists, its memory: the server is the source of truth. */
  private async sync() {
    if (!this.endpoint) return;
    const defaults = await this.request<Pick<Persona, 'name' | 'systemPrompt'>>('persona');
    this.defaultSystemPrompt = defaults?.systemPrompt ?? '';

    const id = this.conversationId;
    const stored = id ? await this.request<StoredConversation>(`conversations/${encodeURIComponent(id)}`) : null;
    if (id !== this.conversationId) return; // The chat was reset or re-created meanwhile.
    if (stored) {
      this.persona = { ...this.persona, ...stored.persona };
      this.messages = stored.messages;
    } else {
      // No conversation yet, or the server forgot it: start over with the local persona.
      if (id) {
        this.conversationId = null;
        this.messages = [];
      }
      if (!this.persona.systemPrompt) this.persona = { ...this.persona, systemPrompt: this.defaultSystemPrompt };
    }
  }

  /** Applies a settings change locally, then stores the server-side part with the conversation. */
  private async changePersona(next: Persona) {
    if (!next.systemPrompt) next = { ...next, systemPrompt: this.defaultSystemPrompt };
    const previous = this.persona;
    this.persona = next;
    const id = this.conversationId;
    if (!id || (next.name === previous.name && next.systemPrompt === previous.systemPrompt)) return;
    try {
      const stored = await this.request<Pick<StoredConversation, 'persona'>>(`conversations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: next.name, systemPrompt: next.systemPrompt }),
      });
      // The server normalizes blank values back to its defaults.
      if (stored && id === this.conversationId) this.persona = { ...this.persona, ...stored.persona };
    } catch (err) {
      console.error('[ethos-ia]', err);
    }
  }

  protected willUpdate(changed: PropertyValues) {
    this.toggleAttribute('open', this.open);
    // While a reply streams in, save once it is complete rather than on every chunk.
    if (changed.has('persona') || ((changed.has('messages') || changed.has('busy')) && !this.busy)) this.save();
  }

  private save() {
    try {
      localStorage.setItem(this.key, JSON.stringify({ persona: this.persona, conversationId: this.conversationId, messages: this.messages.slice(-200) }));
    } catch {
      // Quota exceeded or storage blocked; the chat still works for this session.
    }
  }

  private addMessage(role: ChatMessage['role'], text: string) {
    const message: ChatMessage = { id: crypto.randomUUID(), role, text, createdAt: Date.now() };
    this.messages = [...this.messages, message];
    return message;
  }

  /** Shows the reply as it streams in: the first chunk adds the assistant's message, later ones grow it. */
  private showReply(id: string | null, text: string) {
    if (!id) {
      this.typing = false;
      return this.addMessage('assistant', text).id;
    }
    this.messages = this.messages.map((m) => (m.id === id ? { ...m, text } : m));
    return id;
  }

  private async send(text: string) {
    this.addMessage('user', text);
    this.typing = true;
    this.busy = true;
    let replyId: string | null = null;
    try {
      await this.fetchReply(text, (reply) => (replyId = this.showReply(replyId, reply)));
      if (!replyId) this.showReply(null, '');
      if (!this.open) this.unread++;
      this.status = { ...this.status, state: 'available', message: '', checkedAt: Date.now() };
    } catch (err) {
      console.error('[ethos-ia]', err);
      // The service only stores complete replies, so drop a partial one.
      if (replyId) this.messages = this.messages.filter((m) => m.id !== replyId);
      if (err instanceof StatusError) this.status = { ...this.status, state: err.state, message: err.message, checkedAt: Date.now() };
    } finally {
      this.typing = false;
      this.busy = false;
    }
  }

  /** Posts the message and calls `onText` with the whole reply so far each time more of it arrives. */
  private async fetchReply(message: string, onText: (reply: string) => void) {
    if (!this.endpoint) throw new Error('No `endpoint` attribute set on <ethos-ia>.');
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: sessionHeaders(true),
        body: JSON.stringify({ conversationId: this.conversationId, message, persona: this.persona }),
      });
    } catch {
      throw new StatusError('offline', OFFLINE_MESSAGE);
    }
    rememberSession(res);
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && type.includes('ndjson') && res.body) return this.readReplyStream(res, onText);

    const isJson = type.includes('json');
    const body = isJson ? await res.json() : await res.text();
    if (typeof body !== 'string' && body.conversationId) {
      this.conversationId = body.conversationId;
      this.save();
    }
    // 502 with a JSON error: the service is up but the AI provider failed. Other 5xx: a proxy
    // answered because the service itself is down.
    if (res.status === 502 && isJson) throw new StatusError('unavailable', body.error ?? 'The assistant could not answer.');
    if (res.status >= 500) throw new StatusError('offline', OFFLINE_MESSAGE);
    if (!res.ok) throw new Error(`Chat endpoint responded ${res.status}${body?.error ? `: ${body.error}` : ''}`);
    onText(typeof body === 'string' ? body : String(body.reply ?? body.message ?? ''));
  }

  /** Reads the NDJSON events of a streamed reply (see the service's `reply_events`). */
  private async readReplyStream(res: Response, onText: (reply: string) => void) {
    const id = res.headers.get('X-Conversation-Id');
    if (id && id !== this.conversationId) {
      this.conversationId = id;
      this.save();
    }
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let reply = '';
    let buffered = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += value;
        const lines = buffered.split('\n');
        buffered = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === 'delta') reply += event.text;
          else if (event.type === 'replace') reply = event.text;
          else if (event.type === 'error') throw new StatusError('unavailable', event.error ?? 'The assistant could not answer.');
          else if (event.type === 'done') return;
          onText(reply);
        }
      }
    } catch (err) {
      if (err instanceof StatusError) throw err;
      throw new StatusError('offline', OFFLINE_MESSAGE);
    }
    // The connection closed before `done`: the service went away mid-reply.
    throw new StatusError('offline', OFFLINE_MESSAGE);
  }

  /** Clears the chat and asks the server to forget the conversation's memory. */
  private reset() {
    const id = this.conversationId;
    this.conversationId = null;
    this.messages = [];
    this.personalizing = false;
    if (id && this.endpoint) {
      this.request(`conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((err) => console.error('[ethos-ia]', err));
    }
  }

  private show() {
    this.open = true;
    this.unread = 0;
    this.updateComplete.then(() => this.renderRoot.querySelector('ethos-chat-window')?.shadowRoot?.querySelector<HTMLElement>('ethos-chat-composer')?.focus());
  }

  render() {
    return html`
      <div
        style="display:contents"
        @ethos-open=${this.show}
        @ethos-close=${() => { this.open = false; this.personalizing = false; }}
        @ethos-personalize=${() => (this.personalizing = true)}
        @ethos-personalize-close=${() => (this.personalizing = false)}
        @ethos-persona-change=${(e: CustomEvent<Persona>) => this.changePersona(e.detail)}
        @ethos-send=${(e: CustomEvent<string>) => this.send(e.detail)}
        @ethos-reset=${this.reset}
        @ethos-status-check=${() => this.checkStatus(true)}
      >
        ${this.open
          ? html`<ethos-chat-window
              .persona=${this.persona}
              .messages=${this.messages}
              .status=${this.status}
              ?typing=${this.typing}
              ?busy=${this.busy}
              ?personalizing=${this.personalizing}
            ></ethos-chat-window>`
          : html`<ethos-chat-launcher .persona=${this.persona} .unread=${this.unread} .status=${this.status.state}></ethos-chat-launcher>`}
      </div>
    `;
  }
}

