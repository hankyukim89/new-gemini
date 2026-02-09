import React from 'react';
import { useUsageStore } from '../store/useUsageStore';
import { DollarSign, Activity } from 'lucide-react';

export const UsageTracker: React.FC<{ compact?: boolean }> = ({ compact }) => {
    const { totalCost, totalInputTokens, totalOutputTokens } = useUsageStore();

    if (compact) {
        return (
            <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
                <div className="flex items-center gap-1.5" title="Total Tokens">
                    <Activity className="w-3 h-3 text-cyan-500" />
                    <span className="text-white">{((totalInputTokens + totalOutputTokens) / 1000).toFixed(1)}k</span>
                </div>
                <div className="flex items-center gap-1" title="Estimated Cost">
                    <DollarSign className="w-3 h-3 text-green-500" />
                    <span className="text-white">${totalCost.toFixed(4)}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="text-white w-full">
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-3 flex items-center gap-2 tracking-wider">
                <Activity className="w-3 h-3 text-cyan-400" /> Session Usage
            </h3>

            <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                    <div className="text-[10px] uppercase text-gray-500 font-bold">Cost</div>
                    <div className="text-sm font-mono text-green-400 flex items-center gap-0.5">
                        <DollarSign className="w-3 h-3" />
                        {totalCost.toFixed(5)}
                    </div>
                </div>
                <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                    <div className="text-[10px] uppercase text-gray-500 font-bold">Tokens</div>
                    <div className="text-sm font-mono text-blue-400">
                        {((totalInputTokens + totalOutputTokens) / 1000).toFixed(1)}k
                    </div>
                </div>
            </div>
        </div>
    );
};
