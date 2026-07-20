// chatQueries.ts — TanStack-Query-Hooks für Assistenten-Chats.
// Eine Quelle für die Liste (['chats']) + eine pro Verlauf (['chat', id]).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getChatRepository } from './index';
import type { Chat, ChatMessage } from './types';
import { newId } from './types';

export const chatsKey = ['chats'] as const;
export const chatMessagesKey = (chatId: string) => ['chat', chatId] as const;

export function useChats() {
  return useQuery<Chat[]>({ queryKey: chatsKey, queryFn: () => getChatRepository().getAll() });
}

export function useChatMessages(chatId: string | undefined) {
  return useQuery<ChatMessage[]>({
    queryKey: chatMessagesKey(chatId ?? 'none'),
    queryFn: () => (chatId ? getChatRepository().getMessages(chatId) : Promise.resolve([])),
    enabled: !!chatId,
  });
}

/** Alle Nachrichten — für die Volltext-Suche. */
export function useAllChatMessages() {
  return useQuery<ChatMessage[]>({
    queryKey: ['chat-messages-all'],
    queryFn: () => getChatRepository().getAllMessages(),
  });
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title?: string; eventId?: string | null; taskId?: string | null; noteId?: string | null; context?: string | null }) => {
      const now = new Date().toISOString();
      const chat: Chat = {
        id: newId(),
        title: input.title?.trim() || 'Neuer Chat',
        eventId: input.eventId ?? null,
        taskId: input.taskId ?? null,
        noteId: input.noteId ?? null,
        context: input.context ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await getChatRepository().create(chat);
      return chat;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: chatsKey }),
  });
}

export function useUpdateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Omit<Chat, 'id' | 'createdAt'>> }) => {
      await getChatRepository().update(id, patch);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: chatsKey }),
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getChatRepository().remove(id),
    onSuccess: () => void qc.invalidateQueries(),
  });
}

/** Hängt eine Nachricht an und stempelt die Chat-Aktivität. */
export function useAppendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chatId, role, content }: { chatId: string; role: 'user' | 'assistant'; content: string }) => {
      const now = new Date().toISOString();
      const message: ChatMessage = { id: newId(), chatId, role, content, createdAt: now };
      await getChatRepository().addMessage(message);
      await getChatRepository().update(chatId, { updatedAt: now });
      return message;
    },
    onSuccess: (m) => {
      void qc.invalidateQueries({ queryKey: chatMessagesKey(m.chatId) });
      void qc.invalidateQueries({ queryKey: chatsKey });
      void qc.invalidateQueries({ queryKey: ['chat-messages-all'] });
    },
  });
}
