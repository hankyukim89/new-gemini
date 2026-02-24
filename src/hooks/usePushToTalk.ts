import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { stopSpeech } from '../services/geminiService';

export interface UsePushToTalkReturn {
    isPTTActive: boolean;
    activeMode: 'standard' | 'redo' | 'translate' | null;
}

export const usePushToTalk = (
    onPTTStart: (mode: 'standard' | 'redo' | 'translate') => void,
    onPTTEnd: () => void,
    isListening: boolean
): UsePushToTalkReturn => {
    const {
        usePushToTalk,
        pushToTalkKey,
        pushToTalkRedoKey,
        pushToTalkTranslateKey,
        enableTranslation
    } = useSettingsStore();

    const isPTTKeyDown = useRef(false);
    const isPTTRedoKeyDown = useRef(false);
    const isPTTTranslateKeyDown = useRef(false);
    const activeModeRef = useRef<'standard' | 'redo' | 'translate' | null>(null);

    useEffect(() => {
        if (!usePushToTalk) return;

        const playTock = () => {
            try {
                const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
                if (!AudioContextClass) return;
                const context = new AudioContextClass();
                const oscillator = context.createOscillator();
                const gain = context.createGain();

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(150, context.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(40, context.currentTime + 0.1);

                gain.gain.setValueAtTime(0.1, context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);

                oscillator.connect(gain);
                gain.connect(context.destination);

                oscillator.start();
                oscillator.stop(context.currentTime + 0.1);

                oscillator.onended = () => {
                    try {
                        oscillator.disconnect();
                        gain.disconnect();
                        if (context.state !== 'closed') {
                            context.close().catch(() => { });
                        }
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                };
            } catch (e) {
                // Silently fail if audio context is blocked
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;

            const isRedoKey = e.code === (pushToTalkRedoKey || 'KeyR');
            const isSendKey = e.code === (pushToTalkKey || 'Space');
            const isTranslateKey = e.code === (pushToTalkTranslateKey || 'KeyT');

            if ((isSendKey || isRedoKey || isTranslateKey) &&
                !isPTTKeyDown.current && !isPTTRedoKeyDown.current && !isPTTTranslateKeyDown.current) {

                stopSpeech(); // Stop TTS immediately
                playTock();   // Sound feedback

                // Prevent scrolling if Space is used, unless typing
                if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
                    if (isSendKey || isTranslateKey) e.preventDefault();
                }

                let mode: 'standard' | 'redo' | 'translate';

                if (isRedoKey) {
                    isPTTRedoKeyDown.current = true;
                    mode = 'redo';
                } else if (isTranslateKey) {
                    if (!enableTranslation) return; // Ignore if disabled
                    isPTTTranslateKeyDown.current = true;
                    mode = 'translate';
                } else {
                    isPTTKeyDown.current = true;
                    mode = 'standard';
                }

                activeModeRef.current = mode;
                onPTTStart(mode);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const isRedoKey = e.code === (pushToTalkRedoKey || 'KeyR');
            const isSendKey = e.code === (pushToTalkKey || 'Space');
            const isTranslateKey = e.code === (pushToTalkTranslateKey || 'KeyT');

            if (isSendKey && isPTTKeyDown.current) {
                isPTTKeyDown.current = false;
                activeModeRef.current = null;
                onPTTEnd();
            }
            if (isRedoKey && isPTTRedoKeyDown.current) {
                isPTTRedoKeyDown.current = false;
                activeModeRef.current = null;
                onPTTEnd();
            }
            if (isTranslateKey && isPTTTranslateKeyDown.current) {
                isPTTTranslateKeyDown.current = false;
                activeModeRef.current = null;
                onPTTEnd();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [usePushToTalk, pushToTalkKey, pushToTalkRedoKey, pushToTalkTranslateKey, enableTranslation, onPTTStart, onPTTEnd]);

    return {
        isPTTActive: isPTTKeyDown.current || isPTTRedoKeyDown.current || isPTTTranslateKeyDown.current,
        activeMode: activeModeRef.current
    };
};
