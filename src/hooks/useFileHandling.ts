import { useState, useRef, useCallback } from 'react';
import type { Attachment } from '../types/message';

export interface UseFileHandlingReturn {
    attachments: Attachment[];
    isDragging: boolean;
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handlePaste: (e: React.ClipboardEvent) => Promise<void>;
    handleDragEnter: (e: React.DragEvent) => void;
    handleDragLeave: (e: React.DragEvent) => void;
    handleDragOver: (e: React.DragEvent) => void;
    handleDrop: (e: React.DragEvent) => Promise<void>;
    removeAttachment: (id: string) => void;
    clearAttachments: () => void;
}

export const useFileHandling = (): UseFileHandlingReturn => {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    const processFiles = useCallback(async (files: File[]) => {
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
    }, []);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            await processFiles(Array.from(e.target.files));
        }
    }, [processFiles]);

    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
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
    }, [processFiles]);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await processFiles(Array.from(e.dataTransfer.files));
        }
    }, [processFiles]);

    const removeAttachment = useCallback((id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    }, []);

    const clearAttachments = useCallback(() => {
        setAttachments([]);
    }, []);

    return {
        attachments,
        isDragging,
        handleFileSelect,
        handlePaste,
        handleDragEnter,
        handleDragLeave,
        handleDragOver,
        handleDrop,
        removeAttachment,
        clearAttachments
    };
};
