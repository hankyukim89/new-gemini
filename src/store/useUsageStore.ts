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
const PRICING = {
    'gemini-2.0-flash': { input: 0.0001 / 1000, output: 0.0004 / 1000 }, // Estimated
    'gemini-2.5-pro': { input: 0.0025 / 1000, output: 0.0075 / 1000 },   // Estimated
    'gemini-exp-1206': { input: 0, output: 0 },                          // Free preview usually
    'nano-banana-pro-preview': { input: 0, output: 0 },                  // Free
};

export const useUsageStore = create<UsageState>()(
    persist(
        (set) => ({
            totalCost: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            history: [],
            addUsage: (record) => {
                const price = PRICING[record.model as keyof typeof PRICING] || { input: 0, output: 0 };
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
