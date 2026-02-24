import React from 'react';
import { X, FileText } from 'lucide-react';
import type { Attachment } from '../../types/message';

interface AttachmentPreviewProps {
    attachments: Attachment[];
    onRemove: (id: string) => void;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachments, onRemove }) => {
    if (attachments.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 p-2 bg-gray-900/50 rounded-lg border border-gray-800">
            {attachments.map((attachment) => (
                <div key={attachment.id} className="relative group">
                    {attachment.type === 'image' ? (
                        <div className="relative">
                            <img
                                src={attachment.data}
                                alt={attachment.name}
                                className="h-20 w-20 object-cover rounded-lg border border-gray-700"
                            />
                            <button
                                onClick={() => onRemove(attachment.id)}
                                className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <div className="relative flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
                            <FileText className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-gray-300 max-w-[100px] truncate">
                                {attachment.name}
                            </span>
                            <button
                                onClick={() => onRemove(attachment.id)}
                                className="p-1 hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
