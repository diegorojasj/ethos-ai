import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { ChatMessage, Persona } from './types.ts';
import './chat-avatar.ts';

/** Messages closer together than this are grouped into one stack of bubbles. */
const GROUP_GAP_MS = 60_000;
/** A centered timestamp is shown when the conversation pauses this long. */
const TIMESTAMP_GAP_MS = 10 * 60_000;

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayTimeFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

function formatStamp(ts: number) {
  const sameDay = new Date(ts).toDateString() === new Date().toDateString();
  return (sameDay ? timeFormat : dayTimeFormat).format(ts);
}

/** A message made only of 1–3 emoji is rendered large without a bubble, like Messenger. */
function isBigEmoji(text: string) {
  return /^(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*\s*){1,3}$/u.test(text.trim());
}

@customElement('ethos-chat-message-list')
export class ChatMessageList extends LitElement {
  @property({ attribute: false }) messages: ChatMessage[] = [];
  @property({ attribute: false }) persona!: Persona;
  @property({ type: Boolean }) typing = false;

  @query('.scroller') private scroller!: HTMLElement;

  static styles = css`
    :host {
      display: block;
      flex: 1;
      min-height: 0;
    }
    .scroller {
      height: 100%;
      overflow-y: auto;
      padding: 12px 8px 4px;
      box-sizing: border-box;
      overscroll-behavior: contain;
    }
    .intro {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 16px 0 24px;
      text-align: center;
    }
    .intro-name {
      margin-top: 8px;
      font-size: 17px;
      font-weight: 600;
      color: var(--ethos-text);
    }
    .intro-sub {
      font-size: 13px;
      color: var(--ethos-muted);
    }
    .stamp {
      margin: 16px 0 8px;
      font-size: 11px;
      text-align: center;
      color: var(--ethos-muted);
    }
    .row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      margin-top: 2px;
    }
    .row.first {
      margin-top: 8px;
    }
    .row.user {
      flex-direction: row-reverse;
    }
    .avatar-slot {
      width: 28px;
      flex-shrink: 0;
    }
    .content {
      display: flex;
      align-items: center;
      gap: 4px;
      max-width: 75%;
    }
    .row.user .content {
      flex-direction: row-reverse;
    }
    .bubble {
      padding: 8px 12px;
      font-size: 15px;
      line-height: 1.35;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border-radius: 18px;
    }
    .assistant .bubble {
      background: var(--ethos-incoming);
      color: var(--ethos-text);
    }
    .user .bubble {
      background: var(--ethos-accent);
      color: #fff;
    }
    /* Messenger-style grouping: inner corners tighten between stacked bubbles. */
    .assistant:not(.first) .bubble { border-top-left-radius: 4px; }
    .assistant:not(.last) .bubble { border-bottom-left-radius: 4px; }
    .user:not(.first) .bubble { border-top-right-radius: 4px; }
    .user:not(.last) .bubble { border-bottom-right-radius: 4px; }
    .bubble.emoji {
      padding: 0 4px;
      font-size: 40px;
      background: none !important;
    }
    .seen {
      display: flex;
      justify-content: flex-end;
      margin: 2px 2px 0 0;
    }
    .typing .bubble {
      display: flex;
      gap: 4px;
      padding: 12px 14px;
    }
    .typing span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ethos-muted);
      animation: bounce 1.2s infinite ease-in-out;
    }
    .typing span:nth-child(2) { animation-delay: 0.15s; }
    .typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
      30% { transform: translateY(-4px); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .typing span { animation: none; }
    }
  `;

  protected updated(changed: PropertyValues<this>) {
    if (changed.has('messages') || changed.has('typing')) {
      this.scroller.scrollTop = this.scroller.scrollHeight;
    }
  }

  private renderMessage(m: ChatMessage, i: number) {
    const prev = this.messages[i - 1];
    const next = this.messages[i + 1];
    const first = !prev || prev.role !== m.role || m.createdAt - prev.createdAt > GROUP_GAP_MS;
    const last = !next || next.role !== m.role || next.createdAt - m.createdAt > GROUP_GAP_MS;
    const showStamp = !prev || m.createdAt - prev.createdAt > TIMESTAMP_GAP_MS;
    const lastUserMessage = m.role === 'user' && !this.messages.slice(i + 1).some((n) => n.role === 'user');
    const seen = lastUserMessage && this.messages.slice(i + 1).some((n) => n.role === 'assistant');

    return html`
      ${showStamp ? html`<div class="stamp">${formatStamp(m.createdAt)}</div>` : nothing}
      <div class="row ${m.role} ${first ? 'first' : ''} ${last ? 'last' : ''}">
        <div class="avatar-slot">
          ${m.role === 'assistant' && last
            ? html`<ethos-chat-avatar .emoji=${this.persona.avatar} .label=${this.persona.name} size="28"></ethos-chat-avatar>`
            : nothing}
        </div>
        <div class="content">
          <div class="bubble ${isBigEmoji(m.text) ? 'emoji' : ''}" title=${timeFormat.format(m.createdAt)}>${m.text}</div>
        </div>
      </div>
      ${seen
        ? html`<div class="seen" title="Seen">
            <ethos-chat-avatar .emoji=${this.persona.avatar} .label="Seen by ${this.persona.name}" size="14"></ethos-chat-avatar>
          </div>`
        : nothing}
    `;
  }

  render() {
    const { persona } = this;
    return html`
      <div class="scroller" role="log" aria-live="polite">
        <div class="intro">
          <ethos-chat-avatar .emoji=${persona.avatar} .label=${persona.name} size="60"></ethos-chat-avatar>
          <div class="intro-name">${persona.name}</div>
          <div class="intro-sub">Your personal AI assistant</div>
          <div class="intro-sub">Tap the sliders to change how I look and talk.</div>
        </div>
        ${repeat(this.messages, (m) => m.id, (m, i) => this.renderMessage(m, i))}
        ${this.typing
          ? html`<div class="row assistant first last typing">
              <div class="avatar-slot">
                <ethos-chat-avatar .emoji=${persona.avatar} .label=${persona.name} size="28"></ethos-chat-avatar>
              </div>
              <div class="content">
                <div class="bubble" aria-label="${persona.name} is typing"><span></span><span></span><span></span></div>
              </div>
            </div>`
          : nothing}
      </div>
    `;
  }
}
