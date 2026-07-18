import { create } from "zustand";
import type { FlashcardDifficulty } from "@/types/database";

interface StudySessionState {
  activeStudyId: string | null;
  activeTab: "notes" | "flashcards" | "quiz" | "mindmap" | "chat" | "podcast";
  currentFlashcardIndex: number;
  setActiveStudyId: (id: string | null) => void;
  setActiveTab: (tab: StudySessionState["activeTab"]) => void;
  setCurrentFlashcardIndex: (index: number) => void;
  markFlashcardDifficulty: (
    flashcardId: string,
    difficulty: FlashcardDifficulty
  ) => void;
  difficultyMarks: Record<string, FlashcardDifficulty>;
}

export const useStudySessionStore = create<StudySessionState>((set) => ({
  activeStudyId: null,
  activeTab: "notes",
  currentFlashcardIndex: 0,
  difficultyMarks: {},
  setActiveStudyId: (id) => set({ activeStudyId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setCurrentFlashcardIndex: (index) => set({ currentFlashcardIndex: index }),
  markFlashcardDifficulty: (flashcardId, difficulty) =>
    set((state) => ({
      difficultyMarks: {
        ...state.difficultyMarks,
        [flashcardId]: difficulty,
      },
    })),
}));
