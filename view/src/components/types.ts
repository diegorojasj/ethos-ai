export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
}

/** Everything the user can personalize about their assistant (Messenger's "Customize chat"). */
export interface Persona {
  name: string;
  avatar: string;
  /** The model's instructions, stored with the conversation on the server.
   * The server always prepends a fixed identity line built from `name`. */
  systemPrompt: string;
}

/** `systemPrompt` stays empty until the server's default has been fetched. */
export const DEFAULT_PERSONA: Persona = {
  name: 'Ethos',
  avatar: '🤖',
  systemPrompt: '',
};

export const SYSTEM_PROMPT_MAX_LENGTH = 4000;

/**
 * Whether the assistant can answer. `unavailable`: the service is up but the AI provider is failing;
 * `offline`: the service itself can't be reached; `unknown`: not checked yet.
 */
export type AIStatusState = 'unknown' | 'available' | 'unavailable' | 'offline';

export interface AIStatus {
  state: AIStatusState;
  /** Why the assistant can't answer, safe to show to the user. */
  message: string;
  /** A check is in flight; `state` keeps the last known value meanwhile. */
  checking: boolean;
  provider?: string;
  model?: string;
  checkedAt?: number;
}

export const STATUS_LABELS: Record<AIStatusState, string> = {
  unknown: 'Checking…',
  available: 'Active now',
  unavailable: "Can't respond right now",
  offline: 'Service unreachable',
};

export const AVATAR_CHOICES = ['🤖', '🧠', '✨', '🦉', '🐙', '🦊', '🌱', '👾'];

/** Fires a bubbling, composed event so it crosses shadow roots up to <ethos-ia>. */
export function emit<T>(el: HTMLElement, name: string, detail?: T) {
  el.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
}
