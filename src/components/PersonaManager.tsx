import React, { useState, useEffect } from 'react';
import { usePersonaStore, type Persona, DEFAULT_CONFIG } from '../store/usePersonaStore';
import { X, Plus, Trash2, Save, Bot, BrainCircuit, Sparkles, MessageSquare, Info, RotateCcw, Shield, Sliders, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { PLAYGROUND_MODELS, MODEL_LIMITS } from '../services/geminiService';
import { cn } from '../lib/utils';


interface PersonaManagerProps {
    isOpen: boolean;
    onClose: () => void;
}


const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative inline-block ml-2 cursor-help align-middle">
        <Info className="w-4 h-4 text-gray-400 hover:text-blue-400 transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 border border-gray-700 text-xs text-gray-300 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-center pointer-events-none data-[side=top]:animate-slide-up-fade">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-gray-700"></div>
        </div>
    </div>
);

// --- Constants for Safety Settings ---
const HARM_CATEGORIES = [
    { id: 'HARM_CATEGORY_HARASSMENT', label: 'Harassment' },
    { id: 'HARM_CATEGORY_HATE_SPEECH', label: 'Hate Speech' },
    { id: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', label: 'Sexually Explicit' },
    { id: 'HARM_CATEGORY_DANGEROUS_CONTENT', label: 'Dangerous Content' },
];

const BLOCK_THRESHOLDS = [
    { value: 'BLOCK_NONE', label: 'None', description: 'No blocking' },
    { value: 'BLOCK_ONLY_HIGH', label: 'Few', description: 'Block only high probability' },
    { value: 'BLOCK_MEDIUM_AND_ABOVE', label: 'Some', description: 'Block medium and high probability' },
    { value: 'BLOCK_LOW_AND_ABOVE', label: 'Most', description: 'Block low, medium, and high probability' },
];

export const PersonaManager: React.FC<PersonaManagerProps> = ({ isOpen, onClose }) => {
    const { personas, addPersona, updatePersona, deletePersona, activePersonaId } = usePersonaStore();
    const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Persona> | null>(null);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

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

    const handleSafetyChange = (category: string, threshold: string) => {
        setFormData(prev => {
            if (!prev || !prev.config) return null;

            const currentSettings = prev.config.safetySettings || [];
            const otherSettings = currentSettings.filter(s => s.category !== category);

            return {
                ...prev,
                config: {
                    ...prev.config,
                    safetySettings: [...otherSettings, { category, threshold }]
                }
            };
        });
    };

    const getSafetyValue = (category: string) => {
        const setting = formData?.config?.safetySettings?.find(s => s.category === category);
        return setting?.threshold || 'BLOCK_MEDIUM_AND_ABOVE'; // Default
    };

    const handleResetDefaults = () => {
        if (!formData) return;
        setFormData(prev => prev ? {
            ...prev,
            config: { ...DEFAULT_CONFIG, model: prev.config?.model || DEFAULT_CONFIG.model }
        } : null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true">
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
                                        <div onClick={(e) => e.stopPropagation()}>
                                            {deleteConfirmationId === persona.id ? (
                                                <div className="flex items-center gap-2 animate-in fade-in duration-200">
                                                    <span className="text-xs text-red-400 font-medium">Sure?</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(persona.id);
                                                            setDeleteConfirmationId(null);
                                                        }}
                                                        className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded transition-all"
                                                    >
                                                        <Check className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeleteConfirmationId(null);
                                                        }}
                                                        className="p-1.5 bg-gray-800 text-gray-400 hover:text-white rounded transition-all"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirmationId(persona.id);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
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
                        </div>
                        <div className="flex items-center gap-3">
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

                                {/* Model & Behavior */}
                                <div className="pt-6 border-t border-gray-800">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="text-lg font-semibold text-white">Model Behavior</h4>
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

                                        <div className="flex items-center justify-between p-4 bg-gray-900 border border-gray-700 rounded-xl">
                                            <label className="flex items-center text-sm font-medium text-gray-400">
                                                Chat Mode
                                                <InfoTooltip text="Splits AI responses into separate messages based on sentences, simulating a real-time chat experience." />
                                            </label>
                                            <button
                                                onClick={() => updateField('isChatMode', !formData.isChatMode)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${formData.isChatMode ? 'bg-blue-600' : 'bg-gray-700'}`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isChatMode ? 'translate-x-6' : 'translate-x-1'}`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Advanced Settings (Collapsible) */}
                                <div className="bg-gray-950/30 rounded-xl border border-gray-800 overflow-hidden">
                                    <button
                                        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                        className="w-full p-4 flex items-center justify-between bg-gray-900/50 hover:bg-gray-900 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 font-semibold text-white">
                                            <Sliders className="w-5 h-5 text-purple-400" />
                                            Advanced Settings
                                        </div>
                                        {isAdvancedOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    </button>

                                    {isAdvancedOpen && (
                                        <div className="p-6 space-y-8 animate-in slide-in-from-top-2 duration-200 border-t border-gray-800">

                                            {/* Technical Params */}
                                            <div className="space-y-6">
                                                <h5 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Parameters</h5>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                                                    {/* Temperature */}
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

                                                    {/* Top P */}
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

                                                    {/* Top K */}
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

                                                    {/* Max Output Tokens */}
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
                                                                max={MODEL_LIMITS[formData.config?.model || 'gemini-3.0-flash'] || 8192}
                                                                step="100"
                                                                value={formData.config?.maxOutputTokens || 8192}
                                                                onChange={(e) => updateConfig('maxOutputTokens', parseInt(e.target.value))}
                                                                className="flex-1 accent-blue-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                                                            />
                                                            <input
                                                                type="number"
                                                                min="100"
                                                                max={MODEL_LIMITS[formData.config?.model || 'gemini-3.0-flash'] || 81920}
                                                                step="100"
                                                                value={formData.config?.maxOutputTokens || 8192}
                                                                onChange={(e) => updateConfig('maxOutputTokens', parseInt(e.target.value))}
                                                                className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-right text-sm text-white focus:border-blue-500 outline-none transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Safety Settings */}
                                            <div className="space-y-6 pt-6 border-t border-gray-800">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="w-5 h-5 text-blue-400" />
                                                    <h5 className="text-base font-semibold text-white">Run Safety Settings</h5>
                                                </div>
                                                <p className="text-sm text-gray-400 -mt-2">Adjust content filtering thresholds.</p>

                                                {/* Warning Banner */}
                                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex gap-3">
                                                    <div className="text-yellow-500 mt-0.5">⚠️</div>
                                                    <div className="flex-1">
                                                        <p className="text-xs text-yellow-200/90 leading-relaxed">
                                                            <strong>Note:</strong> Google enforces server-side content filtering that cannot be fully disabled.
                                                            Even with all settings set to "None", certain harmful content may still be blocked by Google's API.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                                    {HARM_CATEGORIES.map(category => (
                                                        <div key={category.id} className="space-y-3">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-gray-300 font-medium">{category.label}</span>
                                                                <span className="text-blue-400 font-mono text-xs bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                                                    {BLOCK_THRESHOLDS.find(t => t.value === getSafetyValue(category.id))?.label}
                                                                </span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="3"
                                                                step="1"
                                                                value={BLOCK_THRESHOLDS.findIndex(t => t.value === getSafetyValue(category.id))}
                                                                onChange={(e) => {
                                                                    const index = parseInt(e.target.value);
                                                                    handleSafetyChange(category.id, BLOCK_THRESHOLDS[index].value);
                                                                }}
                                                                className="w-full accent-blue-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer hover:bg-gray-700 transition-colors"
                                                            />
                                                            <div className="flex justify-between text-[10px] text-gray-600 uppercase tracking-widest px-1">
                                                                <span>None</span>
                                                                <span>Most</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                        </div>
                                    )}
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
