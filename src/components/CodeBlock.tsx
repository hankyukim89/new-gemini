import React, { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ className, children, ...props }) => {
    const [copied, setCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(codeString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [codeString]);

    return (
        <div className="not-prose my-3">
            <div className="code-block-header">
                <span>{language || 'code'}</span>
                <button onClick={handleCopy}>
                    {copied ? (
                        <><Check className="w-3 h-3" /> Copied!</>
                    ) : (
                        <><Copy className="w-3 h-3" /> Copy code</>
                    )}
                </button>
            </div>
            <pre className="!mt-0 !rounded-t-none">
                <code className={className} {...props}>
                    {children}
                </code>
            </pre>
        </div>
    );
};
