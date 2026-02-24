import React from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
    text: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text }) => (
    <div className="group relative inline-block ml-2 cursor-help align-middle">
        <Info className="w-4 h-4 text-gray-400 hover:text-blue-400 transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 border border-gray-700 text-xs text-gray-300 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-center pointer-events-none data-[side=top]:animate-slide-up-fade">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-gray-700"></div>
        </div>
    </div>
);
