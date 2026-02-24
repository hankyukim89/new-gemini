import { useState, useRef, useCallback } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { localWhisperService } from '../services/localWhisperService';

// Speech Recognition Types
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: (event: any) => void;
    onend: () => void;
    onerror: (event: any) => void;
}

declare global {
    interface Window {
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}

export interface UseSpeechRecognitionReturn {
    isListening: boolean;
    isTranscribing: boolean;
    transcript: string;
    startListening: (initialText?: string) => Promise<void>;
    stopListening: () => void;
    setTranscript: (text: string) => void;
}

export const useSpeechRecognition = (
    onTranscriptComplete?: (transcript: string) => void
): UseSpeechRecognitionReturn => {
    const [isListening, setIsListening] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcript, setTranscript] = useState('');

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const initialTextRef = useRef('');
    const latestTranscriptRef = useRef('');

    const startListening = useCallback(async (initialText: string = '') => {
        const { useOfflineSTT, sourceLanguage } = useSettingsStore.getState();
        initialTextRef.current = initialText;

        if (useOfflineSTT) {
            // Offline Whisper Mode
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                    setIsTranscribing(true);

                    try {
                        const text = await localWhisperService.transcribe(audioBlob);
                        if (text) {
                            const newText = text.trim();
                            const combinedText = initialTextRef.current + (initialTextRef.current ? ' ' : '') + newText;
                            setTranscript(combinedText);
                            latestTranscriptRef.current = combinedText;
                            onTranscriptComplete?.(combinedText);
                        }
                    } catch (error) {
                        console.error('Whisper Transcription Error:', error);
                    } finally {
                        setIsTranscribing(false);
                        stream.getTracks().forEach(track => track.stop());
                    }
                };

                mediaRecorder.start();
                setIsListening(true);
            } catch (err: any) {
                console.error('Microphone Access Error:', err);
                setIsTranscribing(false);
                alert(`Microphone Access Error: ${err.message}`);
            }
        } else {
            // Browser Speech Recognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert("Speech recognition not supported in this browser. Try enabling 'Offline Speech-to-Text' in Settings.");
                return;
            }

            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = sourceLanguage || 'en-US';

            recognition.onresult = (event: any) => {
                const currentResult = event.results[event.results.length - 1];
                const transcriptText = currentResult[0].transcript;
                const fullText = initialTextRef.current + (initialTextRef.current ? ' ' : '') + transcriptText;
                latestTranscriptRef.current = fullText;
                setTranscript(fullText);
            };

            recognition.onerror = (event: any) => {
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    console.error('Speech Recognition Error:', event.error);
                }
                setIsListening(false);
                setIsTranscribing(false);
            };

            recognition.onend = () => {
                setIsListening(false);
                setIsTranscribing(false);
                const finalTranscript = latestTranscriptRef.current;
                if (finalTranscript.trim()) {
                    onTranscriptComplete?.(finalTranscript);
                }
            };

            recognitionRef.current = recognition;
            recognition.start();
            setIsListening(true);
        }
    }, [onTranscriptComplete]);

    const stopListening = useCallback(() => {
        const { useOfflineSTT } = useSettingsStore.getState();

        setIsTranscribing(true);

        if (useOfflineSTT) {
            mediaRecorderRef.current?.stop();
        } else {
            recognitionRef.current?.stop();
        }

        setIsListening(false);
    }, []);

    return {
        isListening,
        isTranscribing,
        transcript,
        startListening,
        stopListening,
        setTranscript
    };
};
