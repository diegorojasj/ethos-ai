import { css, html, LitElement, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './components/shoelace.ts';
import './components/chat-launcher.ts';
import './components/chat-window.ts';
import { DEFAULT_PERSONA, type ChatMessage, type Persona } from './components/types.ts';

/**
 * Messenger-style AI chat docked to the bottom-right corner.
 *
 * <ethos-ia name="Ethos" endpoint="/api/chat"></ethos-ia>
 *
 * `endpoint` receives `POST { messages: [{ role, content }], persona }` and should answer
 * `{ reply: string }` (or plain text).
 */
@customElement('ethos-ia')
export class EthosIA extends LitElement {
  /** Default assistant name, used until the user personalizes it. */
  @property() name = DEFAULT_PERSONA.name;
  @property() endpoint = '';
  /** Namespaces saved persona/history so several instances can coexist. */
  @property({ attribute: 'storage-key' }) storageKey = 'default';

  @state() private open = false;
  @state() private minimized = false;
  @state() private personalizing = false;
  @state() private typing = false;
  @state() private unread = 0;
  @state() private persona: Persona = { ...DEFAULT_PERSONA };
  @state() private messages: ChatMessage[] = [];

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
      const { name = this.persona.name, avatar = this.persona.avatar } = saved?.persona ?? {};
      this.persona = { name, avatar };
      if (Array.isArray(saved?.messages)) this.messages = saved.messages;
    } catch {
      // Storage unavailable or corrupt — start fresh.
    }
  }

  protected willUpdate(changed: PropertyValues) {
    this.toggleAttribute('open', this.open);
    if (changed.has('persona') || changed.has('messages')) this.save();
  }

  private save() {
    try {
      localStorage.setItem(this.key, JSON.stringify({ persona: this.persona, messages: this.messages.slice(-200) }));
    } catch {
      // Quota exceeded or storage blocked; the chat still works for this session.
    }
  }

  private addMessage(role: ChatMessage['role'], text: string) {
    const message: ChatMessage = { id: crypto.randomUUID(), role, text, createdAt: Date.now() };
    this.messages = [...this.messages, message];
    return message;
  }

  private async send(text: string) {
    this.addMessage('user', text);
    this.typing = true;
    try {
      const reply = await this.fetchReply();
      this.addMessage('assistant', reply);
      if (!this.open || this.minimized) this.unread++;
    } catch (err) {
      console.error('[ethos-ia]', err);
    } finally {
      this.typing = false;
    }
  }

  private async fetchReply() {
    if (!this.endpoint) throw new Error('No `endpoint` attribute set on <ethos-ia>.');
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona: this.persona,
        messages: this.messages.map(({ role, text }) => ({ role, content: text })),
      }),
    });
    if (!res.ok) throw new Error(`Chat endpoint responded ${res.status}`);
    const body = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    return typeof body === 'string' ? body : String(body.reply ?? body.message ?? '');
  }

  private show() {
    this.open = true;
    this.minimized = false;
    this.unread = 0;
    this.updateComplete.then(() => this.renderRoot.querySelector('ethos-chat-window')?.shadowRoot?.querySelector<HTMLElement>('ethos-chat-composer')?.focus());
  }

  render() {
    return html`
      <div
        style="display:contents"
        @ethos-open=${this.show}
        @ethos-restore=${this.show}
        @ethos-minimize=${() => { this.minimized = true; this.personalizing = false; }}
        @ethos-close=${() => { this.open = false; this.personalizing = false; }}
        @ethos-personalize=${() => (this.personalizing = true)}
        @ethos-personalize-close=${() => (this.personalizing = false)}
        @ethos-persona-change=${(e: CustomEvent<Persona>) => (this.persona = e.detail)}
        @ethos-send=${(e: CustomEvent<string>) => this.send(e.detail)}
        @ethos-reset=${() => { this.messages = []; this.personalizing = false; }}
      >
        ${this.open
          ? html`<ethos-chat-window
              .persona=${this.persona}
              .messages=${this.messages}
              ?typing=${this.typing}
              ?minimized=${this.minimized}
              ?personalizing=${this.personalizing}
            ></ethos-chat-window>`
          : null}
        ${!this.open || this.minimized
          ? html`<ethos-chat-launcher .persona=${this.persona} .unread=${this.unread}></ethos-chat-launcher>`
          : null}
      </div>
    `;
  }
}

