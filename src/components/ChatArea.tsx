import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore, type MessageNode } from '../store/useChatStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { sendMessageStream, MODEL_LIMITS, synthesizeSpeech, stopSpeech } from '../services/geminiService';
import { Send, User as UserIcon, Bot, AlertTriangle, Cpu, ChevronLeft, ChevronRight, Edit2, Mic, Volume2, Loader2, Square, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '../lib/utils';

// --- Speech Types ---
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: (event: any) => void;
    onend: () => void;
}
declare global {
    interface Window {
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}

// --- Code Block with Copy Button ---
const CodeBlock = ({ className, children, ...props }: any) => {
    const [copied, setCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(codeString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [codeString]);

    return (
        <div className="not-prose my-3">
            <div className="code-block-header">
                <span>{language || 'code'}</span>
                <button onClick={handleCopy}>
                    {copied ? (
                        <><Check className="w-3 h-3" /> Copied!</>
                    ) : (
                        <><Copy className="w-3 h-3" /> Copy code</>
                    )}
                </button>
            </div>
            <pre className="!mt-0 !rounded-t-none">
                <code className={className} {...props}>
                    {children}
                </code>
            </pre>
        </div>
    );
};

export const ChatArea: React.FC = () => {
    const { currentSessionId, sessions, addMessage, addSession, navigateBranch } = useChatStore();
    const { apiKey, ttsVoice } = useSettingsStore();
    const { personas, activePersonaId } = usePersonaStore();

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState<string | null>(null); // Message ID being spoken
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [streamingNodeId, setStreamingNodeId] = useState<string | null>(null);
    const [streamingContent, setStreamingContent] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const currentSession = sessions.find(s => s.id === currentSessionId);
    const activePersona = personas.find(p => p.id === activePersonaId);

    // --- Tree Traversal & Thread Construction ---
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



    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [currentSession?.currentLeafId, streamingContent]);

    // --- Text-to-Speech (Browser Native) ---
    const speakMessage = async (text: string, msgId: string) => {
        // Stop any current speech
        stopSpeech();
        if (isSpeaking === msgId) {
            setIsSpeaking(null);
            return;
        }

        if (!ttsVoice) {
            alert("Please select a Voice in Settings first.");
            return;
        }

        setIsSpeaking(msgId);
        try {
            await synthesizeSpeech(text, ttsVoice);
            setIsSpeaking(null);
        } catch (error: any) {
            console.error("TTS Error", error);
            alert(`TTS Error: ${error.message}`);
            setIsSpeaking(null);
        }
    };

    // --- Speech-to-Text ---
    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(prev => prev + (prev ? ' ' : '') + transcript);
            setIsListening(false);
        };

        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    };

    // --- Sending Messages (Streaming) ---
    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            setIsStreaming(false);
        }
    };

    const handleSend = async (contentOverride?: string) => {
        const messageContent = contentOverride || input;
        if (!messageContent.trim() || !currentSessionId || !activePersona) return;

        if (!contentOverride) setInput('');
        setIsLoading(true);
        setIsStreaming(true);

        const systemPrompt = activePersona.systemPrompt;

        let userMsgId: string | undefined;

        // 1. Add User Message
        if (editingNodeId && contentOverride) {
            useChatStore.getState().editMessage(currentSessionId, editingNodeId, messageContent);
            setEditingNodeId(null);
            setEditContent('');
            // Logic to find the NEW node ID after edit is complex without return value, 
            // but usually it's the currentLeafId.
            // For simplicity, we just proceed.
        } else {
            useChatStore.getState().addMessage(currentSessionId, 'user', messageContent);
        }

        // 2. Prepare History
        const sess = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
        if (!sess || !sess.currentLeafId) return;

        const newThread: MessageNode[] = [];
        let curr: string | null = sess.currentLeafId;
        while (curr) {
            const n: MessageNode = sess.messages[curr];
            if (n) { newThread.unshift(n); curr = n.parentId; } else break;
        }

        const apiHistory = [
            { role: 'user', content: `System Instruction: ${systemPrompt}` },
            ...newThread.map(m => ({ role: m.role, content: m.content }))
        ];

        // 3. Create Placeholder for Model Response
        // We need to add an empty model message and then update it incrementally.
        // But `addMessage` adds a NEW node. We want to add one, get its ID, then edit it.
        // Our store doesn't return the ID easily from `addMessage` (it's void), 
        // but we can query `currentLeafId` after adding.

        useChatStore.getState().addMessage(currentSessionId, 'model', '...');
        // Now find the ID of this new message (it's the current leaf)
        const updatedSess = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
        const modelNodeId = updatedSess?.currentLeafId;

        if (!modelNodeId) {
            setIsLoading(false);
            setIsStreaming(false);
            return;
        }

        setStreamingNodeId(modelNodeId);
        setStreamingContent('');

        // 4. Stream Response
        abortControllerRef.current = new AbortController();

        try {
            const stream = sendMessageStream(
                apiHistory,
                apiKey,
                activePersona.config.model,
                activePersona.config
            );

            let fullText = '';
            let currentMessageId = modelNodeId;
            let buffer = '';

            for await (const chunk of stream) {
                if (abortControllerRef.current?.signal.aborted) {
                    break;
                }

                if (activePersona.isChatMode) {
                    buffer += chunk;
                    // Split by sentence endings (. ? !), but keep the delimiter to check, then remove it
                    // Regex: Match (. or ? or !) followed by (whitespace or end of string)
                    // We need to be careful not to split on abbreviations like "Mr." but simple split for now
                    // let's iterate through the buffer and find split points

                    let remainingCheck = buffer;
                    while (true) {
                        // Find the first delimiter that is followed by space or end
                        const match = remainingCheck.match(/([.?!])(\s+|$)/);
                        if (!match || typeof match.index === 'undefined') {
                            break;
                        }

                        // We found a sentence end
                        const delimiterIndex = match.index;
                        const delimiter = match[1];
                        const splitPoint = delimiterIndex + 1; // Include the delimiter in the first part? User said REMOVE periods.

                        // "nah man. i got 3 dollars." -> "nah man"
                        // User wants NO periods at the end.

                        const sentenceWithDelimiter = remainingCheck.substring(0, splitPoint);
                        const sentenceClean = sentenceWithDelimiter.slice(0, -1).trim(); // Remove the last char (delimiter)

                        // Update current message with this sentence
                        useChatStore.getState().updateMessageContent(currentSessionId, currentMessageId, sentenceClean);

                        // Create NEW message for the next part
                        currentMessageId = useChatStore.getState().addMessage(currentSessionId, 'model', '...');
                        setStreamingNodeId(currentMessageId);

                        // Remove processed part from buffer
                        remainingCheck = remainingCheck.substring(splitPoint);
                    }

                    buffer = remainingCheck;
                    // Update the CURRENT "..." message with the remaining buffer so the user sees typing
                    if (buffer) {
                        useChatStore.getState().updateMessageContent(currentSessionId, currentMessageId, buffer);
                        setStreamingContent(buffer); // For local view if needed, but redundant with store update
                    }

                } else {
                    fullText += chunk;
                    setStreamingContent(fullText);
                    useChatStore.getState().updateMessageContent(currentSessionId, modelNodeId, fullText);
                }
            }

            // Final cleanup for Chat Mode
            if (activePersona.isChatMode) {
                if (buffer.trim()) {
                    // Final update for the last chunk
                    useChatStore.getState().updateMessageContent(currentSessionId, currentMessageId, buffer.trim());
                } else {
                    // Buffer is empty, so the current "..." message is redundant. Remove it.
                    // We need a deleteMessage action or some way to handle this.
                    // For now, let's just update it to empty? No, better to remove.
                    // Since we don't have deleteMessage exposed in store easily here without potentially breaking tree,
                    // let's just leave it empty string? But empty bubbles look bad.
                    // Let's implement a quick fix: If content is "...", set it to empty string, and UI should hide empty messages?
                    // Or better: update with empty string and we filter empty messages in UI?

                    // Helper: Check if the message content is still "..."
                    const verifyNode = useChatStore.getState().sessions.find(s => s.id === currentSessionId)?.messages[currentMessageId];
                    if (verifyNode && verifyNode.content === '...') {
                        // It's a dummy node.
                        // Ideally we delete it. But since `deleteMessage` isn't in our destructured props, let's just make it empty.
                        // And in the UI render, we can hide empty messages.
                        useChatStore.getState().updateMessageContent(currentSessionId, currentMessageId, '');
                    }
                }
            }

        } catch (e: any) {
            if (e.name !== 'AbortError') {
                useChatStore.getState().addMessage(currentSessionId, 'model', `**Error**: ${e.message || e}`);
            }
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
            setStreamingNodeId(null);
            setStreamingContent('');
            abortControllerRef.current = null;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const startEditing = (node: MessageNode) => {
        setEditingNodeId(node.id);
        setEditContent(node.content);
    };

    const cancelEditing = () => {
        setEditingNodeId(null);
        setEditContent('');
    };

    if (!currentSessionId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-950">
                <p className="mb-4">Select or start a new chat</p>
                <button onClick={addSession} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    New Chat
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-950 relative">
            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {thread.length === 0 && (
                    <div className="text-center text-gray-500 mt-20">
                        <p>Start a conversation with {activePersona?.name}...</p>
                    </div>
                )}

                {thread.filter(m => m.content && m.content.trim() !== '' && m.content !== '...').map((msg) => {
                    const parentId = msg.parentId;
                    const parent = parentId && currentSession ? currentSession.messages[parentId] : null;
                    const siblings = parent ? parent.childrenIds : (currentSession?.rootMessageIds || []);

                    const currentSiblingIndex = siblings.indexOf(msg.id);
                    const totalSiblings = siblings.length;
                    const showNav = totalSiblings > 1;

                    return (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex gap-4 max-w-4xl mx-auto group",
                                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 self-start mt-1",
                                msg.role === 'user' ? "bg-blue-600" : "bg-purple-600"
                            )}>
                                {msg.role === 'user' ? <UserIcon className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                            </div>

                            <div className="flex flex-col max-w-[80%] gap-1">
                                {/* Message Bubble */}
                                {editingNodeId === msg.id ? (
                                    <div className="bg-gray-800 rounded-2xl p-3 border border-blue-500">
                                        <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="w-full bg-gray-900 border-gray-700 rounded p-2 text-white text-sm"
                                            rows={3}
                                        />
                                        <div className="flex gap-2 mt-2 justify-end">
                                            <button onClick={cancelEditing} className="px-3 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">Cancel</button>
                                            <button onClick={() => handleSend(editContent)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500">Save & Submit</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={cn(
                                        "rounded-2xl px-5 py-3 relative group/bubble",
                                        msg.role === 'user'
                                            ? "bg-blue-600 text-white"
                                            : msg.content.startsWith('**Error**') ? "bg-red-900/20 border border-red-500/50 text-red-200" : "bg-gray-800 text-gray-100"
                                    )}>
                                        {msg.content.startsWith('**Error**') && <AlertTriangle className="w-4 h-4 mb-2 text-red-400" />}
                                        <div className="prose prose-invert prose-sm max-w-none prose-chat">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                rehypePlugins={[rehypeHighlight]}
                                                components={{
                                                    code({ node, className, children, ...props }: any) {
                                                        const isBlock = /language-/.test(className || '') ||
                                                            (typeof children === 'string' && children.includes('\n')) ||
                                                            (Array.isArray(children) && String(children.join('')).includes('\n'));

                                                        if (isBlock) {
                                                            return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
                                                        }

                                                        return (
                                                            <code className={cn("bg-white/10 rounded px-1.5 py-0.5 text-[0.875em]", className)} {...props}>
                                                                {children}
                                                            </code>
                                                        );
                                                    },
                                                    pre({ children }: any) {
                                                        // When rehype-highlight wraps in pre>code, we just pass through
                                                        // since CodeBlock handles the pre wrapper itself
                                                        return <>{children}</>;
                                                    }
                                                }}
                                            >
                                                {(streamingNodeId === msg.id && streamingContent) ? streamingContent : msg.content}
                                            </ReactMarkdown>
                                        </div>

                                    </div>
                                )}

                                {/* Message Controls (Nav + Edit/Speak) */}
                                <div className={cn("flex items-center gap-2 mt-2 select-none", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                    {/* Navigation */}
                                    {showNav && (
                                        <div className="flex items-center bg-gray-800 rounded-lg p-1 text-xs font-mono text-gray-400">
                                            <button
                                                onClick={() => navigateBranch(currentSessionId, msg.id, 'prev')}
                                                disabled={currentSiblingIndex === 0}
                                                className="p-1 hover:text-white disabled:opacity-30"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <span className="mx-2">{currentSiblingIndex + 1} / {totalSiblings}</span>
                                            <button
                                                onClick={() => navigateBranch(currentSessionId, msg.id, 'next')}
                                                disabled={currentSiblingIndex === totalSiblings - 1}
                                                className="p-1 hover:text-white disabled:opacity-30"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {msg.role === 'user' && (
                                            <button
                                                onClick={() => startEditing(msg)}
                                                className="p-1 text-gray-400 hover:text-white transition-colors"
                                                title="Edit Message"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {msg.role === 'model' && (
                                            <button
                                                onClick={() => speakMessage(msg.content, msg.id)}
                                                className={cn(
                                                    "p-1 transition-colors",
                                                    isSpeaking === msg.id ? "text-green-400 animate-pulse" : "text-gray-400 hover:text-white"
                                                )}
                                                title={isSpeaking === msg.id ? "Stop Speaking" : "Read Aloud"}
                                            >
                                                {isSpeaking === msg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {isLoading && !isStreaming && (
                    <div className="flex gap-4 max-w-4xl mx-auto">
                        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0 animate-pulse">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="bg-gray-800 rounded-2xl px-5 py-3 text-gray-400">
                            <span className="animate-pulse">Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-gray-900 border-t border-gray-800">
                <div className="max-w-4xl mx-auto relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Message ${activePersona?.name || 'Gemini'}...`}
                        className="w-full bg-gray-800 text-white rounded-xl pl-4 pr-24 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none h-[52px] max-h-32 overflow-y-auto"
                        disabled={isLoading}
                    />

                    <div className="absolute right-2 top-2 flex gap-1">
                        {isStreaming ? (
                            <button
                                onClick={handleStop}
                                className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all animate-pulse"
                                title="Stop Generating"
                            >
                                <Square className="w-4 h-4 fill-current" />
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={toggleListening}
                                    className={cn(
                                        "p-2 rounded-lg transition-all",
                                        isListening ? "bg-red-600 text-white animate-pulse" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                    )}
                                    title="Speech to Text"
                                >
                                    <Mic className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleSend()}
                                    disabled={(!input.trim() && !editContent) || isLoading}
                                    className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="text-center text-xs text-gray-500 mt-2">
                    Gemini can make mistakes. Check important info.
                </div>
            </div>
        </div>
    );
};
