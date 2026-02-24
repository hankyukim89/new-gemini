import React from 'react';
import { User as UserIcon, Bot, AlertTriangle, Edit2, Copy, RotateCw, Volume2, Loader2, Globe, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '../../lib/utils';
import { CodeBlock } from '../CodeBlock';
import type { MessageNode } from '../../types/message';

interface MessageBubbleProps {
    message: MessageNode;
    isUser: boolean;
    isStreaming?: boolean;
    streamingContent?: string;
    isSpeaking?: boolean;
    showNavigation?: boolean;
    currentSiblingIndex?: number;
    totalSiblings?: number;
    targetLanguage?: string;
    onNavigate?: (direction: 'prev' | 'next') => void;
    onTranslate?: () => void;
    onCopy?: () => void;
    onEdit?: () => void;
    onRegenerate?: () => void;
    onSpeak?: () => void;
    onBubbleClick?: (e: React.MouseEvent) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isUser,
    isStreaming,
    streamingContent,
    isSpeaking,
    showNavigation,
    currentSiblingIndex = 0,
    totalSiblings = 1,
    targetLanguage,
    onNavigate,
    onTranslate,
    onCopy,
    onEdit,
    onRegenerate,
    onSpeak,
    onBubbleClick
}) => {
    const displayContent = (isStreaming && streamingContent) ? streamingContent : message.content;

    return (
        <div className={cn(
            "flex gap-4 max-w-4xl mx-auto group",
            isUser ? "flex-row-reverse" : "flex-row"
        )}>
            {/* Avatar */}
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 self-start mt-1",
                isUser ? "bg-blue-600" : "bg-purple-600"
            )}>
                {isUser ? <UserIcon className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>

            <div className={cn("flex flex-col max-w-[80%] gap-1", isUser && "items-end")}>
                {/* Attachments (User - above bubble) */}
                {isUser && message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-1 justify-end">
                        {message.attachments.map(att => (
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
                )}

                {/* Message Content */}
                {(message.content || !isUser) && (
                    <>
                        <div
                            onClick={onBubbleClick}
                            className={cn(
                                "rounded-2xl px-5 py-3 relative group/bubble text-left cursor-text",
                                isUser
                                    ? (message.content ? "bg-blue-600 text-white" : "hidden")
                                    : message.content.startsWith('**Error**')
                                        ? "bg-red-900/20 border border-red-500/50 text-red-200"
                                        : "bg-gray-800 text-gray-100"
                            )}
                        >
                            {/* Attachments (Model - inside bubble) */}
                            {!isUser && message.attachments && message.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {message.attachments.map(att => (
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

                            {/* Original Text (for translated messages) */}
                            {message.originalText && (
                                <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm self-stretch text-left">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-300/50 animate-pulse" />
                                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Captured Input</span>
                                    </div>
                                    <div className="text-sm text-white/90 leading-relaxed italic font-serif">
                                        "{message.originalText}"
                                    </div>
                                </div>
                            )}

                            {/* Error Icon */}
                            {message.content.startsWith('**Error**') && <AlertTriangle className="w-4 h-4 mb-2 text-red-400" />}

                            {/* Markdown Content */}
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
                                    {displayContent}
                                </ReactMarkdown>
                            </div>
                        </div>

                        {/* Grammar Correction */}
                        {isUser && message.grammarCorrection && (
                            <div className="mt-2 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="inline-block max-w-[90%] bg-yellow-900/10 border border-yellow-600/20 rounded-lg p-3 text-sm text-yellow-200/80 shadow-sm backdrop-blur-sm">
                                    <div
                                        className="prose prose-sm prose-invert prose-yellow leading-snug [&>b]:text-yellow-100/90"
                                        dangerouslySetInnerHTML={{ __html: message.grammarCorrection }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Translation */}
                        {message.translation && (
                            <div className="mt-2 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="inline-block max-w-[90%] bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-3 text-sm text-indigo-100 shadow-sm backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-1 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                                        <Globe className="w-3 h-3" />
                                        <span>Translation ({targetLanguage})</span>
                                    </div>
                                    <div className="prose prose-sm prose-invert prose-indigo leading-relaxed">
                                        {message.translation}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Message Controls */}
                <div className={cn("flex items-center gap-2 -mt-1 select-none h-6", isUser ? "justify-end" : "justify-start")}>
                    {/* Navigation */}
                    {showNavigation && onNavigate && (
                        <div className="flex items-center text-xs font-medium text-gray-500">
                            <button
                                onClick={() => onNavigate('prev')}
                                disabled={currentSiblingIndex === 0}
                                className="px-1 hover:text-gray-300 disabled:opacity-30 transition-colors"
                            >
                                &lt;
                            </button>
                            <span className="mx-0.5">{currentSiblingIndex + 1}/{totalSiblings}</span>
                            <button
                                onClick={() => onNavigate('next')}
                                disabled={currentSiblingIndex === totalSiblings - 1}
                                className="px-1 hover:text-gray-300 disabled:opacity-30 transition-colors"
                            >
                                &gt;
                            </button>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isUser ? (
                            <>
                                {onTranslate && (
                                    <button
                                        onClick={onTranslate}
                                        className="p-1 text-gray-400 hover:text-white transition-colors"
                                        title="Translate"
                                    >
                                        <Globe className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onCopy && (
                                    <button
                                        onClick={onCopy}
                                        className="p-1 text-gray-400 hover:text-white transition-colors"
                                        title="Copy"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onEdit && (
                                    <button
                                        onClick={onEdit}
                                        className="p-1 text-gray-400 hover:text-white transition-colors"
                                        title="Edit text"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                {onTranslate && (
                                    <button
                                        onClick={onTranslate}
                                        className="p-1 text-gray-400 hover:text-white transition-colors"
                                        title="Translate"
                                    >
                                        <Globe className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onCopy && (
                                    <button
                                        onClick={onCopy}
                                        className="p-1 text-gray-400 hover:text-white transition-colors"
                                        title="Copy"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onRegenerate && (
                                    <button
                                        onClick={onRegenerate}
                                        className="p-1 text-gray-400 hover:text-white transition-colors"
                                        title="Retry"
                                    >
                                        <RotateCw className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onEdit && (
                                    <button
                                        onClick={onEdit}
                                        className="p-1 text-gray-400 hover:text-white transition-colors"
                                        title="Edit Response"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onSpeak && (
                                    <button
                                        onClick={onSpeak}
                                        className={cn(
                                            "p-1 transition-colors",
                                            isSpeaking ? "text-green-400 animate-pulse" : "text-gray-400 hover:text-white"
                                        )}
                                        title={isSpeaking ? "Stop Speaking" : "Read Aloud"}
                                    >
                                        {isSpeaking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
