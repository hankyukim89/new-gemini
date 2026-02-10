import React, { useState } from 'react';
import { useUsageStore, PRICING } from '../store/useUsageStore';
import { DollarSign, Activity, Info, X } from 'lucide-react';

export const UsageTracker: React.FC<{ compact?: boolean }> = ({ compact }) => {
    const { totalCost, totalInputTokens, totalOutputTokens } = useUsageStore();
    const [showDetails, setShowDetails] = useState(false);

    // Constants
    const CAD_RATE = 1.40;
    const WORDS_PER_1K_TOKENS = 750;

    const totalTokens = totalInputTokens + totalOutputTokens;
    const estimatedWords = (totalTokens / 1000) * WORDS_PER_1K_TOKENS;

    const CostDetailRow = ({ label, modelKey }: { label: string, modelKey: string }) => {
        const price = PRICING[modelKey as keyof typeof PRICING];
        if (!price) return null;

        const input1M = price.input * 1_000_000;
        const output1M = price.output * 1_000_000;

        // Cost for ~1M words (approx 1.33M tokens)
        // 1M words / 0.75 words/token = 1,333,333 tokens
        const tokensFor1MWords = 1_000_000 / (WORDS_PER_1K_TOKENS / 1000);
        const avgPricePerToken = (price.input + price.output) / 2; // Rough average
        const costPer1MWordsUSD = tokensFor1MWords * avgPricePerToken;

        return (
            <div className="grid grid-cols-4 gap-2 text-xs border-b border-gray-700/50 py-2 last:border-0 hover:bg-gray-800/30 px-2 rounded">
                <div className="font-medium text-gray-300 col-span-1">{label}</div>
                <div className="text-gray-400 font-mono text-right">
                    ${input1M.toFixed(2)} / ${output1M.toFixed(2)}
                    <div className="text-[9px] opacity-60">per 1M in/out</div>
                </div>
                <div className="text-emerald-400 font-mono text-right">
                    ${(input1M * CAD_RATE).toFixed(2)} / ${(output1M * CAD_RATE).toFixed(2)}
                    <div className="text-[9px] opacity-60">CAD per 1M</div>
                </div>
                <div className="text-blue-400 font-mono text-right">
                    ~${(costPer1MWordsUSD * CAD_RATE).toFixed(2)}
                    <div className="text-[9px] opacity-60">CAD / 1M Words</div>
                </div>
            </div>
        );
    };

    if (compact) {
        return (
            <>
                <div
                    onClick={() => setShowDetails(true)}
                    className="flex items-center gap-4 text-xs font-mono text-gray-400 cursor-pointer hover:text-white transition-colors"
                >
                    <div className="flex items-center gap-1.5" title="Total Tokens">
                        <Activity className="w-3 h-3 text-cyan-500" />
                        <span>{(totalTokens / 1000).toFixed(1)}k</span>
                    </div>
                    <div className="flex items-center gap-1" title="Estimated Cost">
                        <DollarSign className="w-3 h-3 text-green-500" />
                        <span>${totalCost.toFixed(4)}</span>
                    </div>
                </div>
                {showDetails && <CostModal onClose={() => setShowDetails(false)} totalCost={totalCost} totalTokens={totalTokens} estimatedWords={estimatedWords} CAD_RATE={CAD_RATE} CostDetailRow={CostDetailRow} />}
            </>
        );
    }

    return (
        <>
            <div className="text-white w-full">
                <h3 className="text-xs font-semibold uppercase text-gray-500 mb-3 flex items-center gap-2 tracking-wider justify-between group">
                    <div className="flex items-center gap-2">
                        <Activity className="w-3 h-3 text-cyan-400" /> Session Usage
                    </div>
                    <button
                        onClick={() => setShowDetails(true)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-gray-800 hover:bg-gray-700 px-2 py-0.5 rounded text-gray-300 flex items-center gap-1"
                    >
                        <Info className="w-3 h-3" /> Details
                    </button>
                </h3>

                <div
                    onClick={() => setShowDetails(true)}
                    className="grid grid-cols-2 gap-2 mb-3 cursor-pointer hover:opacity-90 transition-opacity"
                >
                    <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50 hover:bg-gray-800 hover:border-green-500/30 transition-colors">
                        <div className="text-[10px] uppercase text-gray-500 font-bold flex justify-between">
                            Cost (USD)
                        </div>
                        <div className="text-sm font-mono text-green-400 flex items-center gap-0.5">
                            <DollarSign className="w-3 h-3" />
                            {totalCost.toFixed(5)}
                        </div>
                    </div>
                    <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50 hover:bg-gray-800 hover:border-blue-500/30 transition-colors">
                        <div className="text-[10px] uppercase text-gray-500 font-bold">Tokens</div>
                        <div className="text-sm font-mono text-blue-400">
                            {(totalTokens / 1000).toFixed(1)}k
                        </div>
                    </div>
                </div>
            </div>
            {showDetails && <CostModal onClose={() => setShowDetails(false)} totalCost={totalCost} totalTokens={totalTokens} estimatedWords={estimatedWords} CAD_RATE={CAD_RATE} CostDetailRow={CostDetailRow} />}
        </>
    );
};

// --- Modal Component ---
const CostModal = ({ onClose, totalCost, totalTokens, estimatedWords, CAD_RATE, CostDetailRow }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    Usage & Cost Details
                </h2>
                <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-8">

                {/* 1. Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                        <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Total (USD)</div>
                        <div className="text-xl font-mono text-green-400">${totalCost.toFixed(5)}</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-1">
                            <span className="text-[9px] bg-red-900/50 text-red-200 px-1.5 py-0.5 rounded border border-red-800/50">CAD</span>
                        </div>
                        <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Total (CAD)</div>
                        <div className="text-xl font-mono text-emerald-300">
                            ${(totalCost * CAD_RATE).toFixed(4)}
                        </div>
                        <div className="text-[10px] text-gray-600 mt-1">1 USD = {CAD_RATE.toFixed(2)} CAD</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                        <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Total Tokens</div>
                        <div className="text-xl font-mono text-blue-400">{(totalTokens / 1000).toFixed(1)}k</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                        <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Est. Words</div>
                        <div className="text-xl font-mono text-yellow-400">~{(estimatedWords / 1000).toFixed(1)}k</div>
                        <div className="text-[10px] text-gray-600 mt-1">~750 words / 1k tokens</div>
                    </div>
                </div>

                {/* 2. Rate Table */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Model Rates Breakdown</h3>
                    <div className="bg-gray-900 rounded-lg border border-gray-800">
                        <div className="grid grid-cols-4 gap-2 text-[10px] uppercase text-gray-500 font-bold px-2 py-2 border-b border-gray-800">
                            <div className="col-span-1">Model</div>
                            <div className="text-right">Price (USD)</div>
                            <div className="text-right">Price (CAD)</div>
                            <div className="text-right">Est. 1M Words (CAD)</div>
                        </div>

                        <div className="divide-y divide-gray-800">
                            {/* Paid Models */}
                            {Object.keys(PRICING)
                                .filter(key => {
                                    const p = PRICING[key as keyof typeof PRICING];
                                    return p.input > 0 || p.output > 0;
                                })
                                .sort()
                                .map(key => (
                                    <CostDetailRow key={key} label={key} modelKey={key} />
                                ))
                            }

                            {/* Separator / Header for Free Models */}
                            <div className="px-2 py-1 bg-gray-800/50 text-[10px] font-bold text-gray-500 uppercase">Preview / Free Models</div>

                            {/* Free/Preview Models */}
                            {Object.keys(PRICING)
                                .filter(key => {
                                    const p = PRICING[key as keyof typeof PRICING];
                                    return p.input === 0 && p.output === 0;
                                })
                                .sort()
                                .map(key => (
                                    <CostDetailRow key={key} label={key} modelKey={key} />
                                ))
                            }
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">
                        * "1M Words" cost is an estimate based on 1M words ≈ 1.33 million tokens (avg 0.75 words/token).
                        Previews (Gemini 2.0, etc.) are currently free ($0).
                    </p>
                </div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800 bg-gray-900/50 rounded-b-xl flex justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors border border-gray-700"
                >
                    Close
                </button>
            </div>
        </div>
    </div>
);
