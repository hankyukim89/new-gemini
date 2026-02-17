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

        // Check if error is due to safety filtering
        const errorMsg = error.message || error.toString();
        if (errorMsg.includes('SAFETY') ||
            errorMsg.includes('blocked') ||
            errorMsg.includes('HARM_CATEGORY') ||
            errorMsg.includes('BLOCK_REASON')) {
            throw new Error('⚠️ Content blocked by Google\'s safety filters. Try rephrasing your message or adjusting safety settings (note: Google enforces server-side filtering that cannot be fully disabled).');
        }

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

        // Check if error is due to safety filtering
        const errorMsg = error.message || error.toString();
        if (errorMsg.includes('SAFETY') ||
            errorMsg.includes('blocked') ||
            errorMsg.includes('HARM_CATEGORY') ||
            errorMsg.includes('BLOCK_REASON')) {
            throw new Error('⚠️ Content blocked by Google\'s safety filters. Try rephrasing your message or adjusting safety settings (note: Google enforces server-side filtering that cannot be fully disabled).');
        }

        throw new Error(error.message || "Unknown Stream Error");
    }
};

// --- Browser Native TTS (Free, No API Required) ---

export const synthesizeSpeech = async (text: string, voiceURI: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!window.speechSynthesis) {
            console.error("Browser does not support TTS");
            resolve();
            return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Find the selected voice by URI or name
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.voiceURI === voiceURI || v.name === voiceURI);

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else if (voices.length > 0) {
            // Fallback: pick a good English voice
            const fallback = voices.find(v => v.lang === 'en-US') || voices[0];
            utterance.voice = fallback;
        }

        utterance.onend = () => resolve();
        utterance.onerror = (e) => {
            console.error("Browser TTS Error:", e);
            resolve(); // Don't crash, just silently fail
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


export const checkGrammar = async (
    text: string,
    apiKey: string,
    context: { role: string; content: string }[] = []
): Promise<string | null> => {
    if (!text || text.trim().length < 2) return null;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Use a fast, lightweight model for background checks
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

        // Build context string from last 5 messages to save tokens but provide context
        const contextStr = context.slice(-5).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');

        const prompt = `
        You are a helpful grammar assistant.
        Check the following text for grammar, spelling, and word choice errors, taking into account the conversation context.
        
        Context (Previous Conversation):
        ${contextStr}

        Target Text to Check: "${text}"
        
        Rules:
        1. If the text is natural and grammatically correct given the context, return ONLY the string: NO_ERRORS
        2. If there are mistakes, provide specific HTML output:
           - <b>Corrected:</b> [The corrected sentence]
           - <br>
           - <i>[Optional 1-sentence explanation if needed]</i>
        
        Do not use markdown blocks. Do not use <ul> or <li> unless absolutely necessary.
        Keep it simple and direct.
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        let correction = response.text().trim();

        // Clean up markdown block if present
        correction = correction.replace(/^```html/, '').replace(/```$/, '').trim();

        if (correction.includes('NO_ERRORS')) {
            return null;
        }

        return correction;
    } catch (error) {
        console.error("Grammar Check Error:", error);
        return null;
    }
};

export const translateText = async (
    text: string,
    targetLanguage: string,
    apiKey: string
): Promise<string | null> => {
    if (!text || !targetLanguage) return null;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Upgraded to standard Flash for better quality
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `
        You are a professional translator.
        Translate the following text into ${targetLanguage}.
        
        Guidelines:
        - Detect the source language automatically.
        - Produce a natural, idiomatic translation that conveys the original meaning and tone.
        - Do NOT explain the translation.
        - Return ONLY the translated text.

        Text to Translate:
        "${text}"
        `;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error: any) {
        console.error("Translation Error:", error);
        return null; // Return null on error
    }
};

export const defineWord = async (
    word: string,
    context: string,
    targetLanguage: string,
    apiKey: string
): Promise<string | null> => {
    if (!word || !targetLanguage) return null;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

        const prompt = `
        You are a dictionary assistant.
        Provide a concise definition and translation for the word "${word}" in ${targetLanguage}.
        
        Context sentence: "${context}"

        Format:
        <b>[Word]</b> ([Translation])
        <br>
        <i>[Definition in ${targetLanguage}]</i>
        
        Keep it very brief (max 2 sentences). Return HTML. No markdown blocks.
        `;

        const result = await model.generateContent(prompt);
        let definition = result.response.text().trim();
        definition = definition.replace(/^```html/, '').replace(/```$/, '').trim();
        return definition;
    } catch (error: any) {
        console.error("Definition Error:", error);
        return null;
    }
};
