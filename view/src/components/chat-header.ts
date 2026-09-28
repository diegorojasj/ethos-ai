import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { emit, type Persona } from './types.ts';
import './chat-avatar.ts';

@customElement('ethos-chat-header')
export class ChatHeader extends LitElement {
  @property({ attribute: false }) persona!: Persona;
  @property({ type: Boolean }) typing = false;
  @property({ type: Boolean }) minimized = false;

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 4px 6px 8px;
      border-bottom: 1px solid var(--ethos-border);
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
      z-index: 1;
    }
    .identity {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 4px;
      border: none;
      border-radius: 8px;
      background: none;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .identity:hover {
      background: var(--ethos-hover);
    }
    .text {
      min-width: 0;
    }
    .name {
      font-weight: 600;
      font-size: 15px;
      color: var(--ethos-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status {
      font-size: 12px;
      color: var(--ethos-muted);
    }
    sl-icon-button {
      font-size: 18px;
      color: var(--ethos-accent);
    }
  `;

  render() {
    const { persona } = this;
    return html`
      <button class="identity" @click=${() => emit(this, this.minimized ? 'ethos-restore' : 'ethos-personalize')}>
        <ethos-chat-avatar .emoji=${persona.avatar} .label=${persona.name} size="32" online></ethos-chat-avatar>
        <div class="text">
          <div class="name">${persona.name}</div>
          <div class="status">${this.typing ? 'Typing…' : 'AI assistant · Active now'}</div>
        </div>
      </button>
      ${this.minimized
        ? null
        : html`<sl-icon-button name="sliders" label="Personalize assistant" @click=${() => emit(this, 'ethos-personalize')}></sl-icon-button>`}
      <sl-icon-button
        name=${this.minimized ? 'chevron-up' : 'dash-lg'}
        label=${this.minimized ? 'Expand chat' : 'Minimize chat'}
        @click=${() => emit(this, this.minimized ? 'ethos-restore' : 'ethos-minimize')}
      ></sl-icon-button>
      <sl-icon-button name="x-lg" label="Close chat" @click=${() => emit(this, 'ethos-close')}></sl-icon-button>
    `;
  }
}
