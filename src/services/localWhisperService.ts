import { pipeline, env } from '@xenova/transformers';

// Skip local model checks since we are in a browser environment
env.allowLocalModels = false;
env.useBrowserCache = true;

class LocalWhisperService {
    static instance: LocalWhisperService | null = null;
    transcriber: any = null;
    isLoading = false;

    static getInstance() {
        if (!LocalWhisperService.instance) {
            LocalWhisperService.instance = new LocalWhisperService();
        }
        return LocalWhisperService.instance;
    }

    async loadModel(progressCallback?: (data: any) => void) {
        if (this.transcriber) return;
        if (this.isLoading) return; // simple lock

        this.isLoading = true;
        try {
            console.log("Loading Whisper model...");
            this.transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
                progress_callback: progressCallback
            });
            console.log("Whisper model loaded.");
        } catch (error) {
            console.error("Failed to load Whisper model:", error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    async transcribe(audioBlob: Blob): Promise<string> {
        if (!this.transcriber) {
            await this.loadModel();
        }

        // Convert Blob to AudioBuffer/Float32Array for transformers.js
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        let audioData = audioBuffer.getChannelData(0); // get the first channel

        const result = await this.transcriber(audioData, {
            language: 'english',
            task: 'transcribe'
        });

        // structure is { text: "..." } or array depending on version
        return result.text || "";
    }
}

export const localWhisperService = LocalWhisperService.getInstance();
