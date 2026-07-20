// SqliteChatRepository.ts — expo-sqlite-Persistenz der Assistenten-Chats (nativ).
import { getDb } from './db';
import { ChatRepository } from './ChatRepository';
import type { Chat, ChatMessage } from './types';

type ChatRow = {
  id: string; title: string; event_id: string | null; task_id: string | null;
  context: string | null; created_at: string; updated_at: string;
};
type MessageRow = { id: string; chat_id: string; role: string; content: string; created_at: string };

function toChat(r: ChatRow): Chat {
  return {
    id: r.id,
    title: r.title,
    eventId: r.event_id,
    taskId: r.task_id,
    context: r.context,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toMessage(r: MessageRow): ChatMessage {
  return {
    id: r.id,
    chatId: r.chat_id,
    role: r.role === 'assistant' ? 'assistant' : 'user',
    content: r.content,
    createdAt: r.created_at,
  };
}

export class SqliteChatRepository implements ChatRepository {
  async getAll(): Promise<Chat[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<ChatRow>('SELECT * FROM chats ORDER BY updated_at DESC');
    return rows.map(toChat);
  }

  async create(chat: Chat): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO chats (id, title, event_id, task_id, context, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [chat.id, chat.title, chat.eventId, chat.taskId, chat.context, chat.createdAt, chat.updatedAt],
    );
  }

  async update(id: string, patch: Partial<Omit<Chat, 'id'>>): Promise<void> {
    const db = await getDb();
    const sets: string[] = [];
    const args: (string | null)[] = [];
    const map: Record<string, string> = {
      title: 'title', eventId: 'event_id', taskId: 'task_id', context: 'context',
      createdAt: 'created_at', updatedAt: 'updated_at',
    };
    for (const [key, col] of Object.entries(map)) {
      if (key in patch) {
        sets.push(`${col} = ?`);
        args.push((patch as Record<string, string | null>)[key]);
      }
    }
    if (sets.length === 0) return;
    args.push(id);
    await db.runAsync(`UPDATE chats SET ${sets.join(', ')} WHERE id = ?`, args);
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM chat_messages WHERE chat_id = ?', [id]);
    await db.runAsync('DELETE FROM chats WHERE id = ?', [id]);
  }

  async getMessages(chatId: string): Promise<ChatMessage[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<MessageRow>(
      'SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC',
      [chatId],
    );
    return rows.map(toMessage);
  }

  async getAllMessages(): Promise<ChatMessage[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<MessageRow>('SELECT * FROM chat_messages ORDER BY created_at ASC');
    return rows.map(toMessage);
  }

  async addMessage(message: ChatMessage): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO chat_messages (id, chat_id, role, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [message.id, message.chatId, message.role, message.content, message.createdAt],
    );
  }

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM chat_messages; DELETE FROM chats;');
  }
}
