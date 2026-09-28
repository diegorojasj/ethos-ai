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
}

export const DEFAULT_PERSONA: Persona = {
  name: 'Ethos',
  avatar: '🤖',
};

export const AVATAR_CHOICES = ['🤖', '🧠', '✨', '🦉', '🐙', '🦊', '🌱', '👾'];

/** Fires a bubbling, composed event so it crosses shadow roots up to <ethos-ia>. */
export function emit<T>(el: HTMLElement, name: string, detail?: T) {
  el.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
}
