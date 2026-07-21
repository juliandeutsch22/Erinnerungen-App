// assistantRun.ts — laufende Assistenten-Antworten pro Chat, ENTKOPPELT vom
// Chat-Screen. Verlässt man den Chat mitten in der Antwort, läuft die
// Generierung hier weiter, speichert die Antwort und hält den „denkt"-Zustand —
// beim Zurückkehren ist sie da (oder kommt gleich), statt verloren zu gehen.
//
// Bewusst außerhalb der Komponente (zustand): der Promise hängt nicht am
// Lebenszyklus des Screens. Gespeichert wird direkt über das Repository, die
// Query-Invalidierung über den beim Start mitgegebenen QueryClient — beides
// überlebt das Unmounten des Screens.
import type { QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import { getChatRepository } from '@/data';
import { chatMessagesKey, chatsKey } from '@/data/chatQueries';
import type { ChatMessage } from '@/data/types';
import { newId } from '@/data/types';
import { askAssistant, generateChatTitle } from '@/lib/assistant';

export type ChatRun = {
  pending: boolean;
  stream: string;
  error: string | null;
  /** ID der gespeicherten Antwort — der Screen räumt den Stream, sobald sie im Verlauf ist. */
  savedId: string | null;
};

type StartArgs = {
  chatId: string;
  apiKey: string;
  history: ChatMessage[];
  context: string | null;
  qc: QueryClient;
  /** Auto-Titel nach dem ersten Austausch — nur wenn `allowed()` (kein manuelles Umbenennen). */
  autoTitle?: { firstUserContent: string; allowed: () => boolean };
};

type State = {
  runs: Record<string, ChatRun | undefined>;
  start: (args: StartArgs) => Promise<void>;
  clearStream: (chatId: string) => void;
  clearError: (chatId: string) => void;
};

export const useAssistantRun = create<State>((set, get) => ({
  runs: {},

  start: async ({ chatId, apiKey, history, context, qc, autoTitle }) => {
    const patch = (r: Partial<ChatRun>) =>
      set((s) => {
        const prev = s.runs[chatId] ?? { pending: false, stream: '', error: null, savedId: null };
        return { runs: { ...s.runs, [chatId]: { ...prev, ...r } } };
      });

    patch({ pending: true, stream: '', error: null, savedId: null });
    try {
      let acc = '';
      const answer = await askAssistant(apiKey, history, context, (delta) => {
        acc += delta;
        patch({ stream: acc });
      });

      const now = new Date().toISOString();
      const message: ChatMessage = { id: newId(), chatId, role: 'assistant', content: answer, createdAt: now };
      const repo = getChatRepository();
      await repo.addMessage(message);
      await repo.update(chatId, { updatedAt: now });
      void qc.invalidateQueries({ queryKey: chatMessagesKey(chatId) });
      void qc.invalidateQueries({ queryKey: chatsKey });
      void qc.invalidateQueries({ queryKey: ['chat-messages-all'] });
      patch({ savedId: message.id, pending: false });

      // Auto-Titel im Hintergrund — manuelle Umbenennung gewinnt immer.
      if (autoTitle && autoTitle.allowed()) {
        void generateChatTitle(apiKey, autoTitle.firstUserContent, answer).then((title) => {
          if (title && autoTitle.allowed()) {
            void repo.update(chatId, { title });
            void qc.invalidateQueries({ queryKey: chatsKey });
          }
        });
      }
    } catch (e) {
      patch({ pending: false, stream: '', error: e instanceof Error ? e.message : 'Unbekannter Fehler.' });
    }
  },

  clearStream: (chatId) =>
    set((s) => {
      const prev = s.runs[chatId];
      if (!prev) return s;
      return { runs: { ...s.runs, [chatId]: { ...prev, stream: '', savedId: null } } };
    }),

  clearError: (chatId) =>
    set((s) => {
      const prev = s.runs[chatId];
      if (!prev) return s;
      return { runs: { ...s.runs, [chatId]: { ...prev, error: null } } };
    }),
}));
