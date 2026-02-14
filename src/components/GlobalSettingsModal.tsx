import React from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { Key, Volume2, X, Mic, Check, Keyboard, PlayCircle, Clock } from 'lucide-react';




interface GlobalSettingsModalProps {
    onClose: () => void;
}

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ onClose }) => {
    const {
        apiKey, setApiKey,
        ttsVoice, setTtsVoice,
        useOfflineSTT, setUseOfflineSTT,
        autoSpeak, setAutoSpeak,
        enableGrammarCheck, setEnableGrammarCheck,
        usePushToTalk, setUsePushToTalk,
        pushToTalkKey, setPushToTalkKey,
        pushToTalkRedoKey, setPushToTalkRedoKey
    } = useSettingsStore();

    const [browserVoices, setBrowserVoices] = React.useState<SpeechSynthesisVoice[]>([]);
    const [isLearningKey, setIsLearningKey] = React.useState(false);
    const [isLearningRedoKey, setIsLearningRedoKey] = React.useState(false);

    // Key Learning Logic
    React.useEffect(() => {
        if (!isLearningKey) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // Generate a display name for the key
            let keyName = e.code;
            if (e.code === 'Space') keyName = 'Space';
            if (e.key.length === 1) keyName = e.key.toUpperCase();

            setPushToTalkKey(e.code); // Save the code (e.g., 'KeyA', 'Space')
            setIsLearningKey(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLearningKey, setPushToTalkKey]);

    // Redo Key Learning Logic
    React.useEffect(() => {
        if (!isLearningRedoKey) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setPushToTalkRedoKey(e.code);
            setIsLearningRedoKey(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLearningRedoKey, setPushToTalkRedoKey]);

    React.useEffect(() => {
        const loadVoices = () => {
            setBrowserVoices(window.speechSynthesis.getVoices());
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
        return () => { window.speechSynthesis.onvoiceschanged = null; };
    }, []);

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
                            <option value="">-- Default Voice --</option>
                            {browserVoices.filter(v => v.lang.startsWith('en')).map(v => (
                                <option key={v.voiceURI} value={v.voiceURI}>
                                    {v.name} ({v.lang})
                                </option>
                            ))}
                            {browserVoices.filter(v => !v.lang.startsWith('en')).length > 0 && (
                                <optgroup label="Other Languages">
                                    {browserVoices.filter(v => !v.lang.startsWith('en')).map(v => (
                                        <option key={v.voiceURI} value={v.voiceURI}>
                                            {v.name} ({v.lang})
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                        <p className="text-xs text-gray-500">
                            Free browser voices. Edge has high-quality Microsoft voices; Chrome has Google voices.
                        </p>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-gray-400">Offline Speech-to-Text</label>
                            <p className="text-xs text-gray-500">Use local Whisper model (Download ~40MB once)</p>
                        </div>
                        <button
                            onClick={() => setUseOfflineSTT(!useOfflineSTT)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${useOfflineSTT ? 'bg-blue-600' : 'bg-gray-700'}`}
                        >
                            <span
                                className={`${useOfflineSTT ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                            />
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-gray-400">Auto-Read Responses</label>
                            <p className="text-xs text-gray-500">Automatically speak AI responses</p>
                        </div>
                        <button
                            onClick={() => setAutoSpeak(!autoSpeak)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${autoSpeak ? 'bg-blue-600' : 'bg-gray-700'}`}
                        >
                            <span
                                className={`${autoSpeak ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                            />
                        </button>
                    </div>

                    {/* Grammar Check Toggle */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-gray-400">Grammar Check</label>
                            <p className="text-xs text-gray-500">Analyze messages for grammar errors</p>
                        </div>
                        <button
                            onClick={() => setEnableGrammarCheck(!enableGrammarCheck)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${enableGrammarCheck ? 'bg-blue-600' : 'bg-gray-700'}`}
                        >
                            <span
                                className={`${enableGrammarCheck ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                            />
                        </button>
                    </div>

                    {/* Push to Talk Section */}
                    <div className="space-y-3 pt-4 border-t border-gray-800">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium text-gray-400">Push-to-Talk Mode</label>
                                <p className="text-xs text-gray-500">Hold key to speak, release to send</p>
                            </div>
                            <button
                                onClick={() => setUsePushToTalk(!usePushToTalk)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${usePushToTalk ? 'bg-blue-600' : 'bg-gray-700'}`}
                            >
                                <span
                                    className={`${usePushToTalk ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                />
                            </button>
                        </div>

                        {usePushToTalk && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between bg-gray-950 p-3 rounded-lg border border-gray-800">
                                    <span className="text-sm text-gray-400">Send Key</span>
                                    <button
                                        onClick={() => setIsLearningKey(true)}
                                        className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-all ${isLearningKey ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/50' : 'bg-gray-800 text-white border border-gray-700 hover:bg-gray-700'}`}
                                    >
                                        {isLearningKey ? 'Listening...' : (pushToTalkKey || 'Space')}
                                    </button>
                                </div>
                                <div className="flex items-center justify-between bg-gray-950 p-3 rounded-lg border border-gray-800">
                                    <div>
                                        <span className="text-sm text-gray-400">Redo Key</span>
                                        <p className="text-xs text-gray-600">Hold to re-speak your last message</p>
                                    </div>
                                    <button
                                        onClick={() => setIsLearningRedoKey(true)}
                                        className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-all ${isLearningRedoKey ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/50' : 'bg-gray-800 text-white border border-gray-700 hover:bg-gray-700'}`}
                                    >
                                        {isLearningRedoKey ? 'Listening...' : (pushToTalkRedoKey || 'KeyR')}
                                    </button>
                                </div>
                            </div>
                        )}
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
