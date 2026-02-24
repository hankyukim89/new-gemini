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
    // Gemini 3.2 Series
    'gemini-3.2-pro': { input: 2.50 / 1_000_000, output: 15.00 / 1_000_000 },
    'gemini-3.2-flash': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },

    // Gemini 3.1 Series
    'gemini-3.1-pro': { input: 2.00 / 1_000_000, output: 12.00 / 1_000_000 },
    'gemini-3.1-flash': { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },

    // Gemini 3.0 Series
    'gemini-3.0-pro': { input: 1.25 / 1_000_000, output: 5.00 / 1_000_000 },
    'gemini-3.0-flash': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },

    // Gemini 2.5 Series
    'gemini-2.5-pro': { input: 1.25 / 1_000_000, output: 5.00 / 1_000_000 },
    'gemini-2.5-flash': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },

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
