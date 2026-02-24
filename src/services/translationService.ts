import { translateText as translateTextAPI } from '../services/geminiService';

export async function translateText(
    text: string,
    targetLanguage: string,
    apiKey: string
): Promise<string | null> {
    try {
        return await translateTextAPI(text, targetLanguage, apiKey);
    } catch (error) {
        console.error('Translation error:', error);
        return null;
    }
}
