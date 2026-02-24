import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface PersonaConfig {
    model: string;
    temperature: number;
    topK: number;
    topP: number;
    maxOutputTokens: number;
    safetySettings?: {
        category: string;
        threshold: string;
    }[];
}

export interface Persona {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    avatar?: string;
    config: PersonaConfig;
    isChatMode?: boolean;
}

export interface PersonaState {
    personas: Persona[];
    activePersonaId: string | null;
    addPersona: (persona: Omit<Persona, 'id'>) => void;
    updatePersona: (id: string, updates: Partial<Persona>) => void;
    deletePersona: (id: string) => void;
    setActivePersona: (id: string | null) => void;
    movePersona: (id: string, direction: 'up' | 'down') => void;
}

export const DEFAULT_CONFIG: PersonaConfig = {
    model: 'gemini-3.2-flash',
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048,
};

export const usePersonaStore = create<PersonaState>()(
    persist(
        (set) => ({
            personas: [
                {
                    id: 'default',
                    name: 'Default Assistant',
                    description: 'Standard helpful assistant',
                    systemPrompt: 'You are a helpful AI assistant.',
                    avatar: '🤖',
                    config: { ...DEFAULT_CONFIG }
                },
                {
                    id: 'coder',
                    name: 'Code Guru',
                    description: 'Expert in software development',
                    systemPrompt: 'You are an expert software developer. You write clean, efficient, and well-documented code.',
                    avatar: '💻',
                    config: {
                        ...DEFAULT_CONFIG,
                        model: 'gemini-3.2-flash',
                        temperature: 0.1
                    }
                },
                {
                    id: 'creative',
                    name: 'Creative Writer',
                    description: 'Imaginative storyteller',
                    systemPrompt: 'You are a creative writer. You use vivid imagery and engaging narratives.',
                    avatar: '🎨',
                    config: {
                        ...DEFAULT_CONFIG,
                        temperature: 1.0,
                        topK: 60
                    }
                }
            ],
            activePersonaId: 'default',
            addPersona: (persona) =>
                set((state) => ({
                    personas: [...state.personas, { ...persona, id: uuidv4() }],
                })),
            updatePersona: (id, updates) =>
                set((state) => ({
                    personas: state.personas.map((p) => (p.id === id ? { ...p, ...updates } : p)),
                })),
            deletePersona: (id) =>
                set((state) => ({
                    personas: state.personas.filter((p) => p.id !== id),
                    activePersonaId: state.activePersonaId === id ? null : state.activePersonaId,
                })),
            setActivePersona: (id) => set({ activePersonaId: id }),
            movePersona: (id, direction) =>
                set((state) => {
                    const index = state.personas.findIndex((p) => p.id === id);
                    if (index === -1) return state;

                    const newPersonas = [...state.personas];
                    if (direction === 'up') {
                        if (index === 0) return state;
                        [newPersonas[index - 1], newPersonas[index]] = [newPersonas[index], newPersonas[index - 1]];
                    } else {
                        if (index === newPersonas.length - 1) return state;
                        [newPersonas[index], newPersonas[index + 1]] = [newPersonas[index + 1], newPersonas[index]];
                    }
                    return { personas: newPersonas };
                }),
        }),
        {
            name: 'gemini-persona-storage',
            version: 1,
        }
    )
);
