import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ChatMessage, Persona } from './types.ts';
import './chat-header.ts';
import './chat-message-list.ts';
import './chat-composer.ts';
import './chat-personalize.ts';

/** The docked conversation window: header + messages + composer, with the personalize drawer on top. */
@customElement('ethos-chat-window')
export class ChatWindow extends LitElement {
  @property({ attribute: false }) persona!: Persona;
  @property({ attribute: false }) messages: ChatMessage[] = [];
  @property({ type: Boolean }) typing = false;
  @property({ type: Boolean }) minimized = false;
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
    :host([minimized]) {
      height: auto;
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
      <ethos-chat-header .persona=${this.persona} ?typing=${this.typing} ?minimized=${this.minimized}></ethos-chat-header>
      ${this.minimized
        ? null
        : html`
            <ethos-chat-message-list .persona=${this.persona} .messages=${this.messages} ?typing=${this.typing}></ethos-chat-message-list>
            <ethos-chat-composer ?disabled=${this.typing} ?showSuggestions=${this.messages.length === 0}></ethos-chat-composer>
            <ethos-chat-personalize .persona=${this.persona} ?open=${this.personalizing}></ethos-chat-personalize>
          `}
    `;
  }
}
