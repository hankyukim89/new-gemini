import React, { useRef, KeyboardEvent } from 'react';
import { Send, Mic, Plus, Square, Loader2, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AttachmentPreview } from './AttachmentPreview';
import { PLAYGROUND_MODELS } from '../../services/geminiService';
import type { Attachment } from '../../types/message';
import type { Persona } from '../../store/usePersonaStore';

interface ChatInputProps {
    input: string;
    onInputChange: (value: string) => void;
    onSend: () => void;
    onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
    onPaste: (e: React.ClipboardEvent) => void;
    attachments: Attachment[];
    onRemoveAttachment: (id: string) => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isLoading: boolean;
    isStreaming: boolean;
    isListening: boolean;
    isTranscribing: boolean;
    onToggleListening: () => void;
    onStop: () => void;
    activePersona?: Persona;
    onModelChange: (model: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    input,
    onInputChange,
    onSend,
    onKeyDown,
    onPaste,
    attachments,
    onRemoveAttachment,
    onFileSelect,
    isLoading,
    isStreaming,
    isListening,
    isTranscribing,
    onToggleListening,
    onStop,
    activePersona,
    onModelChange
}) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="p-4 bg-gray-900 border-t border-gray-800">
            <div className="max-w-4xl mx-auto relative">
                {/* Attachment Previews */}
                {attachments.length > 0 && (
                    <div className="mb-3">
                        <AttachmentPreview attachments={attachments} onRemove={onRemoveAttachment} />
                    </div>
                )}

                <div className="flex gap-2 items-end">
                    {/* Transcribing Indicator */}
                    {isTranscribing && (
                        <div className="absolute -top-8 left-0 flex items-center gap-2 text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 backdrop-blur-sm animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span className="text-xs font-medium">Transcribing Audio...</span>
                        </div>
                    )}

                    {/* File Upload Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors shrink-0"
                        title="Add files"
                    >
                        <Plus className="w-5 h-5" />
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={onFileSelect}
                            className="hidden"
                            multiple
                        />
                    </button>

                    {/* Text Input */}
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => onInputChange(e.target.value)}
                            onKeyDown={onKeyDown}
                            onPaste={onPaste}
                            placeholder={`Message ${activePersona?.name || 'Gemini'}...`}
                            className="w-full bg-gray-800 text-white rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none h-[52px] max-h-32 overflow-y-auto"
                            disabled={isLoading}
                        />
                        <div className="absolute right-2 top-2">
                            {isStreaming ? (
                                <button
                                    onClick={onStop}
                                    className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all animate-pulse"
                                    title="Stop Generating"
                                >
                                    <Square className="w-4 h-4 fill-current" />
                                </button>
                            ) : (
                                <button
                                    onClick={onSend}
                                    disabled={(!input.trim() && attachments.length === 0) || isLoading}
                                    className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Quick Settings & Model Select */}
                    <div className="flex flex-col gap-1 shrink-0">
                        <select
                            value={activePersona?.config.model || 'gemini-1.5-flash'}
                            onChange={(e) => onModelChange(e.target.value)}
                            className="w-32 bg-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5 border-none focus:ring-1 focus:ring-purple-500 outline-none truncate"
                        >
                            {PLAYGROUND_MODELS.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>

                        <button
                            onClick={onToggleListening}
                            className={cn(
                                "p-2 rounded-lg transition-all w-full flex items-center justify-center",
                                isListening ? "bg-red-600 text-white animate-pulse" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                            )}
                            title="Speech to Text"
                        >
                            <Mic className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
            <div className="text-center text-xs text-gray-500 mt-2">
                Gemini can make mistakes. Check important info.
            </div>
        </div>
    );
};
