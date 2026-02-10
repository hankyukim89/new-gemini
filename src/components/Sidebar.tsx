import React from 'react';
import { useChatStore } from '../store/useChatStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../lib/utils';

export const Sidebar: React.FC = () => {
    const { sessions, currentSessionId, selectSession, addSession, deleteSession, renameSession } = useChatStore();
    const { isSidebarCollapsed, toggleSidebar } = useSettingsStore();
    const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null);
    const [editTitle, setEditTitle] = React.useState('');

    const handleNewChat = () => {
        const newId = addSession();
        selectSession(newId);
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        deleteSession(id);
    };

    const startEditing = (e: React.MouseEvent, session: { id: string; title: string }) => {
        e.stopPropagation();
        setEditingSessionId(session.id);
        setEditTitle(session.title);
    };

    // Handle renaming
    const saveTitle = (id: string) => {
        if (editTitle.trim()) {
            renameSession(id, editTitle.trim());
        }
        setEditingSessionId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
        if (e.key === 'Enter') {
            saveTitle(id);
        } else if (e.key === 'Escape') {
            setEditingSessionId(null);
        }
    };

    return (
        <div
            className={cn(
                "h-full bg-black/95 border-r border-gray-800 flex flex-col transition-all duration-300 relative z-10",
                isSidebarCollapsed ? "w-0 border-r-0" : "w-72"
            )}
        >
            {/* Floating Toggle Button - Visible in both states */}
            <button
                onClick={toggleSidebar}
                className={cn(
                    "absolute top-1/2 -translate-y-1/2 z-50 p-1 rounded-full border border-gray-700 bg-black text-gray-400 hover:text-white transition-all shadow-lg flex items-center justify-center w-8 h-8",
                    isSidebarCollapsed ? "-right-4" : "-right-4"
                )}
                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
                {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Inner Content Wrapper - Hides when collapsed */}
            <div className={cn("flex flex-col h-full w-72", isSidebarCollapsed && "hidden")}>
                {/* Header / New Chat */}
                <div className="p-4 flex items-center justify-between">
                    <button
                        onClick={handleNewChat}
                        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all border border-gray-700 px-4 py-2 w-full"
                        title="New Chat"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium text-sm">New Chat</span>
                    </button>


                </div>

                {/* Session List */}
                <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-800">
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        History
                    </div>

                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            onClick={() => selectSession(session.id)}
                            className={cn(
                                "group relative flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border border-transparent",
                                currentSessionId === session.id
                                    ? "bg-gray-800/80 text-white border-gray-700"
                                    : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
                            )}
                            title={session.title}
                        >
                            <MessageSquare className={cn("w-4 h-4 shrink-0", currentSessionId === session.id ? "text-blue-400" : "text-gray-600")} />

                            {editingSessionId === session.id ? (
                                <input
                                    autoFocus
                                    type="text"
                                    className="flex-1 bg-gray-900 text-white text-sm px-1 py-0.5 rounded border border-blue-500 focus:outline-none"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onBlur={() => saveTitle(session.id)}
                                    onKeyDown={(e) => handleKeyDown(e, session.id)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span className="text-sm truncate flex-1">{session.title || 'New Chat'}</span>
                            )}

                            {editingSessionId !== session.id && (
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => startEditing(e, session)}
                                        className="p-1 hover:bg-gray-700/50 text-gray-500 hover:text-gray-300 rounded"
                                        title="Rename"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, session.id)}
                                        className="p-1 hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded"
                                        title="Delete Chat"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}

                    {sessions.length === 0 && (
                        <div className="text-center py-8 text-gray-600 text-sm">
                            No chat history
                        </div>
                    )}
                </div>
                {/* Footer / User Profile Placeholder */}
                <div className="p-4 border-t border-gray-800">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-all">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                            U
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="text-sm font-medium text-gray-200 truncate">User Account</div>
                            <div className="text-xs text-gray-500 truncate">user@example.com</div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};
