import React from 'react';
import { useChatStore } from '../store/useChatStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../lib/utils';

export const Sidebar: React.FC = () => {
    const { sessions, currentSessionId, selectSession, addSession, deleteSession } = useChatStore();
    const { isSidebarCollapsed, toggleSidebar } = useSettingsStore();

    const handleNewChat = () => {
        const newId = addSession();
        selectSession(newId);
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        deleteSession(id);
    };

    return (
        <div
            className={cn(
                "h-full bg-black/95 border-r border-gray-800 flex flex-col transition-all duration-300 relative z-10",
                isSidebarCollapsed ? "w-16" : "w-72"
            )}
        >
            {/* Header / New Chat */}
            <div className="p-4 flex items-center justify-between">
                <button
                    onClick={handleNewChat}
                    className={cn(
                        "flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all border border-gray-700",
                        isSidebarCollapsed ? "p-3 justify-center w-full" : "px-4 py-2 w-full"
                    )}
                    title="New Chat"
                >
                    <Plus className="w-5 h-5" />
                    {!isSidebarCollapsed && <span className="font-medium text-sm">New Chat</span>}
                </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-800">
                {!isSidebarCollapsed && (
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        History
                    </div>
                )}

                {sessions.map((session) => (
                    <div
                        key={session.id}
                        onClick={() => selectSession(session.id)}
                        className={cn(
                            "group relative flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border border-transparent",
                            currentSessionId === session.id
                                ? "bg-gray-800/80 text-white border-gray-700"
                                : "text-gray-400 hover:bg-gray-900 hover:text-gray-200",
                            isSidebarCollapsed && "justify-center"
                        )}
                        title={session.title}
                    >
                        <MessageSquare className={cn("w-4 h-4 shrink-0", currentSessionId === session.id ? "text-blue-400" : "text-gray-600")} />

                        {!isSidebarCollapsed && (
                            <>
                                <span className="text-sm truncate flex-1">{session.title || 'New Chat'}</span>
                                <button
                                    onClick={(e) => handleDelete(e, session.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded transition-all"
                                    title="Delete Chat"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                ))}

                {sessions.length === 0 && !isSidebarCollapsed && (
                    <div className="text-center py-8 text-gray-600 text-sm">
                        No chat history
                    </div>
                )}
            </div>

            {/* Footer Toggle */}
            <div className="p-4 border-t border-gray-800 flex justify-end">
                <button
                    onClick={toggleSidebar}
                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
                    title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
};
