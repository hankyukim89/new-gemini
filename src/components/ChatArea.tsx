import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore, type MessageNode, type Attachment } from '../store/useChatStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { sendMessageStream, MODEL_LIMITS, synthesizeSpeech, stopSpeech, PLAYGROUND_MODELS } from '../services/geminiService';
import { Send, User as UserIcon, Bot, AlertTriangle, Cpu, ChevronLeft, ChevronRight, Edit2, Mic, Volume2, Loader2, Square, Copy, Check, Paperclip, X, Image as ImageIcon, FileText, Plus, Settings } from 'lucide-react';
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
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // --- File Handling ---
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            await processFiles(Array.from(e.target.files));
        }
    };

    const processFiles = async (files: File[]) => {
        const newAttachments: Attachment[] = [];

        for (const file of files) {
            if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('text/')) {
                const reader = new FileReader();
                await new Promise<void>((resolve) => {
                    reader.onload = (e) => {
                        const result = e.target?.result as string;
                        newAttachments.push({
                            id: Math.random().toString(36).substring(7),
                            type: file.type.startsWith('image/') ? 'image' : 'file',
                            mimeType: file.type,
                            data: result,
                            name: file.name
                        });
                        resolve();
                    };
                    reader.readAsDataURL(file);
                });
            }
        }
        setAttachments(prev => [...prev, ...newAttachments]);
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file) files.push(file);
            }
        }
        if (files.length > 0) {
            e.preventDefault();
            await processFiles(files);
        }
    };

    const dragCounter = useRef(0);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await processFiles(Array.from(e.dataTransfer.files));
        }
    };

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    // --- Text-to-Speech (Browser Native) ---
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
        const currentAttachments = contentOverride ? [] : attachments; // Only use attachments for new messages

        if ((!messageContent.trim() && currentAttachments.length === 0) || !currentSessionId || !activePersona) return;

        if (!contentOverride) {
            setInput('');
            setAttachments([]);
        }
        setIsLoading(true);
        setIsStreaming(true);

        const systemPrompt = activePersona.systemPrompt;

        let userMsgId: string | undefined;

        // 1. Add User Message
        if (editingNodeId && contentOverride) {
            useChatStore.getState().editMessage(currentSessionId, editingNodeId, messageContent);
            setEditingNodeId(null);
            setEditContent('');
        } else {
            useChatStore.getState().addMessage(currentSessionId, 'user', messageContent, currentAttachments);
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
            ...newThread.map(m => ({ role: m.role, content: m.content, attachments: m.attachments }))
        ];

        // 3. Create Placeholder for Model Response
        useChatStore.getState().addMessage(currentSessionId, 'model', '...');
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

            let currentMsgId = modelNodeId;
            let currentAccruedText = '';

            for await (const chunk of stream) {
                if (abortControllerRef.current?.signal.aborted) {
                    break;
                }

                currentAccruedText += chunk;

                // Chat Mode Splitting Logic
                if (activePersona.isChatMode) {
                    // Check for sentence endings (. ? !) followed by whitespace.
                    // We removed the (?=[A-Z"]) lookahead to support casual lowercase chat.
                    // We must also ensure we don't split inside a code block.

                    let searchStartIndex = 0;
                    while (true) {
                        // Search in the remaining text
                        const remainingText = currentAccruedText.slice(searchStartIndex);
                        const splitMatch = remainingText.match(/([.!?])\s+/);

                        if (!splitMatch) break; // No more sentence endings found

                        const relativeIndex = splitMatch.index!;
                        const absoluteIndex = searchStartIndex + relativeIndex;
                        const puncIndex = absoluteIndex + 1;

                        const potentialFirstPart = currentAccruedText.slice(0, puncIndex);

                        // Check if we are inside a code block (odd number of backticks)
                        const backtickCount = (potentialFirstPart.match(/`/g) || []).length;
                        const isInsideCode = backtickCount % 2 !== 0;

                        if (!isInsideCode) {
                            // Safe to split
                            const firstPart = potentialFirstPart;
                            const remainder = currentAccruedText.slice(puncIndex).trimStart();

                            // 1. Finalize current message
                            useChatStore.getState().updateMessageContent(currentSessionId, currentMsgId, firstPart);

                            // 2. Create new message
                            const newMsgId = useChatStore.getState().addMessage(currentSessionId, 'model', '');
                            currentMsgId = newMsgId;
                            currentAccruedText = remainder;

                            // Reset search start for the new currentAccruedText
                            searchStartIndex = 0;
                        } else {
                            // We are inside code, so this period is part of the code. 
                            // Skip this match and search after it.
                            searchStartIndex = puncIndex;
                        }
                    }
                }

                setStreamingNodeId(currentMsgId);
                setStreamingContent(currentAccruedText);
                useChatStore.getState().updateMessageContent(currentSessionId, currentMsgId, currentAccruedText);
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
        <div
            className="flex-1 flex flex-col h-full bg-gray-950 relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {thread.length === 0 && (
                    <div className="text-center text-gray-500 mt-20">
                        <p>Start a conversation with {activePersona?.name}...</p>
                    </div>
                )}

                {thread.filter(m => (m.content && m.content.trim() !== '') || (m.attachments && m.attachments.length > 0) || m.content === '...').map((msg) => {
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

                            <div className={cn("flex flex-col max-w-[80%] gap-1", msg.role === 'user' && "items-end")}>
                                {/* Message Bubble / Content */}
                                {editingNodeId === msg.id ? (
                                    <div className="bg-gray-800 rounded-2xl p-3 border border-blue-500 w-full">
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
                                    <>
                                        {/* Attachments (Split for User) */}
                                        {msg.role === 'user' ? (
                                            msg.attachments && msg.attachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-1 justify-end">
                                                    {msg.attachments.map(att => (
                                                        <div key={att.id} className="relative group/att">
                                                            {att.type === 'image' ? (
                                                                <img src={att.data} alt="attachment" className="max-w-xs max-h-64 object-cover rounded-xl shadow-sm" />
                                                            ) : (
                                                                <div className="w-32 h-32 flex flex-col items-center justify-center bg-gray-800/80 rounded-xl border border-white/10 p-2 text-center text-white">
                                                                    <FileText className="w-8 h-8 opacity-70 mb-1" />
                                                                    <span className="text-xs truncate w-full">{att.name}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        ) : null}

                                        {/* Text Content */}
                                        {(msg.content || msg.role === 'model') && (
                                            <div className={cn(
                                                "rounded-2xl px-5 py-3 relative group/bubble text-left",
                                                msg.role === 'user'
                                                    ? (msg.content ? "bg-blue-600 text-white" : "hidden")
                                                    : msg.content.startsWith('**Error**') ? "bg-red-900/20 border border-red-500/50 text-red-200" : "bg-gray-800 text-gray-100"
                                            )}>
                                                {/* Attachments (Inside bubble for Model - typically none, but consistent legacy behavior if needed, or we can split too. Keeping inside for now as user asked for User 'prompt' fix) */}
                                                {msg.role === 'model' && msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {msg.attachments.map(att => (
                                                            <div key={att.id} className="relative group/att">
                                                                {att.type === 'image' ? (
                                                                    <img src={att.data} alt="attachment" className="w-32 h-32 object-cover rounded-lg" />
                                                                ) : (
                                                                    <div className="w-32 h-32 flex flex-col items-center justify-center bg-black/20 rounded-lg border border-white/10 p-2 text-center">
                                                                        <FileText className="w-8 h-8 opacity-50 mb-1" />
                                                                        <span className="text-xs truncate w-full">{att.name}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

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
                                                                return <>{children}</>;
                                                            }
                                                        }}
                                                    >
                                                        {(streamingNodeId === msg.id && streamingContent) ? streamingContent : msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Message Controls (Nav + Edit/Speak) */}
                                <div className={cn("flex items-center gap-2 -mt-1 select-none", msg.role === 'user' ? "justify-end" : "justify-start")}>
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
                                            <>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(msg.content)}
                                                    className="p-1 text-gray-400 hover:text-white transition-colors"
                                                    title="Copy"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => startEditing(msg)}
                                                    className="p-1 text-gray-400 hover:text-white transition-colors"
                                                    title="Edit text"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            </>
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

            {/* Drag & Drop Overlay */}
            {isDragging && (
                <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm z-50 flex flex-col items-center justify-center border-2 border-blue-500 border-dashed m-4 rounded-xl pointer-events-none">
                    <Paperclip className="w-12 h-12 text-blue-400 mb-2" />
                    <p className="text-lg font-semibold text-blue-100">Drop files here</p>
                </div>
            )}

            {/* Input */}
            <div className="p-4 bg-gray-900 border-t border-gray-800">
                <div className="max-w-4xl mx-auto relative">
                    {/* Attachment Previews */}
                    {attachments.length > 0 && (
                        <div className="flex gap-2 mb-3 overflow-x-auto py-1">
                            {attachments.map(att => (
                                <div key={att.id} className="relative group shrink-0">
                                    {att.type === 'image' ? (
                                        <img src={att.data} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-gray-700" />
                                    ) : (
                                        <div className="w-16 h-16 flex items-center justify-center bg-gray-800 rounded-lg border border-gray-700">
                                            <FileText className="w-6 h-6 text-gray-400" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => removeAttachment(att.id)}
                                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-lg hover:bg-red-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2 items-end">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors shrink-0"
                            title="Add files"
                        >
                            <Plus className="w-5 h-5" />
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                                multiple
                            />
                        </button>

                        <div className="flex-1 relative">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                placeholder={`Message ${activePersona?.name || 'Gemini'}...`}
                                className="w-full bg-gray-800 text-white rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none h-[52px] max-h-32 overflow-y-auto"
                                disabled={isLoading}
                            />
                            <div className="absolute right-2 top-2">
                                {isStreaming ? (
                                    <button
                                        onClick={handleStop}
                                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all animate-pulse"
                                        title="Stop Generating"
                                    >
                                        <Square className="w-4 h-4 fill-current" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleSend()}
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
                                onChange={(e) => {
                                    if (activePersona) {
                                        usePersonaStore.getState().updatePersona(activePersona.id, {
                                            config: { ...activePersona.config, model: e.target.value }
                                        });
                                    }
                                }}
                                className="w-32 bg-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5 border-none focus:ring-1 focus:ring-purple-500 outline-none truncate"
                            >
                                {PLAYGROUND_MODELS.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>

                            {/* We could add more quick toggles here or a mini settings popover */}
                            <button
                                onClick={toggleListening}
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
        </div>
    );
};
