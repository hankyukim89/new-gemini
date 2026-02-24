import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SettingsState {
    apiKey: string;
    ttsVoice: string;
    setApiKey: (key: string) => void;
    setTtsVoice: (voiceUri: string) => void;
    useOfflineSTT: boolean;
    setUseOfflineSTT: (value: boolean) => void;
    autoSpeak: boolean;
    setAutoSpeak: (value: boolean) => void;
    usePushToTalk: boolean;
    setUsePushToTalk: (value: boolean) => void;
    enableGrammarCheck: boolean;
    setEnableGrammarCheck: (value: boolean) => void;
    pushToTalkKey: string;
    setPushToTalkKey: (value: string) => void;
    pushToTalkRedoKey: string;
    setPushToTalkRedoKey: (value: string) => void;
    pushToTalkTranslateKey: string;
    setPushToTalkTranslateKey: (value: string) => void;
    enableTranslation: boolean;
    setEnableTranslation: (value: boolean) => void;
    targetLanguage: string;
    setTargetLanguage: (value: string) => void;
    sourceLanguage: string;
    setSourceLanguage: (value: string) => void;
    isSidebarCollapsed: boolean;
    toggleSidebar: () => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKey: 'AIzaSyD4VGA1UWipL-Sy9_Y-yDOiGsHrlohmpRA', // Start with user's key
            ttsVoice: '',
            isSidebarCollapsed: false,
            useOfflineSTT: false,
            autoSpeak: false,
            usePushToTalk: false,
            pushToTalkKey: 'Space', // Default to Spacebar
            pushToTalkRedoKey: 'KeyR', // Default to R key
            pushToTalkTranslateKey: 'KeyT', // Default to T
            setApiKey: (apiKey) => set({ apiKey }),
            setTtsVoice: (ttsVoice) => set({ ttsVoice }),
            setUseOfflineSTT: (useOfflineSTT) => set({ useOfflineSTT }),
            setAutoSpeak: (autoSpeak) => set({ autoSpeak }),
            enableGrammarCheck: false,
            setEnableGrammarCheck: (enableGrammarCheck) => set({ enableGrammarCheck }),
            setUsePushToTalk: (usePushToTalk) => set({ usePushToTalk }),
            setPushToTalkKey: (pushToTalkKey) => set({ pushToTalkKey }),
            setPushToTalkRedoKey: (pushToTalkRedoKey) => set({ pushToTalkRedoKey }),
            setPushToTalkTranslateKey: (pushToTalkTranslateKey) => set({ pushToTalkTranslateKey }),
            enableTranslation: false,
            setEnableTranslation: (enableTranslation) => set({ enableTranslation }),
            targetLanguage: 'Spanish',
            setTargetLanguage: (targetLanguage) => set({ targetLanguage }),
            sourceLanguage: 'en-US',
            setSourceLanguage: (sourceLanguage) => set({ sourceLanguage }),
            toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
        }),
        {
            name: 'gemini-settings-storage',
            version: 1,
        }
    )
);
