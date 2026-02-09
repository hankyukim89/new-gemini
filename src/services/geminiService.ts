import { GoogleGenerativeAI } from "@google/generative-ai";
import { useUsageStore } from "../store/useUsageStore";

// --- STRICT Model List ---
export const PLAYGROUND_MODELS = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-exp-1206', name: 'Gemini Experimental 1206' },
    { id: 'nano-banana-pro-preview', name: 'Nano Banana Pro' },
];

export const MODEL_LIMITS: Record<string, number> = {
    'gemini-2.0-flash': 1048576,
    'gemini-2.5-pro': 2097152,
    'gemini-exp-1206': 1048576,
    'nano-banana-pro-preview': 32768,
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
    messages: { role: string; content: string }[],
    apiKey: string,
    modelName: string,
    config: { temperature: number; topK: number; topP: number; maxOutputTokens: number }
): Promise<ServiceResponse> => {

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        const historyForChat = messages.slice(0, -1).map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
        }));

        const chat = model.startChat({
            history: historyForChat,
            generationConfig: {
                maxOutputTokens: config.maxOutputTokens,
                temperature: config.temperature,
                topP: config.topP,
                topK: config.topK,
            }
        });

        const lastMessage = messages[messages.length - 1].content;
        const result = await chat.sendMessage(lastMessage);
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
    messages: { role: string; content: string }[],
    apiKey: string,
    modelName: string,
    config: { temperature: number; topK: number; topP: number; maxOutputTokens: number }
) {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        const historyForChat = messages.slice(0, -1).map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
        }));

        const chat = model.startChat({
            history: historyForChat,
            generationConfig: {
                maxOutputTokens: config.maxOutputTokens,
                temperature: config.temperature,
                topP: config.topP,
                topK: config.topK,
            }
        });

        const lastMessage = messages[messages.length - 1].content;
        const result = await chat.sendMessageStream(lastMessage);

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
export const synthesizeSpeech = async (text: string, voiceURI: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!window.speechSynthesis) {
            reject(new Error("Browser does not support TTS"));
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);

        // Find the voice by URI or Name
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.voiceURI === voiceURI || v.name === voiceURI);

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = (e) => reject(e);

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
