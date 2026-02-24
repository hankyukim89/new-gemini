import React from 'react';

interface ToggleProps {
    checked: boolean;
    onChange: (value: boolean) => void;
    color?: 'blue' | 'green' | 'purple' | 'indigo';
    disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({
    checked,
    onChange,
    color = 'blue',
    disabled = false
}) => {
    const bgColors = {
        blue: checked ? 'bg-blue-600' : 'bg-gray-700',
        green: checked ? 'bg-green-600' : 'bg-gray-700',
        purple: checked ? 'bg-purple-600' : 'bg-gray-700',
        indigo: checked ? 'bg-indigo-600' : 'bg-gray-700',
    };

    return (
        <button
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-${color}-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${bgColors[color]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <span
                className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm`}
            />
        </button>
    );
};
