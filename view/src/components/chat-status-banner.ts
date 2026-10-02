import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { emit, STATUS_LABELS, type AIStatus } from './types.ts';

/** Explains why the assistant can't answer, with a way to check again. Renders nothing while it's available. */
@customElement('ethos-chat-status-banner')
export class ChatStatusBanner extends LitElement {
  @property({ attribute: false }) status!: AIStatus;

  static styles = css`
    .banner {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 10px 8px 12px;
      font-size: 13px;
      line-height: 1.35;
      border-bottom: 1px solid var(--ethos-border);
      background: color-mix(in srgb, var(--tone) 12%, var(--ethos-surface));
      --tone: var(--ethos-status-unavailable, #f7b928);
    }
    .banner.offline {
      --tone: var(--ethos-status-offline, #e41e3f);
    }
    sl-icon {
      flex-shrink: 0;
      margin-top: 1px;
      font-size: 16px;
      color: color-mix(in srgb, var(--tone) 80%, #000);
    }
    .text {
      flex: 1;
      min-width: 0;
    }
    .title {
      font-weight: 600;
    }
    .detail {
      color: var(--ethos-muted);
      overflow-wrap: anywhere;
    }
  `;

  render() {
    const { state, message, checking } = this.status;
    if (state !== 'unavailable' && state !== 'offline') return null;
    return html`
      <div class="banner ${state}" role="status">
        <sl-icon name=${state === 'offline' ? 'wifi-off' : 'exclamation-triangle'}></sl-icon>
        <div class="text">
          <div class="title">${STATUS_LABELS[state]}</div>
          <div class="detail">${message}</div>
        </div>
        <sl-button size="small" ?loading=${checking} @click=${() => emit(this, 'ethos-status-check')}>Check again</sl-button>
      </div>
    `;
  }
}
