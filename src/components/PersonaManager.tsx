import React, { useState, useEffect } from 'react';
import { usePersonaStore, type Persona } from '../store/usePersonaStore';
import { X, Plus, Trash2, Save, Bot, BrainCircuit, Sparkles, MessageSquare } from 'lucide-react';
import { PLAYGROUND_MODELS } from '../services/geminiService';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface PersonaManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PersonaManager: React.FC<PersonaManagerProps> = ({ isOpen, onClose }) => {
    const { personas, addPersona, updatePersona, deletePersona, activePersonaId, setActivePersona } = usePersonaStore();
    const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Persona> | null>(null);

    // Initialize selection when opening
    useEffect(() => {
        if (isOpen && !selectedPersonaId) {
            setSelectedPersonaId(activePersonaId || personas[0]?.id || null);
        }
    }, [isOpen, activePersonaId, personas, selectedPersonaId]);

    // Update form when selection changes
    useEffect(() => {
        const persona = personas.find(p => p.id === selectedPersonaId);
        if (persona) {
            setFormData(JSON.parse(JSON.stringify(persona)));
        } else {
            setFormData(null);
        }
    }, [selectedPersonaId, personas]);

    if (!isOpen) return null;

    const handleCreateNew = () => {
        const newPersona: Persona = {
            id: uuidv4(),
            name: 'New Gem',
            description: 'A new custom AI assistant',
            systemPrompt: 'You are a helpful AI assistant.',
            avatar: '💎',
            config: {
                model: 'gemini-2.0-flash',
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            }
        };
        addPersona(newPersona);
        setSelectedPersonaId(newPersona.id);
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
                                className="px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Save
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
                                <div className="pt-6 border-t border-gray-800">
                                    <h4 className="text-lg font-semibold text-white mb-6">Model Configuration</h4>

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
                                                <div className="flex justify-between">
                                                    <label className="text-sm font-medium text-gray-400">Temperature</label>
                                                    <span className="text-sm text-blue-400 font-mono">{formData.config?.temperature}</span>
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
                                                <div className="flex justify-between">
                                                    <label className="text-sm font-medium text-gray-400">Top P</label>
                                                    <span className="text-sm text-blue-400 font-mono">{formData.config?.topP}</span>
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

                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <label className="text-sm font-medium text-gray-400">Top K</label>
                                                    <span className="text-sm text-blue-400 font-mono">{formData.config?.topK}</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    value={formData.config?.topK}
                                                    onChange={(e) => updateConfig('topK', parseInt(e.target.value))}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                                                />
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
