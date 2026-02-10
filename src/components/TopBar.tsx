import React, { useState, useRef, useEffect } from 'react';
import { usePersonaStore } from '../store/usePersonaStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { UsageTracker } from './UsageTracker';
import { Settings, Sparkles, ChevronDown, Key, Box, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';
import { PersonaManager } from './PersonaManager';
import { GlobalSettingsModal } from './GlobalSettingsModal';

import { useChatStore, type MessageNode } from '../store/useChatStore';
import { MODEL_LIMITS } from '../services/geminiService';

interface TopBarProps {
    onOpenPersonaManager: () => void;
    onOpenSettings: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenPersonaManager, onOpenSettings }) => {
    const { activePersonaId, personas, setActivePersona } = usePersonaStore();
    const { currentSessionId, sessions } = useChatStore();
    const { apiKey } = useSettingsStore();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    const activePersona = personas.find(p => p.id === activePersonaId) || personas[0];
    const currentSession = sessions.find(s => s.id === currentSessionId);

    // Context Calculation
    const thread: MessageNode[] = [];
    if (currentSession && currentSession.currentLeafId) {
        let currentNodeId: string | null = currentSession.currentLeafId;
        while (currentNodeId) {
            const node: MessageNode = currentSession.messages[currentNodeId];
            if (node) {
                thread.unshift(node);
                currentNodeId = node.parentId;
            } else {
                break;
            }
        }
    }

    const contextTextLength = (activePersona?.systemPrompt?.length || 0) +
        (thread.reduce((acc, m) => acc + m.content.length, 0) || 0);
    const approxContextTokens = Math.ceil(contextTextLength / 4);
    const modelLimit = activePersona?.config?.model ? MODEL_LIMITS[activePersona.config.model] || 32000 : 32000;
    const contextHealth = Math.min((approxContextTokens / modelLimit) * 100, 100);
    let healthColor = "bg-green-500";
    if (contextHealth > 70) healthColor = "bg-yellow-500";
    if (contextHealth > 90) healthColor = "bg-red-500";

    return (
        <div className="h-16 border-b border-gray-800 bg-[#0f111a]/80 backdrop-blur-md flex items-center justify-between px-6 z-20 sticky top-0">
            {/* Left: Persona Selector */}
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800 transition-all text-gray-200 hover:text-white"
                >
                    <span className="text-xl">{activePersona?.avatar || '🤖'}</span>
                    <div className="flex flex-col items-start">
                        <span className="font-semibold text-sm flex items-center gap-2">
                            {activePersona?.name || 'Select Persona'}
                            <ChevronDown className="w-3 h-3 text-gray-500" />
                        </span>
                        <span className="text-xs text-gray-500">{activePersona?.config.model}</span>
                    </div>
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-[#131620] border border-gray-800 rounded-xl shadow-2xl overflow-hidden py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Select Gem
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {personas.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setActivePersona(p.id);
                                        setIsDropdownOpen(false);
                                    }}
                                    className={cn(
                                        "w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-gray-800 transition-all",
                                        activePersonaId === p.id ? "text-blue-400 bg-blue-900/10" : "text-gray-300"
                                    )}
                                >
                                    <span>{p.avatar}</span>
                                    <span className="flex-1 truncate">{p.name}</span>
                                    {activePersonaId === p.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-gray-800 my-1" />
                        <button
                            onClick={() => {
                                onOpenPersonaManager();
                                setIsDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-800 text-blue-400 font-medium transition-all"
                        >
                            <Box className="w-4 h-4" />
                            Manage Gems
                        </button>
                    </div>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-4">
                {/* Context Meter */}
                <div className="hidden md:flex flex-col items-end w-32 group cursor-help mr-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1 uppercase tracking-wider font-bold">
                        <Cpu className="w-3 h-3" />
                        <span>Context</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className={cn("h-full transition-all duration-500", healthColor)}
                            style={{ width: `${contextHealth}%` }}
                        />
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 absolute top-14 bg-black border border-gray-700 p-2 rounded text-xs text-gray-300 z-50 pointer-events-none w-48 shadow-xl">
                        Using ~{approxContextTokens.toLocaleString()} of {modelLimit.toLocaleString()} tokens ({contextHealth.toFixed(1)}%).
                    </div>
                </div>

                <div className="h-6 w-px bg-gray-800" />

                <UsageTracker compact />

                <div className="h-6 w-px bg-gray-800" />

                <button
                    onClick={onOpenSettings}
                    className={cn(
                        "p-2 rounded-lg transition-all",
                        !apiKey ? "bg-red-500/10 text-red-400 animate-pulse" : "text-gray-400 hover:text-white hover:bg-gray-800"
                    )}
                    title="API Key Settings"
                >
                    {apiKey ? <Settings className="w-5 h-5" /> : <Key className="w-5 h-5" />}
                </button>
            </div>


        </div>
    );
};
