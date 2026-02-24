import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore, type MessageNode } from '../store/useChatStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePersonaStore } from '../store/usePersonaStore';
import { sendMessageStream, synthesizeSpeech, stopSpeech, defineWord } from '../services/geminiService';
import { checkGrammar } from '../services/grammarService';
import { translateText } from '../services/translationService';
import { useFileHandling } from '../hooks/useFileHandling';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { usePushToTalk } from '../hooks/usePushToTalk';
import { ChatInput } from './chat/ChatInput';
import { MessageList } from './chat/MessageList';

// ============================================================================
// CHAT AREA COMPONENT (REFACTORED)
// Main component coordinating chat interface using extracted hooks/components
// ============================================================================

export const ChatArea: React.FC = () => {
    const { currentSessionId, sessions, navigateBranch, setTranslation } = useChatStore();
    const { apiKey, ttsVoice, enableGrammarCheck, enableTranslation, targetLanguage } = useSettingsStore();
    const { personas, activePersonaId, updatePersona } = usePersonaStore();

    // Local State
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [streamingNodeId, setStreamingNodeId] = useState<string | null>(null);
    const [streamingContent, setStreamingContent] = useState('');
    const [definitionHover, setDefinitionHover] = useState<{ x: number, y: number, html: string } | null>(null);

    // Refs
    const abortControllerRef = useRef<AbortController | null>(null);
    const pttModeRef = useRef<'standard' | 'redo' | 'translate' | null>(null);
    const initialInputRef = useRef('');

    // Derived State
    const currentSession = sessions.find(s => s.id === currentSessionId);
    const activePersona = personas.find(p => p.id === activePersonaId);

    // Custom Hooks
    const fileHandling = useFileHandling();

    const handleTranscriptComplete = useCallback(async (transcript: string) => {
        const mode = pttModeRef.current;
        pttModeRef.current = null;

        if (!mode) {
            // Manual voice input - just set the text
            setInput(transcript);
            return;
        }

        if (mode === 'translate') {
            // Translate and send
            if (apiKey && enableTranslation) {
                const translated = await translateText(transcript, targetLanguage, apiKey);
                handleSend(translated || transcript, transcript);
            } else {
                handleSend(transcript);
            }
        } else if (mode === 'redo') {
            // Edit last user message and regenerate
            const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
            if (session) {
                let lastUserMsgId: string | null = null;
                let nodeId: string | null = session.currentLeafId;
                while (nodeId) {
                    const node = session.messages[nodeId];
                    if (node?.role === 'user') {
                        lastUserMsgId = node.id;
                        break;
                    }
                    nodeId = node?.parentId || null;
                }
                if (lastUserMsgId) {
                    useChatStore.getState().editMessage(currentSessionId!, lastUserMsgId, transcript);
                    if (enableGrammarCheck && apiKey) {
                        const context = getContextForMessage(lastUserMsgId);
                        checkGrammar(transcript, apiKey, context).then(correction => {
                            if (correction) {
                                useChatStore.getState().setGrammarCorrection(currentSessionId!, lastUserMsgId!, correction);
                            }
                        });
                    }
                    setTimeout(() => generateResponse(), 100);
                }
            }
        } else {
            // Standard send
            handleSend(transcript);
        }
    }, [apiKey, enableTranslation, enableGrammarCheck, targetLanguage, currentSessionId]);

    const speechRecognition = useSpeechRecognition(handleTranscriptComplete);

    const handlePTTStart = useCallback((mode: 'standard' | 'redo' | 'translate') => {
        pttModeRef.current = mode;
        initialInputRef.current = input;
        if (!speechRecognition.isListening) {
            speechRecognition.startListening(input);
        }
    }, [input, speechRecognition]);

    const handlePTTEnd = useCallback(() => {
        if (speechRecognition.isListening) {
            speechRecognition.stopListening();
        }
    }, [speechRecognition]);

    usePushToTalk(handlePTTStart, handlePTTEnd, speechRecognition.isListening);

    // Helper Functions
    const getContextForMessage = (messageId: string) => {
        const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
        if (!session) return [];
        const message = session.messages[messageId];
        if (!message || !message.parentId) return [];

        const contextMessages: { role: string; content: string }[] = [];
        let curr: string | null = message.parentId;
        while (curr) {
            const n: MessageNode = session.messages[curr];
            if (n) {
                contextMessages.unshift({ role: n.role, content: n.content });
                curr = n.parentId;
            } else break;
        }
        return contextMessages;
    };

    const handleBubbleClick = (content: string, e: React.MouseEvent) => {
        if (!enableTranslation || !apiKey) return;

        // Prevent triggering on buttons/links/code blocks
        if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) return;
        if ((e.target as HTMLElement).tagName === 'CODE' || (e.target as HTMLElement).closest('code')) return;
        if ((e.target as HTMLElement).tagName === 'PRE' || (e.target as HTMLElement).closest('pre')) return;

        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) return;

        const doc = document as any;
        if (doc.caretRangeFromPoint || doc.caretPositionFromPoint) {
            let range;
            if (doc.caretRangeFromPoint) {
                range = doc.caretRangeFromPoint(e.clientX, e.clientY);
            } else if (doc.caretPositionFromPoint) {
                const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
                range = document.createRange();
                range.setStart(pos.offsetNode, pos.offset);
                range.collapse(true);
            }

            if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
                if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                    selection.modify('move', 'backward', 'word');
                    selection.modify('extend', 'forward', 'word');

                    const word = selection.toString().trim();

                    if (word && word.match(/[a-zA-Z0-9\u00C0-\u00FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]/)) {
                        setDefinitionHover({ x: e.clientX, y: e.clientY + 15, html: '<div class="animate-pulse text-xs">Loading...</div>' });

                        defineWord(word, content, targetLanguage, apiKey).then(def => {
                            if (def) {
                                setDefinitionHover({ x: e.clientX, y: e.clientY + 15, html: def });
                            } else {
                                setDefinitionHover(null);
                            }
                        });
                    }
                }
            }
        }
    };

    const handleTranslateMessage = async (messageId: string, content: string) => {
        if (!apiKey || !enableTranslation) return;
        const translation = await translateText(content, targetLanguage, apiKey);
        if (translation) {
            setTranslation(currentSessionId!, messageId, translation);
        }
    };

    const speakMessage = async (text: string, msgId: string) => {
        stopSpeech();
        if (isSpeaking === msgId) {
            setIsSpeaking(null);
            return;
        }

        setIsSpeaking(msgId);
        try {
            await synthesizeSpeech(text, ttsVoice || '');
        } catch (e) {
            console.error("TTS failed:", e);
        }
        setIsSpeaking(null);
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            setIsStreaming(false);
        }
    };

    const handleSend = async (contentOverride?: string, originalText?: string) => {
        const messageContent = contentOverride || input;
        const currentAttachments = contentOverride ? [] : fileHandling.attachments;

        if ((!messageContent.trim() && currentAttachments.length === 0) || !currentSessionId || !activePersona) return;

        if (!contentOverride) {
            setInput('');
            fileHandling.clearAttachments();
        }

        // Handle editing
        if (editingNodeId && contentOverride) {
            const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
            const editingNode = session?.messages[editingNodeId];

            useChatStore.getState().editMessage(currentSessionId, editingNodeId, messageContent);
            setEditingNodeId(null);
            setEditContent('');

            if (editingNode?.role === 'user') {
                await generateResponse();
                if (enableGrammarCheck && apiKey) {
                    const context = getContextForMessage(editingNodeId);
                    checkGrammar(messageContent, apiKey, context).then(correction => {
                        if (correction && editingNodeId) {
                            useChatStore.getState().setGrammarCorrection(currentSessionId, editingNodeId, correction);
                        }
                    });
                }
            }
        } else {
            // New message
            const userMsgId = useChatStore.getState().addMessage(currentSessionId, 'user', messageContent, currentAttachments, originalText);

            if (enableGrammarCheck && apiKey) {
                const context = getContextForMessage(userMsgId);
                checkGrammar(messageContent, apiKey, context).then(correction => {
                    if (correction) {
                        useChatStore.getState().setGrammarCorrection(currentSessionId, userMsgId, correction);
                    }
                });
            }

            await generateResponse();
        }
    };

    const handleRegenerate = async (messageId: string) => {
        if (!currentSessionId) return;
        const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
        if (!session) return;

        const message = session.messages[messageId];
        if (!message || !message.parentId) return;

        useChatStore.setState(state => {
            const sess = state.sessions.find(s => s.id === currentSessionId);
            if (sess) {
                sess.currentLeafId = message.parentId;
                return { ...state };
            }
            return state;
        });

        await generateResponse();

        if (enableGrammarCheck && apiKey && message.parentId) {
            const parentMsg = session.messages[message.parentId];
            if (parentMsg && parentMsg.role === 'user' && !parentMsg.grammarCorrection) {
                const context = getContextForMessage(message.parentId);
                checkGrammar(parentMsg.content, apiKey, context).then(correction => {
                    if (correction) {
                        useChatStore.getState().setGrammarCorrection(currentSessionId, message.parentId!, correction);
                    }
                });
            }
        }
    };

    const generateResponse = async () => {
        setIsLoading(true);
        setIsStreaming(true);

        const currentSession = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
        if (!currentSession || !currentSession.currentLeafId || !activePersona) {
            setIsLoading(false);
            setIsStreaming(false);
            return;
        }

        // Build history
        const thread: MessageNode[] = [];
        let curr: string | null = currentSession.currentLeafId;
        while (curr) {
            const n: MessageNode = currentSession.messages[curr];
            if (n) {
                thread.unshift(n);
                curr = n.parentId;
            } else break;
        }

        const apiHistory = [
            { role: 'user', content: `System Instruction: ${activePersona.systemPrompt}` },
            ...thread.map(m => ({ role: m.role, content: m.content, attachments: m.attachments }))
        ];

        const modelNodeId = useChatStore.getState().addMessage(currentSessionId!, 'model', '...');

        setStreamingNodeId(modelNodeId);
        setStreamingContent('');

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

                setStreamingNodeId(currentMsgId);
                setStreamingContent(currentAccruedText);
                useChatStore.getState().updateMessageContent(currentSessionId!, currentMsgId, currentAccruedText);

                // Chat Mode: Split into separate bubbles
                if (activePersona.isChatMode) {
                    let searchStartIndex = 0;
                    while (true) {
                        const remainingText = currentAccruedText.slice(searchStartIndex);
                        const splitMatch = remainingText.match(/([.!?])\s+/);

                        if (!splitMatch) break;

                        const relativeIndex = splitMatch.index!;
                        const absoluteIndex = searchStartIndex + relativeIndex;
                        const puncIndex = absoluteIndex + 1;

                        const potentialFirstPart = currentAccruedText.slice(0, puncIndex);
                        const backtickCount = (potentialFirstPart.match(/`/g) || []).length;
                        const isInsideCode = backtickCount % 2 !== 0;

                        if (!isInsideCode) {
                            const firstPart = potentialFirstPart;
                            const remainder = currentAccruedText.slice(puncIndex).trimStart();

                            useChatStore.getState().updateMessageContent(currentSessionId!, currentMsgId, firstPart);

                            await new Promise(r => setTimeout(r, 600));

                            const newMsgId = useChatStore.getState().addMessage(currentSessionId!, 'model', '');
                            currentMsgId = newMsgId;
                            currentAccruedText = remainder;

                            if (remainder) {
                                setStreamingNodeId(currentMsgId);
                                setStreamingContent(currentAccruedText);
                                useChatStore.getState().updateMessageContent(currentSessionId!, currentMsgId, currentAccruedText);
                            }

                            searchStartIndex = 0;
                        } else {
                            searchStartIndex = puncIndex;
                        }
                    }
                }
            }

        } catch (e: any) {
            console.error('Generation error:', e);
            const errorMsg = e.message || 'Unknown error';
            useChatStore.getState().updateMessageContent(currentSessionId!, streamingNodeId!, `**Error**: ${errorMsg}`);
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
            setStreamingNodeId(null);
            setStreamingContent('');
            abortControllerRef.current = null;
        }
    };

    const startEditing = (message: MessageNode) => {
        setEditingNodeId(message.id);
        setEditContent(message.content);
    };

    const cancelEditing = () => {
        setEditingNodeId(null);
        setEditContent('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleModelChange = (model: string) => {
        if (activePersona) {
            updatePersona(activePersona.id, {
                config: { ...activePersona.config, model }
            });
        }
    };

    const toggleListening = () => {
        if (speechRecognition.isListening) {
            speechRecognition.stopListening();
        } else {
            pttModeRef.current = null; // Manual mode
            initialInputRef.current = input;
            speechRecognition.startListening(input);
        }
    };

    // Build thread for display
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

    // Auto-focus input on keypress
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key.length !== 1) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            const activeElement = document.activeElement;
            if (activeElement?.tagName === 'INPUT' ||
                activeElement?.tagName === 'TEXTAREA' ||
                activeElement?.getAttribute('contenteditable') === 'true') {
                return;
            }

            const hasOpenModal = document.querySelector('[role="dialog"]') ||
                document.querySelector('.modal-backdrop') ||
                editingNodeId !== null;

            if (hasOpenModal) return;

            // Focus will happen naturally
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isLoading, editingNodeId]);

    return (
        <div
            className="flex flex-col h-full bg-gray-950 text-white relative"
            onDragEnter={fileHandling.handleDragEnter}
            onDragLeave={fileHandling.handleDragLeave}
            onDragOver={fileHandling.handleDragOver}
            onDrop={fileHandling.handleDrop}
        >
            {/* Message List */}
            <MessageList
                messages={thread}
                currentSessionId={currentSessionId}
                streamingNodeId={streamingNodeId}
                streamingContent={streamingContent}
                isSpeaking={isSpeaking}
                editingNodeId={editingNodeId}
                editContent={editContent}
                targetLanguage={targetLanguage}
                isDragging={fileHandling.isDragging}
                onNavigateBranch={navigateBranch}
                onTranslateMessage={handleTranslateMessage}
                onStartEditing={startEditing}
                onCancelEditing={cancelEditing}
                onSaveEdit={handleSend}
                onRegenerate={handleRegenerate}
                onSpeak={speakMessage}
                onBubbleClick={handleBubbleClick}
                isLoading={isLoading}
                isStreaming={isStreaming}
            />

            {/* Definition Popover */}
            {definitionHover && (
                <div
                    style={{
                        position: 'fixed',
                        left: Math.min(definitionHover.x, window.innerWidth - 270),
                        top: definitionHover.y,
                        maxWidth: '260px'
                    }}
                    className="z-50 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-lg shadow-xl p-3 text-sm text-gray-200 animate-in fade-in zoom-in-95 duration-100 pointer-events-auto select-none"
                    onClick={() => setDefinitionHover(null)}
                >
                    <div dangerouslySetInnerHTML={{ __html: definitionHover.html }} />
                </div>
            )}

            {/* Chat Input */}
            <ChatInput
                input={input}
                onInputChange={setInput}
                onSend={() => handleSend()}
                onKeyDown={handleKeyDown}
                onPaste={fileHandling.handlePaste}
                attachments={fileHandling.attachments}
                onRemoveAttachment={fileHandling.removeAttachment}
                onFileSelect={fileHandling.handleFileSelect}
                isLoading={isLoading}
                isStreaming={isStreaming}
                isListening={speechRecognition.isListening}
                isTranscribing={speechRecognition.isTranscribing}
                onToggleListening={toggleListening}
                onStop={handleStop}
                activePersona={activePersona}
                onModelChange={handleModelChange}
            />
        </div>
    );
};
