import React from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { Key, Volume2, X, Mic, Check, Keyboard, PlayCircle, Clock, Globe, Languages } from 'lucide-react';




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
        pushToTalkRedoKey, setPushToTalkRedoKey,
        pushToTalkTranslateKey, setPushToTalkTranslateKey,
        enableTranslation, setEnableTranslation,
        targetLanguage, setTargetLanguage,
        sourceLanguage, setSourceLanguage
    } = useSettingsStore();

    const [browserVoices, setBrowserVoices] = React.useState<SpeechSynthesisVoice[]>([]);
    const [isLearningKey, setIsLearningKey] = React.useState(false);
    const [isLearningRedoKey, setIsLearningRedoKey] = React.useState(false);
    const [isLearningTranslateKey, setIsLearningTranslateKey] = React.useState(false);

    // Key Learning Logic - Standard PTT
    React.useEffect(() => {
        if (!isLearningKey) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            let keyName = e.code;
            if (e.code === 'Space') keyName = 'Space';

            setPushToTalkKey(e.code);
            setIsLearningKey(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLearningKey, setPushToTalkKey]);

    // Key Learning Logic - Redo PTT
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

    // Key Learning Logic - Translate PTT
    React.useEffect(() => {
        if (!isLearningTranslateKey) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setPushToTalkTranslateKey(e.code);
            setIsLearningTranslateKey(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLearningTranslateKey, setPushToTalkTranslateKey]);

    React.useEffect(() => {
        const loadVoices = () => {
            setBrowserVoices(window.speechSynthesis.getVoices());
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
        return () => { window.speechSynthesis.onvoiceschanged = null; };
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true">
            {/* Wider Container for "Landscape View" */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-5xl shadow-2xl relative flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <SettingsIcon className="w-6 h-6 text-gray-400" />
                        <h2 className="text-xl font-bold text-white">Global Settings</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content - 2 Column Grid */}
                <div className="p-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-12">

                    {/* Left Column: API, Voice, Language, Toggles */}
                    <div className="space-y-8">
                        {/* Section: Core API */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Connection</h3>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
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
                                    Required for Gemini models. Stored locally.
                                </p>
                            </div>
                        </div>

                        {/* Section: Voice & Audio */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Voice & Audio</h3>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
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
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-950 rounded-lg border border-gray-800/50">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-gray-300">Auto-Read Responses</label>
                                    <p className="text-xs text-gray-500">Automatically speak AI responses</p>
                                </div>
                                <Toggle checked={autoSpeak} onChange={setAutoSpeak} color="blue" />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-950 rounded-lg border border-gray-800/50">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-gray-300">Offline Speech-to-Text</label>
                                    <p className="text-xs text-gray-500">Use local Whisper model (~40MB)</p>
                                </div>
                                <Toggle checked={useOfflineSTT} onChange={setUseOfflineSTT} color="blue" />
                            </div>
                        </div>

                        {/* Section: Language Features */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Language Tools</h3>

                            <div className="flex items-center justify-between p-3 bg-gray-950 rounded-lg border border-gray-800/50">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-gray-300">Grammar Check</label>
                                    <p className="text-xs text-gray-500">Analyze & correct messages</p>
                                </div>
                                <Toggle checked={enableGrammarCheck} onChange={setEnableGrammarCheck} color="blue" />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-950 rounded-lg border border-gray-800/50">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-gray-300">Enable Translation</label>
                                    <p className="text-xs text-gray-500">Unlock translation features</p>
                                </div>
                                <Toggle checked={enableTranslation} onChange={setEnableTranslation} color="indigo" />
                            </div>

                            {enableTranslation && (
                                <div className="pl-4 border-l-2 border-indigo-500/20 space-y-2 animate-in slide-in-from-left-2 duration-200">
                                    <p className="text-xs text-gray-400">Target language settings moved to Push-to-Talk configuration.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Push-to-Talk Configuration */}
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <Mic className="w-4 h-4" /> Push-to-Talk Controls
                            </h3>

                            <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 space-y-6">
                                <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                                    <div className="space-y-0.5">
                                        <label className="text-base font-medium text-white">Enable Push-to-Talk</label>
                                        <p className="text-sm text-gray-500">Hold a key to speak instead of clicking</p>
                                    </div>
                                    <Toggle checked={usePushToTalk} onChange={setUsePushToTalk} color="green" />
                                </div>

                                {usePushToTalk ? (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        {/* Standard Send */}
                                        <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-800 hover:border-blue-500/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                                    <Mic className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-gray-200">Standard Send</h4>
                                                    <p className="text-xs text-gray-500">Speak & Send normally</p>
                                                </div>
                                            </div>
                                            <KeyButton
                                                isLearning={isLearningKey}
                                                currentKey={pushToTalkKey || 'Space'}
                                                onClick={() => setIsLearningKey(true)}
                                            />
                                        </div>

                                        {/* Redo Send */}
                                        <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-800 hover:border-red-500/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                                                    <RotateCwIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-gray-200">Redo Message</h4>
                                                    <p className="text-xs text-gray-500">Re-record last message</p>
                                                </div>
                                            </div>
                                            <KeyButton
                                                isLearning={isLearningRedoKey}
                                                currentKey={pushToTalkRedoKey || 'KeyR'}
                                                onClick={() => setIsLearningRedoKey(true)}
                                            />
                                        </div>

                                        {/* Translate & Send (New) */}
                                        <div className={`flex flex-col bg-gray-900 rounded-lg border transition-colors ${enableTranslation ? 'border-gray-800 hover:border-indigo-500/30' : 'border-gray-800 opacity-50 cursor-not-allowed'}`}>
                                            <div className="flex items-center justify-between p-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                                        <Languages className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-gray-200 flex items-center gap-2">
                                                            Translate & Send
                                                            {!enableTranslation && <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">Requires Translation On</span>}
                                                        </h4>
                                                        <p className="text-xs text-gray-500">
                                                            Translates voice to target language and sends
                                                        </p>
                                                    </div>
                                                </div>
                                                <KeyButton
                                                    isLearning={isLearningTranslateKey}
                                                    currentKey={pushToTalkTranslateKey || 'KeyT'}
                                                    onClick={() => enableTranslation && setIsLearningTranslateKey(true)}
                                                    disabled={!enableTranslation}
                                                />
                                            </div>

                                            {enableTranslation && (
                                                <div className="px-3 pb-3 pl-14 animate-in fade-in slide-in-from-top-1 space-y-2">
                                                    <div className="flex items-center justify-between bg-gray-950/50 p-2 rounded border border-gray-800/50">
                                                        <span className="text-xs text-gray-500">Speak in:</span>
                                                        <select
                                                            value={sourceLanguage}
                                                            onChange={(e) => setSourceLanguage(e.target.value)}
                                                            className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 font-medium focus:ring-1 focus:ring-gray-600 outline-none cursor-pointer w-32"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <option value="en-US">English (US)</option>
                                                            <option value="ko-KR">Korean</option>
                                                            <option value="es-ES">Spanish</option>
                                                            <option value="fr-FR">French</option>
                                                            <option value="de-DE">German</option>
                                                            <option value="it-IT">Italian</option>
                                                            <option value="pt-PT">Portuguese</option>
                                                            <option value="ru-RU">Russian</option>
                                                            <option value="ja-JP">Japanese</option>
                                                            <option value="zh-CN">Chinese (Simplified)</option>
                                                            <option value="hi-IN">Hindi</option>
                                                            <option value="ar-SA">Arabic</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex items-center justify-between bg-gray-950/50 p-2 rounded border border-gray-800/50">
                                                        <span className="text-xs text-gray-500">Translate to:</span>
                                                        <select
                                                            value={targetLanguage}
                                                            onChange={(e) => setTargetLanguage(e.target.value)}
                                                            className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-indigo-400 font-medium focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer w-32"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <option value="English">English</option>
                                                            <option value="Spanish">Spanish</option>
                                                            <option value="French">French</option>
                                                            <option value="German">German</option>
                                                            <option value="Italian">Italian</option>
                                                            <option value="Portuguese">Portuguese</option>
                                                            <option value="Russian">Russian</option>
                                                            <option value="Japanese">Japanese</option>
                                                            <option value="Korean">Korean</option>
                                                            <option value="Chinese (Simplified)">Chinese (Simplified)</option>
                                                            <option value="Hindi">Hindi</option>
                                                            <option value="Arabic">Arabic</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center text-gray-600">
                                        <Keyboard className="w-12 h-12 mb-3 opacity-20" />
                                        <p>Enable Push-to-Talk to configure shortcuts</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-800 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-medium transition-colors shadow-lg shadow-blue-900/20"
                    >
                        Save & Close
                    </button>
                </div>

            </div>
        </div>
    );
};

// Helper Components
const Toggle = ({ checked, onChange, color = 'blue' }: { checked: boolean, onChange: (v: boolean) => void, color?: string }) => {
    const bgColors: any = {
        blue: checked ? 'bg-blue-600' : 'bg-gray-700',
        green: checked ? 'bg-green-600' : 'bg-gray-700',
        purple: checked ? 'bg-purple-600' : 'bg-gray-700',
        indigo: checked ? 'bg-indigo-600' : 'bg-gray-700',
    };

    return (
        <button
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-${color}-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${bgColors[color]}`}
        >
            <span
                className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm`}
            />
        </button>
    );
};

const KeyButton = ({ isLearning, currentKey, onClick, disabled }: any) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all min-w-[80px] text-center
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-800 text-gray-500' : ''}
            ${!disabled && isLearning ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : ''}
            ${!disabled && !isLearning ? 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white hover:border-gray-600' : ''}
        `}
    >
        {isLearning ? 'PRESS KEY' : currentKey}
    </button>
);

// Icon components locally if needed or import
const SettingsIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
);
// RotateCw needed
const RotateCwIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
);
