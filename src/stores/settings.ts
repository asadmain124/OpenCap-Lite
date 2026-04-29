"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type BuilderMode = "wizard" | "expert";

interface SettingsState {
  advancedMode: boolean;
  setAdvancedMode: (value: boolean) => void;
  toggleAdvancedMode: () => void;
  builderMode: BuilderMode;
  setBuilderMode: (value: BuilderMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      advancedMode: false,
      setAdvancedMode: (value) => set({ advancedMode: value }),
      toggleAdvancedMode: () =>
        set((state) => ({ advancedMode: !state.advancedMode })),
      builderMode: "wizard",
      setBuilderMode: (value) => set({ builderMode: value }),
    }),
    {
      name: "opencap-lite:settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
