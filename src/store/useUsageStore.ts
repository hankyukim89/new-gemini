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

// Mock pricing - could be replaced with real API pricing if known
export const PRICING = {
    // 1.5 Pro (Standard) - $3.50 / $10.50 per 1M tokens (assuming <128k context for simplicity)
    'gemini-1.5-pro': { input: 3.50 / 1_000_000, output: 10.50 / 1_000_000 },
    'gemini-1.5-pro-latest': { input: 3.50 / 1_000_000, output: 10.50 / 1_000_000 },
    'gemini-1.5-pro-001': { input: 3.50 / 1_000_000, output: 10.50 / 1_000_000 },
    'gemini-1.5-pro-002': { input: 3.50 / 1_000_000, output: 10.50 / 1_000_000 },

    // 1.5 Flash (High Efficiency) - $0.075 / $0.30 per 1M tokens
    'gemini-1.5-flash': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
    'gemini-1.5-flash-latest': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
    'gemini-1.5-flash-001': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
    'gemini-1.5-flash-002': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
    'gemini-1.5-flash-8b': { input: 0.0375 / 1_000_000, output: 0.15 / 1_000_000 },


    // 1.0 Pro - $0.50 / $1.50 per 1M tokens
    'gemini-1.0-pro': { input: 0.50 / 1_000_000, output: 1.50 / 1_000_000 },
    'gemini-pro': { input: 0.50 / 1_000_000, output: 1.50 / 1_000_000 },

    // 2.0 Flash (Preview) - Currently Free
    'gemini-2.0-flash': { input: 0, output: 0 },
    'gemini-2.0-flash-exp': { input: 0, output: 0 },
    'gemini-2.0-flash-lite-preview-02-05': { input: 0, output: 0 },
    'gemini-2.0-pro-exp-02-05': { input: 0, output: 0 },

    // Future/Preview Models (Assume Free for now)
    'gemini-2.0-flash-lite': { input: 0, output: 0 },
    'gemini-2.5-pro': { input: 0, output: 0 },
    'gemini-2.5-flash': { input: 0, output: 0 },
    'gemini-2.5-flash-lite': { input: 0, output: 0 },
    'gemini-3-pro-preview': { input: 0, output: 0 },
    'gemini-3-flash-preview': { input: 0, output: 0 },
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
