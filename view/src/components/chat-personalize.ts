import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { AVATAR_CHOICES, DEFAULT_PERSONA, emit, type Persona } from './types.ts';

/** Messenger's "Customize chat" panel, repurposed to shape the AI's persona. Lives in a contained drawer. */
@customElement('ethos-chat-personalize')
export class ChatPersonalize extends LitElement {
  @property({ attribute: false }) persona!: Persona;
  @property({ type: Boolean }) open = false;

  static styles = css`
    sl-drawer {
      --size: 100%;
      --header-spacing: 12px 16px;
      --body-spacing: 0 16px 16px;
    }
    sl-drawer::part(panel) {
      border-radius: 0;
    }
    section {
      margin-top: 18px;
    }
    h3 {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--ethos-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .swatches button {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      padding: 0;
      font-size: 20px;
      border: 2px solid transparent;
      border-radius: 50%;
      background: var(--ethos-incoming);
      cursor: pointer;
    }
    .swatches button[aria-pressed='true'] {
      border-color: var(--ethos-accent);
      box-shadow: 0 0 0 2px var(--ethos-surface) inset;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 24px;
    }
  `;

  private change<K extends keyof Persona>(key: K, value: Persona[K]) {
    emit(this, 'ethos-persona-change', { ...this.persona, [key]: value });
  }

  private avatars(current: string) {
    return html`
      <div class="swatches" role="group">
        ${AVATAR_CHOICES.map(
          (item) => html`<button type="button" aria-label=${item} aria-pressed=${item === current} @click=${() => this.change('avatar', item)}>
            ${item}
          </button>`,
        )}
      </div>
    `;
  }

  render() {
    const p = this.persona;
    return html`
      <sl-drawer
        label="Personalize ${p.name}"
        placement="bottom"
        contained
        ?open=${this.open}
        @sl-after-hide=${(e: Event) => e.target === e.currentTarget && emit(this, 'ethos-personalize-close')}
      >
        <sl-input
          label="Assistant name"
          size="small"
          maxlength="24"
          .value=${p.name}
          @sl-change=${(e: Event) => this.change('name', (e.target as HTMLInputElement).value.trim() || DEFAULT_PERSONA.name)}
        ></sl-input>

        <section>
          <h3>Avatar</h3>
          ${this.avatars(p.avatar)}
        </section>

        <div class="actions">
          <sl-button size="small" variant="danger" outline @click=${() => emit(this, 'ethos-reset')}>
            <sl-icon slot="prefix" name="trash"></sl-icon>Clear conversation
          </sl-button>
        </div>

        <sl-button slot="footer" variant="primary" style="width:100%" @click=${() => emit(this, 'ethos-personalize-close')}>
          Done
        </sl-button>
      </sl-drawer>
    `;
  }
}
