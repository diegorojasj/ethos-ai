import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { emit, type Persona } from './types.ts';
import './chat-avatar.ts';

/** Floating "chat head" bubble in the bottom-right corner. */
@customElement('ethos-chat-launcher')
export class ChatLauncher extends LitElement {
  @property({ attribute: false }) persona!: Persona;
  @property({ type: Number }) unread = 0;

  static styles = css`
    button {
      position: relative;
      display: grid;
      place-items: center;
      width: 60px;
      height: 60px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: var(--ethos-surface);
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
      cursor: pointer;
      transition: transform 0.15s ease;
    }
    button:hover {
      transform: scale(1.06);
    }
    button:focus-visible {
      outline: 3px solid var(--ethos-accent);
      outline-offset: 2px;
    }
    sl-badge {
      position: absolute;
      top: -2px;
      right: -2px;
    }
  `;

  render() {
    return html`
      <sl-tooltip content="Chat with ${this.persona.name}" placement="left">
        <button aria-label="Open chat with ${this.persona.name}" @click=${() => emit(this, 'ethos-open')}>
          <ethos-chat-avatar .emoji=${this.persona.avatar} .label=${this.persona.name} size="56" online></ethos-chat-avatar>
          ${this.unread > 0 ? html`<sl-badge variant="danger" pill pulse>${this.unread}</sl-badge>` : null}
        </button>
      </sl-tooltip>
    `;
  }
}
