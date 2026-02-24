import { checkGrammar as checkGrammarAPI } from '../services/geminiService';

export async function checkGrammar(
    text: string,
    apiKey: string,
    context?: { role: string; content: string }[]
): Promise<string | null> {
    try {
        return await checkGrammarAPI(text, apiKey, context);
    } catch (error) {
        console.error('Grammar check error:', error);
        return null;
    }
}
