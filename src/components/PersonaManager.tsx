import React, { useState, useEffect } from 'react';
import { usePersonaStore, type Persona, DEFAULT_CONFIG } from '../store/usePersonaStore';
import { X, Plus, Trash2, Save, Bot, BrainCircuit, Sparkles, MessageSquare, Info, RotateCcw } from 'lucide-react';
import { PLAYGROUND_MODELS, MODEL_LIMITS } from '../services/geminiService';
import { cn } from '../lib/utils';


interface PersonaManagerProps {
    isOpen: boolean;
    onClose: () => void;
}


const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative inline-block ml-2 cursor-help align-middle">
        <Info className="w-4 h-4 text-gray-400 hover:text-blue-400 transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 border border-gray-700 text-xs text-gray-300 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-center pointer-events-none">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-gray-700"></div>
        </div>
    </div>
);

export const PersonaManager: React.FC<PersonaManagerProps> = ({ isOpen, onClose }) => {
    const { personas, addPersona, updatePersona, deletePersona, activePersonaId, setActivePersona } = usePersonaStore();
    const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Persona> | null>(null);

    // Initialize selection when opening
    useEffect(() => {
        if (isOpen) {
            setSelectedPersonaId(activePersonaId || personas[0]?.id || null);
        } else {
            setSelectedPersonaId(null);
        }
    }, [isOpen]);

    // Update form when selection changes
    useEffect(() => {
        const persona = personas.find(p => p.id === selectedPersonaId);
        if (persona) {
            setFormData(JSON.parse(JSON.stringify(persona)));
        } else {
            setFormData(null);
        }
    }, [selectedPersonaId, personas]);

    // --- Dirty Checking (must be before early return to respect Rules of Hooks) ---
    const originalPersona = personas.find(p => p.id === selectedPersonaId);
    const hasChanges = React.useMemo(() => {
        if (!originalPersona || !formData) return false;
        return JSON.stringify(originalPersona) !== JSON.stringify(formData);
    }, [originalPersona, formData]);

    if (!isOpen) return null;

    const handleCreateNew = () => {
        addPersona({
            name: 'New Gem',
            description: 'A new custom AI assistant',
            systemPrompt: 'You are a helpful AI assistant.',
            avatar: '💎',
            config: { ...DEFAULT_CONFIG }
        });
        // The store assigns the ID via uuidv4(); find it as the last persona
        // We need to get the updated personas list after the add
        setTimeout(() => {
            const updatedPersonas = usePersonaStore.getState().personas;
            const lastPersona = updatedPersonas[updatedPersonas.length - 1];
            if (lastPersona) {
                setSelectedPersonaId(lastPersona.id);
            }
        }, 0);
    };

    const handleSave = () => {
        if (selectedPersonaId && formData) {
            updatePersona(selectedPersonaId, formData);
        }
    };

    const handleDelete = (id: string) => {
        if (personas.length <= 1) return; // Prevent deleting last persona
        deletePersona(id);
        if (selectedPersonaId === id) {
            setSelectedPersonaId(personas[0].id);
        }
    };

    const updateField = (field: keyof Persona, value: any) => {
        setFormData(prev => prev ? { ...prev, [field]: value } : null);
    };

    const updateConfig = (field: string, value: any) => {
        setFormData(prev => prev ? {
            ...prev,
            config: { ...prev.config!, [field]: value }
        } : null);
    };

    const handleResetDefaults = () => {
        if (!formData) return;
        setFormData(prev => prev ? {
            ...prev,
            config: { ...DEFAULT_CONFIG, model: prev.config?.model || DEFAULT_CONFIG.model }
        } : null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0f111a] w-full h-full md:w-[95vw] md:h-[90vh] md:rounded-2xl shadow-2xl flex overflow-hidden border border-gray-800">

                {/* Left Sidebar: Persona List */}
                <div className="w-80 border-r border-gray-800 bg-[#131620] flex flex-col">
                    <div className="p-6 border-b border-gray-800">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-blue-400" />
                            My Gems
                        </h2>
                        <button
                            onClick={handleCreateNew}
                            className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2 transition-all font-medium text-sm"
                        >
                            <Plus className="w-4 h-4" /> New Gem
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {personas.map(persona => (
                            <div
                                key={persona.id}
                                onClick={() => setSelectedPersonaId(persona.id)}
                                className={cn(
                                    "p-3 rounded-xl cursor-pointer transition-all border border-transparent group",
                                    selectedPersonaId === persona.id
                                        ? "bg-blue-900/20 border-blue-500/30 text-white"
                                        : "hover:bg-gray-800/50 text-gray-400 hover:text-gray-200"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{persona.avatar}</span>
                                        <div className="flex flex-col">
                                            <span className="font-medium truncate max-w-[140px]">{persona.name}</span>
                                            <span className="text-xs text-gray-500 truncate max-w-[140px]">{persona.config.model}</span>
                                        </div>
                                    </div>
                                    {personas.length > 1 && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(persona.id); }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content: Editor */}
                <div className="flex-1 flex flex-col bg-[#0f111a] min-w-0">
                    {/* Editor Header */}
                    <div className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-[#131620]/50 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-semibold text-white">Edit Gem</h3>
                            {formData?.id === activePersonaId && (
                                <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20">
                                    Active Use
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    if (selectedPersonaId) setActivePersona(selectedPersonaId);
                                }}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                                    formData?.id === activePersonaId
                                        ? "bg-green-600/10 border-green-600/30 text-green-400 cursor-default"
                                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                                )}
                            >
                                {formData?.id === activePersonaId ? "Currently Active" : "Set as Active"}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!hasChanges}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                                    hasChanges
                                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                                        : "bg-gray-800 text-gray-500 cursor-not-allowed"
                                )}
                            >
                                <Save className="w-4 h-4" />
                                {hasChanges ? "Save Changes" : "Saved"}
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Editor Body */}
                    {formData ? (
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="max-w-4xl mx-auto space-y-8">

                                {/* Identity Section */}
                                <div className="grid grid-cols-[auto_1fr] gap-6 items-start">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-400">Avatar</label>
                                        <input
                                            type="text"
                                            value={formData.avatar}
                                            onChange={(e) => updateField('avatar', e.target.value)}
                                            className="w-16 h-16 text-center text-3xl bg-gray-900 border border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => updateField('name', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all"
                                                placeholder="Name your Gem"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                                            <input
                                                type="text"
                                                value={formData.description}
                                                onChange={(e) => updateField('description', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all"
                                                placeholder="What does this Gem do?"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Instructions */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-400">Instructions</label>
                                    <div className="relative">
                                        <textarea
                                            value={formData.systemPrompt}
                                            onChange={(e) => updateField('systemPrompt', e.target.value)}
                                            className="w-full h-64 bg-gray-900 border border-gray-700 rounded-2xl p-6 text-white font-mono text-sm leading-relaxed focus:border-blue-500 outline-none transition-all resize-none"
                                            placeholder="Give your Gem instructions on how to behave..."
                                        />
                                        <BrainCircuit className="absolute right-4 top-4 text-gray-600 w-5 h-5" />
                                    </div>
                                    <p className="text-xs text-gray-500">System prompt defines the core personality and rules.</p>
                                </div>

                                {/* Advanced Settings */}
                                <div className="pt-6 border-t border-gray-800 relative">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="text-lg font-semibold text-white">Model Configuration</h4>
                                        <button
                                            onClick={handleResetDefaults}
                                            className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
                                            title="Reset to recommended defaults"
                                        >
                                            <RotateCcw className="w-3 h-3" /> Reset Defaults
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-400">Model</label>
                                            <select
                                                value={formData.config?.model}
                                                onChange={(e) => updateConfig('model', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none appearance-none"
                                            >
                                                {PLAYGROUND_MODELS.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center">
                                                    <label className="text-sm font-medium text-gray-400">Temperature</label>
                                                    <InfoTooltip text="Controls randomness. Higher values (e.g., 0.8) make output more random, while lower values (e.g., 0.2) make it more focused and deterministic." />
                                                    <span className="ml-auto text-sm text-blue-400 font-mono">{formData.config?.temperature}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="2"
                                                    step="0.1"
                                                    value={formData.config?.temperature}
                                                    onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                                                    className="w-full accent-blue-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center">
                                                    <label className="text-sm font-medium text-gray-400">Top P</label>
                                                    <InfoTooltip text="Limits the model to the cumulative probability of the top tokens. Lower values make the output more focused." />
                                                    <span className="ml-auto text-sm text-blue-400 font-mono">{formData.config?.topP}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.05"
                                                    value={formData.config?.topP}
                                                    onChange={(e) => updateConfig('topP', parseFloat(e.target.value))}
                                                    className="w-full accent-blue-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center">
                                                    <label className="text-sm font-medium text-gray-400">Top K</label>
                                                    <InfoTooltip text="Limits the model to choose from the top K most likely tokens. Lower values reduce randomness." />
                                                    <span className="ml-auto text-sm text-blue-400 font-mono">{formData.config?.topK}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="100"
                                                        step="1"
                                                        value={formData.config?.topK}
                                                        onChange={(e) => updateConfig('topK', parseInt(e.target.value))}
                                                        className="flex-1 accent-blue-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="100"
                                                        value={formData.config?.topK}
                                                        onChange={(e) => updateConfig('topK', parseInt(e.target.value))}
                                                        className="w-16 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-right text-sm text-white focus:border-blue-500 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center">
                                                    <label className="text-sm font-medium text-gray-400">Max Output Tokens</label>
                                                    <InfoTooltip text="The maximum number of tokens to generate in the response. Increase this for longer outputs (up to 81920)." />
                                                    <span className="ml-auto text-sm text-blue-400 font-mono">{formData.config?.maxOutputTokens}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <input
                                                        type="range"
                                                        min="100"
                                                        max={MODEL_LIMITS[formData.config?.model || 'gemini-2.0-flash'] || 8192}
                                                        step="100"
                                                        value={formData.config?.maxOutputTokens || 8192}
                                                        onChange={(e) => updateConfig('maxOutputTokens', parseInt(e.target.value))}
                                                        className="flex-1 accent-blue-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="100"
                                                        max={MODEL_LIMITS[formData.config?.model || 'gemini-2.0-flash'] || 81920}
                                                        step="100"
                                                        value={formData.config?.maxOutputTokens || 8192}
                                                        onChange={(e) => updateConfig('maxOutputTokens', parseInt(e.target.value))}
                                                        className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-right text-sm text-white focus:border-blue-500 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            Select a Gem to edit
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
