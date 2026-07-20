// ChatRepository.ts — Interface + In-Memory-Variante (Web/Tests) für
// Assistenten-Chats. Nachrichten hängen an genau einem Chat; Löschen eines
// Chats entfernt seine Nachrichten mit.
import type { Chat, ChatMessage } from './types';

export interface ChatRepository {
  getAll(): Promise<Chat[]>;
  create(chat: Chat): Promise<void>;
  update(id: string, patch: Partial<Omit<Chat, 'id'>>): Promise<void>;
  remove(id: string): Promise<void>;
  getMessages(chatId: string): Promise<ChatMessage[]>;
  /** Alle Nachrichten (Suche, Backup). */
  getAllMessages(): Promise<ChatMessage[]>;
  addMessage(message: ChatMessage): Promise<void>;
  clearAll(): Promise<void>;
}

export class InMemoryChatRepository implements ChatRepository {
  private chats = new Map<string, Chat>();
  private messages = new Map<string, ChatMessage>();

  async getAll(): Promise<Chat[]> {
    // Neueste Aktivität zuerst — die Reihenfolge der Chat-Liste.
    return [...this.chats.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async create(chat: Chat): Promise<void> {
    this.chats.set(chat.id, { ...chat });
  }

  async update(id: string, patch: Partial<Omit<Chat, 'id'>>): Promise<void> {
    const existing = this.chats.get(id);
    if (existing) this.chats.set(id, { ...existing, ...patch });
  }

  async remove(id: string): Promise<void> {
    this.chats.delete(id);
    for (const [mid, m] of this.messages) if (m.chatId === id) this.messages.delete(mid);
  }

  async getMessages(chatId: string): Promise<ChatMessage[]> {
    return [...this.messages.values()]
      .filter((m) => m.chatId === chatId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async getAllMessages(): Promise<ChatMessage[]> {
    return [...this.messages.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async addMessage(message: ChatMessage): Promise<void> {
    this.messages.set(message.id, { ...message });
  }

  async clearAll(): Promise<void> {
    this.chats.clear();
    this.messages.clear();
  }
}
