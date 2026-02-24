import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UsageRecord {
    timestamp: number;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
}

interface UsageState {
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    history: UsageRecord[];
    addUsage: (record: Omit<UsageRecord, 'timestamp' | 'cost'>) => void;
}

// PRICING (USD per token) - February 2026 Update
export const PRICING = {
    // Gemini 3 Series
    'gemini-3.1-pro': { input: 2.00 / 1_000_000, output: 12.00 / 1_000_000 },
    'gemini-3.0-pro': { input: 1.25 / 1_000_000, output: 5.00 / 1_000_000 },
    'gemini-3.0-flash': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
    'nano-banana-pro': { input: 0, output: 0 },

    // Gemini 2.5 Series
    'gemini-2.5-pro': { input: 1.25 / 1_000_000, output: 5.00 / 1_000_000 },
    'gemini-2.5-flash': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
    'gemini-2.5-flash-lite': { input: 0.0375 / 1_000_000, output: 0.15 / 1_000_000 },
    'nano-banana': { input: 0, output: 0 },

    // Audio & Media
    'gemini-2.5-flash-live': { input: 0, output: 0 },
    'gemini-2.5-flash-tts': { input: 0, output: 0 },
    'gemini-2.5-pro-tts': { input: 0, output: 0 },
    'lyria-experimental': { input: 0, output: 0 },
    'veo-3.1': { input: 0, output: 0 },
    'imagen-4': { input: 0, output: 0 },

    // Agents
    'computer-use': { input: 0, output: 0 },
    'gemini-deep-research': { input: 0, output: 0 },

    // Legacy / Others
    'gemini-1.5-pro': { input: 1.25 / 1_000_000, output: 5.00 / 1_000_000 },
    'gemini-1.5-flash': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
};


export const useUsageStore = create<UsageState>()(
    persist(
        (set) => ({
            totalCost: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            history: [],
            addUsage: (record) => {
                let price = PRICING[record.model as keyof typeof PRICING];

                // Fallback: If exact model not found, try to find a matching prefix (e.g. 'gemini-1.5-flash-001' might fallback to 'gemini-1.5-flash')
                if (!price) {
                    const baseModel = Object.keys(PRICING).find(key => record.model.startsWith(key));
                    if (baseModel) {
                        price = PRICING[baseModel as keyof typeof PRICING];
                    }
                }

                // Default to 0 if still not found
                if (!price) price = { input: 0, output: 0 };
                const cost = (record.inputTokens * price.input) + (record.outputTokens * price.output);

                set((state) => ({
                    totalCost: state.totalCost + cost,
                    totalInputTokens: state.totalInputTokens + record.inputTokens,
                    totalOutputTokens: state.totalOutputTokens + record.outputTokens,
                    history: [
                        ...state.history,
                        { ...record, timestamp: Date.now(), cost }
                    ]
                }));
            },
        }),
        {
            name: 'gemini-usage-storage',
        }
    )
);
