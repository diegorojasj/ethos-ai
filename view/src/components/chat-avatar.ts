import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { AIStatusState } from './types.ts';

/** Emoji avatar with Messenger's "active now" dot, colored by the assistant's status. */
@customElement('ethos-chat-avatar')
export class ChatAvatar extends LitElement {
  @property() emoji = '🤖';
  @property() label = 'Assistant';
  @property({ type: Number }) size = 32;
  /** Shows the status dot when set. */
  @property({ reflect: true }) status?: AIStatusState;

  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
      flex-shrink: 0;
    }
    sl-avatar {
      --size: var(--avatar-size);
    }
    sl-avatar::part(base) {
      background: color-mix(in srgb, var(--ethos-accent) 18%, #fff);
    }
    .emoji {
      font-size: calc(var(--avatar-size) * 0.55);
      line-height: 1;
    }
    .dot {
      position: absolute;
      right: 0;
      bottom: 0;
      width: calc(var(--avatar-size) * 0.3);
      height: calc(var(--avatar-size) * 0.3);
      min-width: 8px;
      min-height: 8px;
      border-radius: 50%;
      background: var(--ethos-status-unknown, #bcc0c4);
      border: 2px solid var(--ethos-surface, #fff);
      transition: background 0.2s ease;
    }
    :host([status='available']) .dot {
      background: var(--ethos-status-available, #31a24c);
    }
    :host([status='unavailable']) .dot {
      background: var(--ethos-status-unavailable, #f7b928);
    }
    :host([status='offline']) .dot {
      background: var(--ethos-status-offline, #e41e3f);
    }
  `;

  render() {
    return html`
      <sl-avatar style="--avatar-size:${this.size}px" label=${this.label}>
        <span slot="icon" class="emoji">${this.emoji}</span>
      </sl-avatar>
      ${this.status ? html`<span class="dot" style="--avatar-size:${this.size}px"></span>` : null}
    `;
  }
}
