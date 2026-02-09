import React from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { Key, Volume2, X } from 'lucide-react';

const CLOUD_VOICES = [
    { id: 'en-US-Journey-D', name: 'Journey (Male)' },
    { id: 'en-US-Journey-F', name: 'Journey (Female)' },
    { id: 'en-US-Neural2-A', name: 'Neural2 (Male A)' },
    { id: 'en-US-Neural2-C', name: 'Neural2 (Female C)' },
    { id: 'en-US-Neural2-D', name: 'Neural2 (Male D)' },
    { id: 'en-US-Neural2-F', name: 'Neural2 (Female F)' },
    { id: 'en-GB-Neural2-A', name: 'British Neural2 (Female)' },
    { id: 'en-GB-Neural2-B', name: 'British Neural2 (Male)' },
];

interface GlobalSettingsModalProps {
    onClose: () => void;
}

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ onClose }) => {
    const { apiKey, setApiKey, ttsVoice, setTtsVoice } = useSettingsStore();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl relative">

                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">Global Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <Key className="w-4 h-4 text-blue-400" /> Google API Key
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                            placeholder="AIza..."
                        />
                        <p className="text-xs text-gray-500">
                            Required for Gemini models. Stored locally in your browser.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <Volume2 className="w-4 h-4 text-purple-400" /> TTS Voice
                        </label>
                        <select
                            value={ttsVoice}
                            onChange={(e) => setTtsVoice(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm"
                        >
                            <option value="">-- Browser Default --</option>
                            {CLOUD_VOICES.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500">
                            Premium voices (Journey/Neural2) require Google Cloud TTS permissions. Use browser default for free.
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-medium"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
