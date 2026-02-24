import React, { useRef, useEffect } from 'react';
import { Bot, Paperclip } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { MessageNode } from '../../types/message';

interface MessageListProps {
    messages: MessageNode[];
    currentSessionId: string | null;
    streamingNodeId: string | null;
    streamingContent: string;
    isSpeaking: string | null;
    editingNodeId: string | null;
    editContent: string;
    targetLanguage: string;
    isDragging: boolean;
    onNavigateBranch: (sessionId: string, messageId: string, direction: 'prev' | 'next') => void;
    onTranslateMessage: (messageId: string, content: string) => void;
    onStartEditing: (message: MessageNode) => void;
    onCancelEditing: () => void;
    onSaveEdit: (content: string) => void;
    onRegenerate: (messageId: string) => void;
    onSpeak: (text: string, msgId: string) => void;
    onBubbleClick: (content: string, e: React.MouseEvent) => void;
    isLoading: boolean;
    isStreaming: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    currentSessionId,
    streamingNodeId,
    streamingContent,
    isSpeaking,
    editingNodeId,
    editContent,
    targetLanguage,
    isDragging,
    onNavigateBranch,
    onTranslateMessage,
    onStartEditing,
    onCancelEditing,
    onSaveEdit,
    onRegenerate,
    onSpeak,
    onBubbleClick,
    isLoading,
    isStreaming
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages.length, streamingContent]);

    // Empty state
    if (messages.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <Bot className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-400 mb-2">Start a conversation</h3>
                    <p className="text-gray-500">Type a message or use voice input to begin</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 relative">
            {messages.map((msg) => {
                // Calculate navigation info
                const session = messages.find(() => currentSessionId);
                const parent = msg.parentId ? messages.find(m => m.id === msg.parentId) : null;
                const siblings = parent?.childrenIds || [];
                const currentSiblingIndex = siblings.indexOf(msg.id);
                const totalSiblings = siblings.length;
                const showNav = totalSiblings > 1;

                // Check if editing
                if (editingNodeId === msg.id) {
                    return (
                        <div key={msg.id} className="flex gap-4 max-w-4xl mx-auto group">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 self-start mt-1">
                                {msg.role === 'user' ? '👤' : '🤖'}
                            </div>
                            <div className="bg-gray-800 rounded-2xl p-3 border border-blue-500 w-full max-w-[80%]">
                                <textarea
                                    value={editContent}
                                    onChange={(e) => onSaveEdit(e.target.value)}
                                    className="w-full bg-gray-900 border-gray-700 rounded p-2 text-white text-sm"
                                    rows={3}
                                />
                                <div className="flex gap-2 mt-2 justify-end">
                                    <button
                                        onClick={onCancelEditing}
                                        className="px-3 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => onSaveEdit(editContent)}
                                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                }

                return (
                    <MessageBubble
                        key={msg.id}
                        message={msg}
                        isUser={msg.role === 'user'}
                        isStreaming={streamingNodeId === msg.id}
                        streamingContent={streamingNodeId === msg.id ? streamingContent : undefined}
                        isSpeaking={isSpeaking === msg.id}
                        showNavigation={showNav}
                        currentSiblingIndex={currentSiblingIndex}
                        totalSiblings={totalSiblings}
                        targetLanguage={targetLanguage}
                        onNavigate={(direction) => currentSessionId && onNavigateBranch(currentSessionId, msg.id, direction)}
                        onTranslate={() => onTranslateMessage(msg.id, msg.content)}
                        onCopy={() => navigator.clipboard.writeText(msg.content)}
                        onEdit={() => onStartEditing(msg)}
                        onRegenerate={() => onRegenerate(msg.id)}
                        onSpeak={() => onSpeak(msg.content, msg.id)}
                        onBubbleClick={(e) => onBubbleClick(msg.content, e)}
                    />
                );
            })}

            {/* Loading Indicator */}
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

            {/* Drag & Drop Overlay */}
            {isDragging && (
                <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm z-50 flex flex-col items-center justify-center border-2 border-blue-500 border-dashed m-4 rounded-xl pointer-events-none">
                    <Paperclip className="w-12 h-12 text-blue-400 mb-2" />
                    <p className="text-lg font-semibold text-blue-100">Drop files here</p>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};
