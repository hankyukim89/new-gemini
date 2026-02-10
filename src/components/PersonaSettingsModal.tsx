import React, { useState, useEffect } from 'react';
import { usePersonaStore, type Persona } from '../store/usePersonaStore';
import { X, Check, Info } from 'lucide-react';
import { PLAYGROUND_MODELS } from '../services/geminiService';

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative inline-block ml-2 cursor-help">
        <div className="bg-gray-800 p-0.5 rounded-full border border-gray-700 hover:border-blue-500 transition-colors">
            <Info className="w-3 h-3 text-gray-400 group-hover:text-blue-400" />
        </div>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-gray-900 border border-gray-700 text-xs text-gray-300 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-center pointer-events-none data-[side=top]:animate-slide-up-fade">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-gray-700"></div>
        </div>
    </div>
);

interface PersonaSettingsModalProps {
    personaId: string;
    onClose: () => void;
}

export const PersonaSettingsModal: React.FC<PersonaSettingsModalProps> = ({ personaId, onClose }) => {
    const { personas, updatePersona } = usePersonaStore();
    const persona = personas.find(p => p.id === personaId);

    const [formData, setFormData] = useState<Partial<Persona> | null>(null);

    useEffect(() => {
        if (persona) {
            setFormData(JSON.parse(JSON.stringify(persona)));
        }
    }, [persona]);

    if (!persona || !formData) return null;

    const handleChange = (field: keyof Persona, value: any) => {
        setFormData(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleConfigChange = (field: string, value: any) => {
        setFormData(prev => prev ? {
            ...prev,
            config: {
                ...prev.config!,
                [field]: value
            }
        } : null);
    };

    const handleSave = () => {
        if (formData) {
            updatePersona(personaId, formData);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/50">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Persona Settings
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">

                    {/* Basic Info Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-400">Name</label>
                            <input
                                type="text"
                                value={formData.name || ''}
                                onChange={e => handleChange('name', e.target.value)}
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="e.g. Coding Assistant"
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-400">Avatar (Emoji)</label>
                            <input
                                type="text"
                                value={formData.avatar || ''}
                                onChange={e => handleChange('avatar', e.target.value)}
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="e.g. 🤖"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2 space-y-4">
                            <label className="block text-sm font-medium text-gray-400">Description</label>
                            <input
                                type="text"
                                value={formData.description || ''}
                                onChange={e => handleChange('description', e.target.value)}
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="Brief description of the persona..."
                            />
                        </div>
                    </div>

                    {/* System Prompt - Big Area */}
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-blue-400">System Prompt / Instructions</label>
                        <textarea
                            value={formData.systemPrompt || ''}
                            onChange={e => handleChange('systemPrompt', e.target.value)}
                            className="w-full h-64 bg-gray-950 border border-gray-800 rounded-lg p-4 text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                            placeholder="You are a helpful assistant..."
                        />
                        <p className="text-xs text-gray-500">This defines the core behavior and personality of the AI.</p>
                    </div>

                    {/* Advanced Configuration */}
                    <div className="bg-gray-950/50 rounded-xl p-6 border border-gray-800 space-y-6">
                        <h3 className="text-lg font-semibold text-white">Model Parameters</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-400">Model</label>
                                <select
                                    value={formData.config?.model || 'gemini-pro'}
                                    onChange={e => handleConfigChange('model', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {PLAYGROUND_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg">
                                <label className="flex items-center text-sm font-medium text-gray-400">
                                    Chat Mode
                                    <InfoTooltip text="Splits AI responses into separate messages based on sentences, simulating a real-time chat experience." />
                                </label>
                                <button
                                    onClick={() => handleChange('isChatMode', !formData.isChatMode)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${formData.isChatMode ? 'bg-blue-600' : 'bg-gray-700'}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isChatMode ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center text-sm font-medium text-gray-400">
                                    Temperature
                                    <InfoTooltip text="Controls randomness. Higher values (e.g., 0.8) make output more random, while lower values (e.g., 0.2) make it more focused and deterministic." />
                                    <span className="ml-auto text-blue-400 font-mono text-xs">{formData.config?.temperature}</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={formData.config?.temperature ?? 0.7}
                                    onChange={e => handleConfigChange('temperature', parseFloat(e.target.value))}
                                    className="w-full accent-blue-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer hover:bg-gray-700 transition-colors"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center text-sm font-medium text-gray-400">
                                    Top K
                                    <InfoTooltip text="Limits the model to choose from the top K most likely tokens. Lower values reduce randomness." />
                                    <span className="ml-auto text-blue-400 font-mono text-xs">{formData.config?.topK}</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={formData.config?.topK ?? 40}
                                    onChange={e => handleConfigChange('topK', parseInt(e.target.value))}
                                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-700 transition-colors text-sm"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center text-sm font-medium text-gray-400">
                                    Top P
                                    <InfoTooltip text="Limits the model to the cumulative probability of the top tokens. Lower values make the output more focused." />
                                    <span className="ml-auto text-blue-400 font-mono text-xs">{formData.config?.topP}</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={formData.config?.topP ?? 0.95}
                                    onChange={e => handleConfigChange('topP', parseFloat(e.target.value))}
                                    className="w-full accent-blue-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer hover:bg-gray-700 transition-colors"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center text-sm font-medium text-gray-400">
                                    Max Output Tokens
                                    <InfoTooltip text="The maximum number of tokens to generate in the response. Increase this for longer outputs." />
                                    <span className="ml-auto text-blue-400 font-mono text-xs">{formData.config?.maxOutputTokens}</span>
                                </label>
                                <input
                                    type="number"
                                    min="100"
                                    max="81920"
                                    step="100"
                                    value={formData.config?.maxOutputTokens ?? 8192}
                                    onChange={e => handleConfigChange('maxOutputTokens', parseInt(e.target.value))}
                                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-700 transition-colors text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-800 bg-gray-950/50 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all font-medium flex items-center gap-2"
                    >
                        <Check className="w-5 h-5" /> Save Changes
                    </button>
                </div>

            </div>
        </div>
    );
};
