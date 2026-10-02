import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { AIStatus, ChatMessage, Persona } from './types.ts';
import './chat-header.ts';
import './chat-message-list.ts';
import './chat-composer.ts';
import './chat-personalize.ts';
import './chat-status-banner.ts';

/** The docked conversation window: header + messages + composer, with the personalize drawer on top. */
@customElement('ethos-chat-window')
export class ChatWindow extends LitElement {
  @property({ attribute: false }) persona!: Persona;
  @property({ attribute: false }) messages: ChatMessage[] = [];
  @property({ attribute: false }) status!: AIStatus;
  /** Waiting for the first words of a reply: shows the typing dots. */
  @property({ type: Boolean }) typing = false;
  /** A reply is being written, from the request until its last chunk. */
  @property({ type: Boolean }) busy = false;
  @property({ type: Boolean }) personalizing = false;

  static styles = css`
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 338px;
      height: 455px;
      max-height: calc(100vh - 32px);
      overflow: hidden;
      background: var(--ethos-surface);
      border-radius: 8px 8px 0 0;
      box-shadow: 0 12px 28px rgb(0 0 0 / 0.2), 0 2px 4px rgb(0 0 0 / 0.1);
      animation: rise 0.18s ease-out;
    }
    @keyframes rise {
      from { transform: translateY(16px); opacity: 0; }
    }
    @media (max-width: 480px) {
      :host {
        width: 100vw;
        height: 100dvh;
        max-height: none;
        border-radius: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host { animation: none; }
    }
  `;

  render() {
    return html`
      <ethos-chat-header .persona=${this.persona} .status=${this.status} ?typing=${this.busy}></ethos-chat-header>
      <ethos-chat-status-banner .status=${this.status}></ethos-chat-status-banner>
      <ethos-chat-message-list .persona=${this.persona} .messages=${this.messages} ?typing=${this.typing}></ethos-chat-message-list>
      <ethos-chat-composer ?disabled=${this.busy} ?showSuggestions=${this.messages.length === 0}></ethos-chat-composer>
      <ethos-chat-personalize .persona=${this.persona} ?open=${this.personalizing}></ethos-chat-personalize>
    `;
  }
}
