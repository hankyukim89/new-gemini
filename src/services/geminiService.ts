import { GoogleGenerativeAI } from "@google/generative-ai";
import { useUsageStore } from "../store/useUsageStore";
import type { Attachment } from "../store/useChatStore";

// --- STRICT Model List ---
export const PLAYGROUND_MODELS = [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite' },
];

export const MODEL_LIMITS: Record<string, number> = {
    'gemini-3-pro-preview': 1048576,
    'gemini-3-flash-preview': 1048576,
    'gemini-2.5-pro': 1048576,
    'gemini-2.5-flash': 1048576,
    'gemini-2.5-flash-lite': 1048576,
    'gemini-2.0-flash': 1048576,
    'gemini-2.0-flash-lite': 1048576,
};

export interface ServiceResponse {
    text: string;
    usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
    };
}

export const sendMessageToGemini = async (
    messages: { role: string; content: string; attachments?: Attachment[] }[],
    apiKey: string,
    modelName: string,
    config: { temperature: number; topK: number; topP: number; maxOutputTokens: number; safetySettings?: { category: string; threshold: string }[] }
): Promise<ServiceResponse> => {

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: modelName,
            safetySettings: config.safetySettings as any
        });

        const historyForChat = messages.slice(0, -1).map(m => {
            const parts: any[] = [{ text: m.content }];
            if (m.attachments) {
                m.attachments.forEach(att => {
                    parts.push({
                        inlineData: {
                            mimeType: att.mimeType,
                            data: att.data.split(',')[1] || att.data // Ensure we send only base64
                        }
                    });
                });
            }
            return {
                role: m.role,
                parts: parts
            };
        });

        const chat = model.startChat({
            history: historyForChat,
            generationConfig: {
                maxOutputTokens: config.maxOutputTokens,
                temperature: config.temperature,
                topP: config.topP,
                topK: config.topK,
            }
        });

        const lastMsg = messages[messages.length - 1];
        const lastParts: any[] = [{ text: lastMsg.content }];
        if (lastMsg.attachments) {
            lastMsg.attachments.forEach(att => {
                lastParts.push({
                    inlineData: {
                        mimeType: att.mimeType,
                        data: att.data.split(',')[1] || att.data
                    }
                });
            });
        }

        const result = await chat.sendMessage(lastParts);
        const response = result.response;
        const text = response.text();
        const usageMetadata = response.usageMetadata;

        if (usageMetadata) {
            useUsageStore.getState().addUsage({
                model: modelName,
                inputTokens: usageMetadata.promptTokenCount,
                outputTokens: usageMetadata.candidatesTokenCount,
            });
        }

        return { text, usageMetadata };

    } catch (error: any) {
        console.warn("API Call Failed:", error);
        throw new Error(error.message || "Unknown API Error");
    }
};

export const sendMessageStream = async function* (
    messages: { role: string; content: string; attachments?: Attachment[] }[],
    apiKey: string,
    modelName: string,
    config: { temperature: number; topK: number; topP: number; maxOutputTokens: number; safetySettings?: { category: string; threshold: string }[] }
) {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: modelName,
            safetySettings: config.safetySettings as any
        });

        const historyForChat = messages.slice(0, -1).map(m => {
            const parts: any[] = [{ text: m.content }];
            if (m.attachments) {
                m.attachments.forEach(att => {
                    parts.push({
                        inlineData: {
                            mimeType: att.mimeType,
                            data: att.data.split(',')[1] || att.data
                        }
                    });
                });
            }
            return {
                role: m.role,
                parts: parts
            };
        });

        const chat = model.startChat({
            history: historyForChat,
            generationConfig: {
                maxOutputTokens: config.maxOutputTokens,
                temperature: config.temperature,
                topP: config.topP,
                topK: config.topK,
            }
        });

        const lastMsg = messages[messages.length - 1];
        const lastParts: any[] = [{ text: lastMsg.content }];
        if (lastMsg.attachments) {
            lastMsg.attachments.forEach(att => {
                lastParts.push({
                    inlineData: {
                        mimeType: att.mimeType,
                        data: att.data.split(',')[1] || att.data
                    }
                });
            });
        }

        const result = await chat.sendMessageStream(lastParts);

        let aggregatedText = '';

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            aggregatedText += chunkText;
            yield chunkText;
        }

        // Track usage if available in the final response (stream sometimes has it at the end)
        const finalResponse = await result.response;
        const usageMetadata = finalResponse.usageMetadata;

        if (usageMetadata) {
            useUsageStore.getState().addUsage({
                model: modelName,
                inputTokens: usageMetadata.promptTokenCount,
                outputTokens: usageMetadata.candidatesTokenCount,
            });
        }

    } catch (error: any) {
        console.warn("Stream API Call Failed:", error);
        throw new Error(error.message || "Unknown Stream Error");
    }
};

// --- Google Cloud TTS API ---
// --- Browser Native TTS ---
import { useSettingsStore } from "../store/useSettingsStore";

// ... existing imports ...

// ... (keep Model constants) ...

// ... (keep sendMessageToGemini) ...

// ... (keep sendMessageStream) ...

// --- Google Cloud TTS API & Browser Native TTS ---
export const synthesizeSpeech = async (text: string, voiceURI: string): Promise<void> => {
    // 1. Check if it's a Google Cloud Voice (Standard/Premium)
    // Cloud voices in our list look like: "en-US-Journey-D", "en-GB-Neural2-A", etc.
    const isCloudVoice = voiceURI.includes('Journey') || voiceURI.includes('Neural2') || voiceURI.includes('Standard') || voiceURI.includes('Wavenet');

    if (isCloudVoice) {
        const apiKey = useSettingsStore.getState().apiKey;
        if (!apiKey) {
            throw new Error("API Key required for Cloud TTS");
        }

        try {
            const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: { text },
                    voice: { languageCode: voiceURI.split('-').slice(0, 2).join('-'), name: voiceURI },
                    audioConfig: { audioEncoding: 'MP3' },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "TTS API Request failed");
            }

            const data = await response.json();
            const audioContent = data.audioContent;

            if (!audioContent) {
                throw new Error("No audio content received");
            }

            // Play the audio
            const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
            await new Promise<void>((resolve, reject) => {
                audio.onended = () => resolve();
                audio.onerror = (e) => reject(e);
                audio.play().catch(reject);
            });
            return;

        } catch (error) {
            console.warn("Cloud TTS failed, falling back to browser:", error);
            // Fallback: Proceed to Browser Native TTS below
            // We just don't return here, letting code execution continue to step 2.
        }
    }

    // 2. Browser Native TTS (Fallback or Explicit Selection)
    return new Promise((resolve, reject) => {
        if (!window.speechSynthesis) {
            console.error("Browser does not support TTS");
            // If we are here after a Cloud error, we should probably just resolve to avoid crashing app flow
            resolve();
            return;
        }

        // If we are falling back from Cloud, 'voiceURI' (e.g. 'en-US-Journey-D') won't match any browser voice.
        // This means 'selectedVoice' will be undefined, and utterance will use the system default.
        // This is exactly what we want for a fallback.

        const utterance = new SpeechSynthesisUtterance(text);

        // Find the voice by URI or Name
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.voiceURI === voiceURI || v.name === voiceURI);

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        // If falling back, maybe speed it up slightly or ensure it's English if possible?
        // simple default is fine.

        utterance.onend = () => resolve();
        utterance.onerror = (e) => {
            console.error("Browser TTS Error:", e);
            reject(e);
        };

        window.speechSynthesis.speak(utterance);
    });
};

export const stopSpeech = () => {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};

export const getBrowserVoices = (): SpeechSynthesisVoice[] => {
    if (!window.speechSynthesis) return [];
    return window.speechSynthesis.getVoices();
};
