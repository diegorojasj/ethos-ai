import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/** Emoji avatar with Messenger's green "active now" dot. */
@customElement('ethos-chat-avatar')
export class ChatAvatar extends LitElement {
  @property() emoji = '🤖';
  @property() label = 'Assistant';
  @property({ type: Number }) size = 32;
  @property({ type: Boolean }) online = false;

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
      background: #31a24c;
      border: 2px solid var(--ethos-surface, #fff);
    }
  `;

  render() {
    return html`
      <sl-avatar style="--avatar-size:${this.size}px" label=${this.label}>
        <span slot="icon" class="emoji">${this.emoji}</span>
      </sl-avatar>
      ${this.online ? html`<span class="dot" style="--avatar-size:${this.size}px"></span>` : null}
    `;
  }
}
