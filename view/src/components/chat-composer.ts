import type SlInput from '@shoelace-style/shoelace/dist/components/input/input.js';
import { css, html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { emit } from './types.ts';

const SUGGESTIONS = ['Suggestion A', 'Suggestion B', 'Suggestion C'];

@customElement('ethos-chat-composer')
export class ChatComposer extends LitElement {
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) showSuggestions = false;

  @state() private value = '';
  @query('sl-input') private input!: SlInput;

  static styles = css`
    :host {
      display: block;
      padding: 4px 8px 8px;
    }
    .suggestions {
      display: flex;
      gap: 6px;
      padding: 4px 0 8px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .suggestions button {
      flex-shrink: 0;
      padding: 6px 12px;
      font: inherit;
      font-size: 13px;
      color: var(--ethos-accent);
      background: none;
      border: 1px solid color-mix(in srgb, var(--ethos-accent) 45%, transparent);
      border-radius: 16px;
      cursor: pointer;
    }
    .suggestions button:hover {
      background: color-mix(in srgb, var(--ethos-accent) 10%, transparent);
    }
    form {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    sl-icon-button {
      font-size: 20px;
      color: var(--ethos-accent);
    }
    sl-input {
      flex: 1;
      min-width: 0;
      --sl-input-height-small: 36px;
      --sl-input-background-color: var(--ethos-incoming);
      --sl-input-background-color-hover: var(--ethos-incoming);
      --sl-input-background-color-focus: var(--ethos-incoming);
      --sl-input-border-color: transparent;
      --sl-input-border-color-hover: transparent;
      --sl-input-border-color-focus: transparent;
      --sl-input-focus-ring-color: transparent;
      --sl-input-font-size-small: 15px;
    }
  `;

  private send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || this.disabled) return;
    emit(this, 'ethos-send', trimmed);
    this.value = '';
    this.input?.focus();
  }

  focus() {
    this.input?.focus();
  }

  render() {
    const hasText = this.value.trim().length > 0;
    return html`
      ${this.showSuggestions
        ? html`<div class="suggestions">
            ${SUGGESTIONS.map((s) => html`<button type="button" @click=${() => this.send(s)}>${s}</button>`)}
          </div>`
        : null}
      <form @submit=${(e: Event) => { e.preventDefault(); this.send(this.value); }}>
        <sl-icon-button name="plus-circle-fill" label="More" @click=${() => emit(this, 'ethos-personalize')}></sl-icon-button>
        <sl-input
          size="small"
          pill
          placeholder="Aa"
          autocomplete="off"
          .value=${this.value}
          @sl-input=${(e: Event) => (this.value = (e.target as SlInput).value)}
          @keydown=${(e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(this.value); }
      }}
        ></sl-input>
        <sl-icon-button name="send-fill" label="Send" ?disabled=${this.disabled || !hasText} @click=${() => this.send(this.value)}></sl-icon-button>
      </form>
    `;
  }
}
