import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';


export interface Attachment {
    id: string;
    type: 'image' | 'file';
    mimeType: string;
    data: string; // Base64 or URL
    name: string;
}

export interface MessageNode {
    id: string;
    role: 'user' | 'model';
    content: string;
    attachments?: Attachment[];
    timestamp: number;
    parentId: string | null;
    childrenIds: string[];
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Record<string, MessageNode>; // Data store: ID -> Node
    rootMessageIds: string[];              // List of top-level message IDs
    currentLeafId: string | null;          // The tip of the current branch
    personaId?: string;
    createdAt: number;
}

export interface ChatState {
    sessions: ChatSession[];
    currentSessionId: string | null;
    addSession: () => string;
    selectSession: (id: string) => void;

    // Core Tree Actions
    addMessage: (sessionId: string, role: 'user' | 'model', content: string, attachments?: Attachment[]) => string;
    editMessage: (sessionId: string, originalMessageId: string, newContent: string) => void;
    updateMessageContent: (sessionId: string, messageId: string, newContent: string) => void; // In-place update for streaming
    navigateBranch: (sessionId: string, nodeId: string, direction: 'prev' | 'next') => void;
    renameSession: (sessionId: string, newTitle: string) => void;

    deleteSession: (id: string) => void;
    clearSessions: () => void;
}

// Helper to find the "latest" leaf descendant for a given node
// This is used when switching branches to auto-select the most recent conversation path
const findMostRecentLeaf = (nodeId: string, messages: Record<string, MessageNode>): string => {
    let currentId = nodeId;
    while (true) {
        const node = messages[currentId];
        if (!node || node.childrenIds.length === 0) {
            return currentId;
        }
        // Heuristic: Always take the last child (most recently created branch)
        // or we could track "activeChildId" per node for sticky branches.
        // For now, let's take the LAST child, which represents the latest edit/generation.
        currentId = node.childrenIds[node.childrenIds.length - 1];
    }
};

export const useChatStore = create<ChatState>()(
    persist(
        (set) => ({
            sessions: [],
            currentSessionId: null,
            addSession: () => {
                const newSession: ChatSession = {
                    id: uuidv4(),
                    title: 'New Chat',
                    messages: {},
                    rootMessageIds: [],
                    currentLeafId: null,
                    createdAt: Date.now(),
                };
                set((state) => ({
                    sessions: [newSession, ...state.sessions],
                    currentSessionId: newSession.id,
                }));
                return newSession.id;
            },
            selectSession: (id) => set({ currentSessionId: id }),

            addMessage: (sessionId, role, content, attachments = []) => {
                const newMessageId = uuidv4();
                set((state) => {
                    const sessionIndex = state.sessions.findIndex((s) => s.id === sessionId);
                    if (sessionIndex === -1) return state;

                    const session = state.sessions[sessionIndex];
                    const parentId = session.currentLeafId; // Append to current leaf

                    const newMessage: MessageNode = {
                        id: newMessageId,
                        role,
                        content,
                        attachments,
                        timestamp: Date.now(),
                        parentId: parentId,
                        childrenIds: []
                    };

                    // Update parent's children array OR rootMessageIds if no parent
                    const updatedMessages = { ...session.messages, [newMessage.id]: newMessage };
                    let updatedRootIds = session.rootMessageIds || [];

                    if (parentId && updatedMessages[parentId]) {
                        updatedMessages[parentId] = {
                            ...updatedMessages[parentId],
                            childrenIds: [...updatedMessages[parentId].childrenIds, newMessage.id]
                        };
                    } else if (!parentId) {
                        // It is a root message
                        updatedRootIds = [...updatedRootIds, newMessage.id];
                    }

                    // Update Title Logic
                    let newTitle = session.title;
                    if (Object.keys(updatedMessages).length === 1 && role === 'user') {
                        newTitle = content.slice(0, 30) + (content.length > 30 ? '...' : '');
                    }

                    const updatedSessions = [...state.sessions];
                    updatedSessions[sessionIndex] = {
                        ...session,
                        messages: updatedMessages,
                        rootMessageIds: updatedRootIds,
                        currentLeafId: newMessage.id,
                        title: newTitle
                    };

                    return { sessions: updatedSessions };
                });
                return newMessageId;
            },

            editMessage: (sessionId, originalMessageId, newContent) => {
                set((state) => {
                    const sessionIndex = state.sessions.findIndex((s) => s.id === sessionId);
                    if (sessionIndex === -1) return state;

                    const session = state.sessions[sessionIndex];
                    const originalNode = session.messages[originalMessageId];
                    if (!originalNode) return state;

                    // Create Branch: New node with same parent
                    const newMessage: MessageNode = {
                        id: uuidv4(),
                        role: originalNode.role,
                        content: newContent,
                        timestamp: Date.now(),
                        parentId: originalNode.parentId,
                        childrenIds: []
                    };

                    const updatedMessages = { ...session.messages, [newMessage.id]: newMessage };
                    let updatedRootIds = session.rootMessageIds || [];

                    // Add to parent's children
                    if (originalNode.parentId && updatedMessages[originalNode.parentId]) {
                        const parent = updatedMessages[originalNode.parentId];
                        updatedMessages[originalNode.parentId] = {
                            ...parent,
                            childrenIds: [...parent.childrenIds, newMessage.id]
                        };
                    } else if (!originalNode.parentId) {
                        // It's a root message, adding a sibling root
                        updatedRootIds = [...updatedRootIds, newMessage.id];
                    }

                    const updatedSessions = [...state.sessions];
                    updatedSessions[sessionIndex] = {
                        ...session,
                        messages: updatedMessages,
                        rootMessageIds: updatedRootIds,
                        currentLeafId: newMessage.id // Switch view to new edit
                    };

                    return { sessions: updatedSessions };
                });
            },

            updateMessageContent: (sessionId, messageId, newContent) => {
                set((state) => {
                    const sessionIndex = state.sessions.findIndex((s) => s.id === sessionId);
                    if (sessionIndex === -1) return state;

                    const session = state.sessions[sessionIndex];
                    const node = session.messages[messageId];
                    if (!node) return state;

                    // In-place update (mutation of the specific node only)
                    // We do NOT create a new branch. This is for streaming.
                    const updatedNode = { ...node, content: newContent };
                    const updatedMessages = { ...session.messages, [messageId]: updatedNode };

                    const updatedSessions = [...state.sessions];
                    updatedSessions[sessionIndex] = {
                        ...session,
                        messages: updatedMessages,
                    };

                    return { sessions: updatedSessions };
                });
            },

            navigateBranch: (sessionId, nodeId, direction) => {
                set((state) => {
                    const sessionIndex = state.sessions.findIndex((s) => s.id === sessionId);
                    if (sessionIndex === -1) return state;

                    const session = state.sessions[sessionIndex];
                    const node = session.messages[nodeId];
                    if (!node) return state;

                    let siblings: string[] = [];
                    if (node.parentId) {
                        const parent = session.messages[node.parentId];
                        siblings = parent ? parent.childrenIds : [];
                    } else {
                        // Root node siblings
                        siblings = session.rootMessageIds || [];
                    }

                    const currentIndex = siblings.indexOf(nodeId);
                    if (currentIndex === -1 || siblings.length <= 1) return state;

                    let targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
                    // Clamp
                    if (targetIndex < 0) targetIndex = 0;
                    if (targetIndex >= siblings.length) targetIndex = siblings.length - 1;

                    const targetNodeId = siblings[targetIndex];

                    // If we didn't actually change, return
                    if (targetNodeId === nodeId) return state;

                    // Find the leaf for this new path
                    const newLeafId = findMostRecentLeaf(targetNodeId, session.messages);

                    const updatedSessions = [...state.sessions];
                    updatedSessions[sessionIndex] = {
                        ...session,
                        currentLeafId: newLeafId
                    };

                    return { sessions: updatedSessions };
                });
            },

            renameSession: (sessionId: string, newTitle: string) => {
                set((state) => ({
                    sessions: state.sessions.map((s) =>
                        s.id === sessionId ? { ...s, title: newTitle } : s
                    ),
                }));
            },

            deleteSession: (id) =>
                set((state) => ({
                    sessions: state.sessions.filter((s) => s.id !== id),
                    currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
                })),
            clearSessions: () => set({ sessions: [], currentSessionId: null }),
        }),
        {
            name: 'gemini-chat-tree-storage',
            version: 3, // Bump version
            migrate: (persistedState: any, version) => {
                const state = persistedState as ChatState;
                if (version < 3) {
                    // Migration: Backfill rootMessageIds for existing sessions
                    const updatedSessions = state.sessions.map(session => {
                        const rootIds: string[] = [];
                        // Find all nodes with null parentId
                        Object.values(session.messages).forEach(msg => {
                            if (!msg.parentId) {
                                rootIds.push(msg.id);
                            }
                        });
                        // Sort by timestamp if possible to maintain order? 
                        // Or just simplistic push. Sort by created time is safer.
                        rootIds.sort((a, b) => session.messages[a].timestamp - session.messages[b].timestamp);

                        return { ...session, rootMessageIds: rootIds };
                    });
                    return { ...state, sessions: updatedSessions };
                }
                return persistedState;
            }
        }
    )
);
