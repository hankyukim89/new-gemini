import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore, type MessageNode, type Attachment } from '../store/useChatStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePersonaStore } from '../store/usePersonaStore';
// import { useAuthStore } from '../store/useAuthStore';
import { sendMessageStream, synthesizeSpeech, stopSpeech, PLAYGROUND_MODELS, checkGrammar, translateText, defineWord } from '../services/geminiService';
import { localWhisperService } from '../services/localWhisperService';
import { Send, User as UserIcon, Bot, AlertTriangle, Edit2, Mic, Volume2, Loader2, Square, Copy, Check, Paperclip, X, FileText, Plus, RotateCw, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '../lib/utils';
import { CodeBlock } from './CodeBlock';



// --- Speech Types ---
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: (event: any) => void;
    onend: () => void;
    onerror: (event: any) => void;
}
declare global {
    interface Window {
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}


export const ChatArea: React.FC = () => {
    const { currentSessionId, sessions, addSession, navigateBranch, setTranslation } = useChatStore();
    const { apiKey, ttsVoice } = useSettingsStore();
    const { personas, activePersonaId } = usePersonaStore();

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState<string | null>(null); // Message ID being spoken
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [streamingNodeId, setStreamingNodeId] = useState<string | null>(null);
    const [streamingContent, setStreamingContent] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Translation / Definition State
    const [definitionHover, setDefinitionHover] = useState<{ x: number, y: number, html: string } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // PTT Refs
    const { usePushToTalk, pushToTalkKey, pushToTalkRedoKey, pushToTalkTranslateKey, enableGrammarCheck, apiKey: settingsApiKey, enableTranslation, targetLanguage, sourceLanguage } = useSettingsStore();
    const isPTTKeyDown = useRef(false);
    const isPTTRedoKeyDown = useRef(false);
    const initialInputRef = useRef('');
    const latestTranscriptRef = useRef('');
    const pttActiveRef = useRef(false); // Tracks if this STT session was started by PTT
    const pttRedoActiveRef = useRef(false); // Tracks if this STT session is a redo
    const pttTranslateActiveRef = useRef(false);
    const isPTTTranslateKeyDown = useRef(false);
    const toggleListeningRef = useRef<(() => void) | null>(null);
    const isListeningRef = useRef(false);

    const currentSession = sessions.find(s => s.id === currentSessionId);
    const activePersona = personas.find(p => p.id === activePersonaId);

    // --- Context Helper ---
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

    // --- Translation & Definition ---
    const handleBubbleClick = (content: string, e: React.MouseEvent) => {
        if (!enableTranslation || !settingsApiKey) return;

        // Prevent filtering: don't trigger on buttons/links/code blocks
        if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) return;
        if ((e.target as HTMLElement).tagName === 'CODE' || (e.target as HTMLElement).closest('code')) return;
        if ((e.target as HTMLElement).tagName === 'PRE' || (e.target as HTMLElement).closest('pre')) return;

        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) return; // Allow user to select text freely

        // Only trigger if clicking on text
        // Use caretRangeFromPoint to get the clicked word
        // Note: caretRangeFromPoint is non-standard in valid TS but available in most browsers. 
        // We cast document to any or check existence.

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
                // We have a position. Now expand to word.
                // We use selection modification which is effective.
                if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                    selection.modify('move', 'backward', 'word');
                    selection.modify('extend', 'forward', 'word');

                    const word = selection.toString().trim();

                    // Filter out punctuation-only or empty
                    if (word && word.match(/[a-zA-Z0-9\u00C0-\u00FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]/)) {
                        setDefinitionHover({ x: e.clientX, y: e.clientY + 15, html: '<div class="animate-pulse text-xs">Loading...</div>' });

                        // Context: rough approximation around the word
                        const context = content;

                        defineWord(word, context, targetLanguage, settingsApiKey).then(def => {
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
        if (!settingsApiKey || !enableTranslation) return;

        const translation = await translateText(content, targetLanguage, settingsApiKey);
        if (translation) {
            setTranslation(currentSessionId!, messageId, translation);
        }
    };



    useEffect(() => {
        if (!usePushToTalk) return;

        const playTock = () => {
            try {
                const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
                if (!AudioContextClass) return;
                const context = new AudioContextClass();
                const oscillator = context.createOscillator();
                const gain = context.createGain();

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(150, context.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(40, context.currentTime + 0.1);

                gain.gain.setValueAtTime(0.1, context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);

                oscillator.connect(gain);
                gain.connect(context.destination);

                oscillator.start();
                oscillator.stop(context.currentTime + 0.1);

                // Clean up after sound completes
                oscillator.onended = () => {
                    try {
                        oscillator.disconnect();
                        gain.disconnect();
                        if (context.state !== 'closed') {
                            context.close().catch(() => {/* ignore close errors */ });
                        }
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                };
            } catch (e) {
                // Silently fail if audio context is blocked
            }
        };


        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const isRedoKey = e.code === (pushToTalkRedoKey || 'KeyR');
            const isSendKey = e.code === (pushToTalkKey || 'Space');
            const isTranslateKey = e.code === (pushToTalkTranslateKey || 'KeyT');

            if ((isSendKey || isRedoKey || isTranslateKey) &&
                !isPTTKeyDown.current && !isPTTRedoKeyDown.current && !isPTTTranslateKeyDown.current) {

                stopSpeech(); // Stop TTS immediately
                playTock();   // Sound feedback

                // Prevent scrolling if Space is used, unless typing
                if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
                    if (isSendKey || isTranslateKey) e.preventDefault();
                }

                if (isRedoKey) {
                    isPTTRedoKeyDown.current = true;
                    pttRedoActiveRef.current = true;
                } else if (isTranslateKey) {
                    if (!enableTranslation) return; // Ignore if disabled
                    isPTTTranslateKeyDown.current = true;
                    pttTranslateActiveRef.current = true;
                } else {
                    isPTTKeyDown.current = true;
                    pttActiveRef.current = true;
                }

                if (!isListeningRef.current) {
                    toggleListeningRef.current?.();
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const isRedoKey = e.code === (pushToTalkRedoKey || 'KeyR');
            const isSendKey = e.code === (pushToTalkKey || 'Space');
            const isTranslateKey = e.code === (pushToTalkTranslateKey || 'KeyT');

            if (isSendKey && isPTTKeyDown.current) {
                isPTTKeyDown.current = false;
                if (isListeningRef.current) toggleListeningRef.current?.();
            }
            if (isRedoKey && isPTTRedoKeyDown.current) {
                isPTTRedoKeyDown.current = false;
                if (isListeningRef.current) toggleListeningRef.current?.();
            }
            if (isTranslateKey && isPTTTranslateKeyDown.current) {
                isPTTTranslateKeyDown.current = false;
                if (isListeningRef.current) toggleListeningRef.current?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [usePushToTalk, pushToTalkKey, pushToTalkRedoKey, pushToTalkTranslateKey, enableTranslation]);

    // --- Auto-Focus Input (ChatGPT-style) ---
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Only handle printable characters
            if (e.key.length !== 1) return;

            // Don't interfere with modifier key combinations (Cmd+K, Ctrl+F, etc.)
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            // Check if we're already in an input/textarea
            const activeElement = document.activeElement;
            if (activeElement?.tagName === 'INPUT' ||
                activeElement?.tagName === 'TEXTAREA' ||
                activeElement?.getAttribute('contenteditable') === 'true') {
                return;
            }

            // Check if any modal is open by looking for common modal indicators
            // This checks for backdrop elements or modal containers
            const hasOpenModal = document.querySelector('[role="dialog"]') ||
                document.querySelector('.modal-backdrop') ||
                editingNodeId !== null; // Don't interfere when editing messages

            if (hasOpenModal) return;

            // Focus the input and let the character through
            if (inputRef.current && !isLoading) {
                inputRef.current.focus();
                // The character will be naturally inserted by the browser
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isLoading, editingNodeId]);


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

    // --- Text-to-Speech (Browser Native Only) ---
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

    // --- Audio / STT ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const toggleListening = async () => {
        const { useOfflineSTT, usePushToTalk } = useSettingsStore.getState();

        if (isListening) {
            setIsTranscribing(true); // Start processing UI
            if (useOfflineSTT) {
                // Stop Media Recorder
                mediaRecorderRef.current?.stop();
                setIsListening(false);
                isListeningRef.current = false;
                // Parsing happens in onstop
            } else {
                // Stop Browser Speech Recognition
                recognitionRef.current?.stop();
                setIsListening(false);
                isListeningRef.current = false;
                // Do NOT send here — send happens in recognition.onend
                // This ensures the final transcript is available
            }
            return;
        }

        // START LISTENING
        initialInputRef.current = input;

        if (useOfflineSTT) {
            // Offline Mode
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                    try {
                        const text = await localWhisperService.transcribe(audioBlob);
                        if (text) {
                            const newText = text.trim();
                            const combinedText = initialInputRef.current + (initialInputRef.current ? ' ' : '') + newText;

                            if (usePushToTalk) {
                                if (pttRedoActiveRef.current) {
                                    // Redo: edit last user message and regenerate
                                    pttRedoActiveRef.current = false;
                                    setInput('');
                                    const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
                                    if (session) {
                                        // Find last user message in thread
                                        let lastUserMsgId: string | null = null;
                                        let nodeId: string | null = session.currentLeafId;
                                        while (nodeId) {
                                            const node = session.messages[nodeId];
                                            if (node?.role === 'user') { lastUserMsgId = node.id; break; }
                                            nodeId = node?.parentId || null;
                                        }
                                        if (lastUserMsgId) {
                                            const { enableGrammarCheck, apiKey } = useSettingsStore.getState();
                                            useChatStore.getState().editMessage(currentSessionId!, lastUserMsgId, combinedText);

                                            if (enableGrammarCheck && apiKey) {
                                                const context = getContextForMessage(lastUserMsgId!);
                                                checkGrammar(combinedText, apiKey, context).then(correction => {
                                                    if (correction) {
                                                        useChatStore.getState().setGrammarCorrection(currentSessionId!, lastUserMsgId!, correction);
                                                    }
                                                });
                                            }

                                            setTimeout(() => generateResponse(), 100);
                                        }
                                    }
                                } else if (pttTranslateActiveRef.current) {
                                    // Translate & Send Logic
                                    pttTranslateActiveRef.current = false;
                                    setInput('');
                                    const { apiKey, enableTranslation, targetLanguage } = useSettingsStore.getState();

                                    if (apiKey && enableTranslation) {
                                        // We need to handle this async but we are in a non-async callback context mostly
                                        // But this func is async so we can use translateText promise
                                        // Actually localWhisperService.transcribe is awaited above.
                                        try {
                                            const translated = await translateText(combinedText, targetLanguage, apiKey);
                                            handleSend(translated || combinedText, combinedText);
                                        } catch (e) {
                                            handleSend(combinedText);
                                        }
                                    } else {
                                        handleSend(combinedText);
                                    }
                                } else {
                                    setInput(''); // Clear input before send
                                    handleSend(combinedText);
                                }
                            } else {
                                setInput(combinedText);
                            }
                        }
                    } catch (error: any) {
                        console.error("Whisper Transcription Error:", error);
                        console.error("Offline Transcription Failed:", error);
                    } finally {
                        setIsTranscribing(false);
                        stream.getTracks().forEach(track => track.stop());
                    }
                };

                mediaRecorder.start();
                setIsListening(true);
                isListeningRef.current = true;
            } catch (err: any) {
                console.error("Microphone Access Error:", err);
                setIsTranscribing(false);
                alert(`Microphone Access Error: ${err.message} `);
            }

        } else {
            // Online Mode
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert("Speech recognition not supported in this browser. Try enabling 'Offline Speech-to-Text' in Settings.");
                return;
            }

            const recognition = new SpeechRecognition();
            recognition.continuous = true; // Keep listening until we explicitly stop
            recognition.interimResults = true;
            recognition.lang = sourceLanguage || 'en-US';

            // Track if this is a PTT session
            // Only strictly enable standard PTT if other special modes aren't active
            if (!pttRedoActiveRef.current && !pttTranslateActiveRef.current) {
                pttActiveRef.current = usePushToTalk;
            }

            recognition.onresult = (event: any) => {
                const currentResult = event.results[event.results.length - 1];
                const transcript = currentResult[0].transcript;

                const fullText = initialInputRef.current + (initialInputRef.current ? ' ' : '') + transcript;
                latestTranscriptRef.current = fullText;
                setInput(fullText);
            };

            recognition.onerror = (event: any) => {
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    console.error("Speech Recognition Error:", event.error);
                }
                setIsListening(false);
                isListeningRef.current = false;
                setIsTranscribing(false);
                pttActiveRef.current = false;
                pttRedoActiveRef.current = false;
            };

            recognition.onend = () => {
                setIsListening(false);
                isListeningRef.current = false;
                setIsTranscribing(false);

                // If this was a PTT session, auto-send or redo
                if (pttActiveRef.current || pttRedoActiveRef.current || pttTranslateActiveRef.current) {
                    const isRedo = pttRedoActiveRef.current;
                    const isTranslate = pttTranslateActiveRef.current;

                    pttActiveRef.current = false;
                    pttRedoActiveRef.current = false;
                    pttTranslateActiveRef.current = false;

                    const textToSend = latestTranscriptRef.current;
                    if (textToSend.trim()) {
                        latestTranscriptRef.current = '';
                        setInput(''); // Clear input box

                        if (isTranslate) {
                            const { apiKey, enableTranslation, targetLanguage } = useSettingsStore.getState();
                            if (apiKey && enableTranslation) {
                                translateText(textToSend, targetLanguage, apiKey).then(translated => {
                                    handleSend(translated || textToSend, textToSend);
                                });
                            } else {
                                handleSend(textToSend);
                            }
                        } else if (isRedo) {
                            // Redo: edit last user message and regenerate
                            setTimeout(() => {
                                const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
                                if (session) {
                                    let lastUserMsgId: string | null = null;
                                    let nodeId: string | null = session.currentLeafId;
                                    while (nodeId) {
                                        const node = session.messages[nodeId];
                                        if (node?.role === 'user') { lastUserMsgId = node.id; break; }
                                        nodeId = node?.parentId || null;
                                    }
                                    if (lastUserMsgId) {
                                        useChatStore.getState().editMessage(currentSessionId!, lastUserMsgId, textToSend);

                                        const { enableGrammarCheck, apiKey } = useSettingsStore.getState();
                                        if (enableGrammarCheck && apiKey) {
                                            const context = getContextForMessage(lastUserMsgId!);
                                            checkGrammar(textToSend, apiKey, context).then(correction => {
                                                if (correction) {
                                                    useChatStore.getState().setGrammarCorrection(currentSessionId!, lastUserMsgId!, correction);
                                                }
                                            });
                                        }

                                        setTimeout(() => generateResponse(), 100);
                                    }
                                }
                            }, 100);
                        } else {
                            // Normal send
                            setTimeout(() => {
                                handleSend(textToSend);
                            }, 100);
                        }
                    }
                }
            };

            recognitionRef.current = recognition;
            recognition.start();
            setIsListening(true);
            isListeningRef.current = true;
        }
    };
    // Keep ref in sync with latest toggleListening on every render
    toggleListeningRef.current = toggleListening;

    // --- Sending Messages (Streaming) ---
    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            setIsStreaming(false);
        }
    };

    const handleSend = async (contentOverride?: string, originalText?: string) => {
        // Authentication Check
        /* const { user, openLoginModal } = useAuthStore.getState();
        if (!user) {
            openLoginModal();
            return;
        } */

        const messageContent = contentOverride || input;
        const currentAttachments = contentOverride ? [] : attachments; // Only use attachments for new messages

        if ((!messageContent.trim() && currentAttachments.length === 0) || !currentSessionId || !activePersona) return;

        if (!contentOverride) {
            setInput('');
            setAttachments([]);
        }

        // If editing, logic depends on Role
        if (editingNodeId && contentOverride) {
            const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
            const editingNode = session?.messages[editingNodeId];

            useChatStore.getState().editMessage(currentSessionId, editingNodeId, messageContent);
            setEditingNodeId(null);
            setEditContent('');

            // Only regenerate if we edited a USER message
            if (editingNode?.role === 'user') {
                await generateResponse();
                // Trigger grammar check for the edited message
                if (enableGrammarCheck && settingsApiKey) {
                    const context = getContextForMessage(editingNodeId!);
                    checkGrammar(messageContent, settingsApiKey, context).then(correction => {
                        if (correction && editingNodeId) {
                            useChatStore.getState().setGrammarCorrection(currentSessionId, editingNodeId, correction);
                        }
                    });
                }
            }
        } else {
            // New Message
            const userMsgId = useChatStore.getState().addMessage(currentSessionId, 'user', messageContent, currentAttachments, originalText);

            // Trigger grammar check in background (don't await)
            if (enableGrammarCheck && settingsApiKey) {
                const context = getContextForMessage(userMsgId);
                checkGrammar(messageContent, settingsApiKey, context).then(correction => {
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

        // 1. Navigate to parent (User Message)
        useChatStore.setState(state => {
            const sess = state.sessions.find(s => s.id === currentSessionId);
            if (sess) {
                // Remove the old model response from children of parent
                if (message.parentId && sess.messages[message.parentId]) {
                    // Logic to just clear current leaf? 
                    // Simpler: Just regenerate from parent.
                    // But wait, if user wants to regen a SPECIFIC model response? 
                    // Actually, usually we regen the LAST response. 
                    // If we are regenerating a helper message, we just branch from its parent.
                }
                sess.currentLeafId = message.parentId; // Point to User Message
                return { ...state };
            }
            return state;
        });

        await generateResponse();

        // Trigger grammar check for the parent user message (if it exists and doesn't have one)
        if (enableGrammarCheck && settingsApiKey && message.parentId) {
            const parentMsg = session.messages[message.parentId];
            if (parentMsg && parentMsg.role === 'user' && !parentMsg.grammarCorrection) {
                const context = getContextForMessage(message.parentId!);
                checkGrammar(parentMsg.content, settingsApiKey, context).then(correction => {
                    if (correction) {
                        useChatStore.getState().setGrammarCorrection(currentSessionId, message.parentId!, correction);
                    }
                });
            }
        }
    };

    // Helper to generate response from the current state of the session
    const generateResponse = async () => {
        setIsLoading(true);
        setIsStreaming(true);

        const currentSession = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
        if (!currentSession || !currentSession.currentLeafId || !activePersona) {
            setIsLoading(false);
            setIsStreaming(false);
            return;
        }

        // 1. Build History
        const thread: MessageNode[] = [];
        let curr: string | null = currentSession.currentLeafId;
        while (curr) {
            const n: MessageNode = currentSession.messages[curr];
            if (n) { thread.unshift(n); curr = n.parentId; } else break;
        }

        const apiHistory = [
            { role: 'user', content: `System Instruction: ${activePersona.systemPrompt} ` },
            ...thread.map(m => ({ role: m.role, content: m.content, attachments: m.attachments }))
        ];

        // 2. Create Placeholder for Model Response
        const modelNodeId = useChatStore.getState().addMessage(currentSessionId!, 'model', '...');

        // 3. Stream Response
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

                // Accumulate chunk into text
                currentAccruedText += chunk;

                // Update state immediately so user sees text appear
                setStreamingNodeId(currentMsgId);
                setStreamingContent(currentAccruedText);
                useChatStore.getState().updateMessageContent(currentSessionId!, currentMsgId, currentAccruedText);

                // Chat Mode: Split into separate message bubbles at sentence boundaries, with delay
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

                            // DELAY between sentences — this is the visible pause
                            await new Promise(r => setTimeout(r, 600));

                            const newMsgId = useChatStore.getState().addMessage(currentSessionId!, 'model', '');
                            currentMsgId = newMsgId;
                            currentAccruedText = remainder;

                            // Show remainder immediately in new bubble
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
            if (e.name !== 'AbortError') {
                const errorMessage = e.message || e.toString();
                if (errorMessage.includes('403') || errorMessage.includes('Method doesn\'t allow unregistered callers')) {
                    useChatStore.getState().addMessage(currentSessionId!, 'model', `**Authentication Required**

It looks like you haven't set up your API Key yet.

To get started:
1. Go to [Google AI Studio](https://aistudio.google.com/app/api-keys).
2. Click on "Create API key".
3. Copy the key.
4. Paste it into the Settings (gear icon) in this app.`);
                } else {
                    useChatStore.getState().addMessage(currentSessionId!, 'model', `**Error**: ${errorMessage}`);
                }
            }
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
            setStreamingNodeId(null);
            setStreamingContent('');
            abortControllerRef.current = null;

            // Auto-speak: read AI response aloud if enabled
            if (useSettingsStore.getState().autoSpeak) {
                const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
                if (session && session.currentLeafId) {
                    const lastMsg = session.messages[session.currentLeafId];
                    if (lastMsg && lastMsg.role === 'model') {
                        speakMessage(lastMsg.content, lastMsg.id);
                    }
                }
            }
        }
    };

    useEffect(() => {
        if (!isLoading && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isLoading]);

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
                                            <button onClick={cancelEditing} className="px-3 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600 transition-colors">Cancel</button>
                                            <button onClick={() => handleSend(editContent)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors">Save</button>
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
                                            <>
                                                <div
                                                    onClick={(e) => handleBubbleClick(msg.content, e)}
                                                    className={cn(
                                                        "rounded-2xl px-5 py-3 relative group/bubble text-left cursor-text",
                                                        msg.role === 'user'
                                                            ? (msg.content ? "bg-blue-600 text-white" : "hidden")
                                                            : msg.content.startsWith('**Error**') ? "bg-red-900/20 border border-red-500/50 text-red-200" : "bg-gray-800 text-gray-100"
                                                    )}>
                                                    {/* Attachments (Inside bubble for Model) */}
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

                                                    {msg.originalText && (
                                                        <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm self-stretch text-left">
                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-300/50 animate-pulse" />
                                                                <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Captured Input</span>
                                                            </div>
                                                            <div className="text-sm text-white/90 leading-relaxed italic font-serif">
                                                                "{msg.originalText}"
                                                            </div>
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

                                                {/* Grammar Correction Display */}
                                                {msg.role === 'user' && msg.grammarCorrection && (
                                                    <div className="mt-2 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <div className="inline-block max-w-[90%] bg-yellow-900/10 border border-yellow-600/20 rounded-lg p-3 text-sm text-yellow-200/80 shadow-sm backdrop-blur-sm">
                                                            <div
                                                                className="prose prose-sm prose-invert prose-yellow leading-snug [&>b]:text-yellow-100/90"
                                                                dangerouslySetInnerHTML={{ __html: msg.grammarCorrection }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Translation Display */}
                                                {msg.translation && (
                                                    <div className="mt-2 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <div className="inline-block max-w-[90%] bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-3 text-sm text-indigo-100 shadow-sm backdrop-blur-sm">
                                                            <div className="flex items-center gap-2 mb-1 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                                                                <Globe className="w-3 h-3" />
                                                                <span>Translation ({targetLanguage})</span>
                                                            </div>
                                                            <div className="prose prose-sm prose-invert prose-indigo leading-relaxed">
                                                                {msg.translation}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* Message Controls */}
                                        <div className={cn("flex items-center gap-2 -mt-1 select-none h-6", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                            {/* Navigation */}
                                            {showNav && (
                                                <div className="flex items-center text-xs font-medium text-gray-500">
                                                    <button
                                                        onClick={() => navigateBranch(currentSessionId, msg.id, 'prev')}
                                                        disabled={currentSiblingIndex === 0}
                                                        className="px-1 hover:text-gray-300 disabled:opacity-30 transition-colors"
                                                    >
                                                        &lt;
                                                    </button>
                                                    <span className="mx-0.5">{currentSiblingIndex + 1}/{totalSiblings}</span>
                                                    <button
                                                        onClick={() => navigateBranch(currentSessionId, msg.id, 'next')}
                                                        disabled={currentSiblingIndex === totalSiblings - 1}
                                                        className="px-1 hover:text-gray-300 disabled:opacity-30 transition-colors"
                                                    >
                                                        &gt;
                                                    </button>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {msg.role === 'user' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleTranslateMessage(msg.id, msg.content)}
                                                            className="p-1 text-gray-400 hover:text-white transition-colors"
                                                            title="Translate"
                                                        >
                                                            <Globe className="w-3.5 h-3.5" />
                                                        </button>
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
                                                    <>
                                                        <button
                                                            onClick={() => handleTranslateMessage(msg.id, msg.content)}
                                                            className="p-1 text-gray-400 hover:text-white transition-colors"
                                                            title="Translate"
                                                        >
                                                            <Globe className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => navigator.clipboard.writeText(msg.content)}
                                                            className="p-1 text-gray-400 hover:text-white transition-colors"
                                                            title="Copy"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleRegenerate(msg.id)}
                                                            className="p-1 text-gray-400 hover:text-white transition-colors"
                                                            title="Retry"
                                                        >
                                                            <RotateCw className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => startEditing(msg)}
                                                            className="p-1 text-gray-400 hover:text-white transition-colors"
                                                            title="Edit Response"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
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
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
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

            {/* Drag & Drop Overlay */}
            {
                isDragging && (
                    <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm z-50 flex flex-col items-center justify-center border-2 border-blue-500 border-dashed m-4 rounded-xl pointer-events-none">
                        <Paperclip className="w-12 h-12 text-blue-400 mb-2" />
                        <p className="text-lg font-semibold text-blue-100">Drop files here</p>
                    </div>
                )
            }

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
                        {/* Transcribing Indicator inside Input Area */}
                        {isTranscribing && (
                            <div className="absolute -top-8 left-0 flex items-center gap-2 text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 backdrop-blur-sm animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span className="text-xs font-medium">Transcribing Audio...</span>
                            </div>
                        )}
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
                                ref={inputRef}
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
