import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SettingsState {
    apiKey: string;
    ttsVoice: string;
    setApiKey: (key: string) => void;
    setTtsVoice: (voiceUri: string) => void;
    isSidebarCollapsed: boolean;
    toggleSidebar: () => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKey: 'AIzaSyAykXn8fJyMMZGeMGkDSuenbi7WM1jGxj0', // Default fake key
            ttsVoice: '',
            isSidebarCollapsed: false,
            setApiKey: (apiKey) => set({ apiKey }),
            setTtsVoice: (ttsVoice) => set({ ttsVoice }),
            toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
        }),
        {
            name: 'gemini-settings-storage',
            version: 1,
        }
    )
);
