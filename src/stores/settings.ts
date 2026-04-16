"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SettingsState {
  advancedMode: boolean;
  setAdvancedMode: (value: boolean) => void;
  toggleAdvancedMode: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      advancedMode: false,
      setAdvancedMode: (value) => set({ advancedMode: value }),
      toggleAdvancedMode: () =>
        set((state) => ({ advancedMode: !state.advancedMode })),
    }),
    {
      name: "opencap-lite:settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
