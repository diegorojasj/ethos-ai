import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { emit, STATUS_LABELS, type AIStatus, type Persona } from './types.ts';
import './chat-avatar.ts';

@customElement('ethos-chat-header')
export class ChatHeader extends LitElement {
  @property({ attribute: false }) persona!: Persona;
  @property({ attribute: false }) status!: AIStatus;
  @property({ type: Boolean }) typing = false;

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
    .status.unavailable,
    .status.offline {
      color: color-mix(in srgb, var(--ethos-status-offline, #e41e3f) 85%, #000);
    }
    sl-icon-button {
      font-size: 18px;
      color: var(--ethos-accent);
    }
  `;

  /** e.g. "anthropic · claude-opus-5 · checked 10:42:07". */
  private statusDetail() {
    const { provider, model, checkedAt, message } = this.status;
    const parts = [provider, model, checkedAt ? `checked ${new Date(checkedAt).toLocaleTimeString()}` : ''];
    return [parts.filter(Boolean).join(' · '), message].filter(Boolean).join('\n');
  }

  render() {
    const { persona, status } = this;
    return html`
      <button class="identity" @click=${() => emit(this, 'ethos-personalize')}>
        <ethos-chat-avatar .emoji=${persona.avatar} .label=${persona.name} size="32" .status=${status.state}></ethos-chat-avatar>
        <div class="text">
          <div class="name">${persona.name}</div>
          <sl-tooltip content=${this.statusDetail() || STATUS_LABELS[status.state]} placement="bottom-start" hoist>
            <div class="status ${status.state}" aria-live="polite">
              ${this.typing ? 'Typing…' : `AI assistant · ${STATUS_LABELS[status.state]}`}
            </div>
          </sl-tooltip>
        </div>
      </button>
      <sl-icon-button name="sliders" label="Personalize assistant" @click=${() => emit(this, 'ethos-personalize')}></sl-icon-button>
      <sl-icon-button name="x-lg" label="Close chat" @click=${() => emit(this, 'ethos-close')}></sl-icon-button>
    `;
  }
}
