import { pipeline, env } from "@xenova/transformers";

env.allowLocalModels = false;

export class WhisperService {
  constructor() {
    this.transcriber = null;
    this.isLoaded = false;
  }

  async init(onProgress) {
    if (this.isLoaded) return;
    console.log("[WhisperService] Initializing Whisper model 'Xenova/whisper-tiny' (Multilingual)...");

    this.transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny",
      {
        progress_callback: (progress) => {
          if (onProgress && progress.status === 'downloading') {
            onProgress(`Loading Speech AI: ${Math.round((progress.loaded / progress.total) * 100) || 0}%`);
          }
        }
      }
    );
    this.isLoaded = true;
    console.log("[WhisperService] Model loaded successfully.");
  }

  async transcribe(audioBlob) {
    console.log(`[WhisperService] Starting transcription for audio blob (Size: ${audioBlob.size} bytes)...`);
    if (!this.isLoaded) await this.init();
    
    // Convert blob to Float32Array containing audio samples at 16kHz
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const offlineContext = new OfflineAudioContext(1, audioBuffer.length, 16000);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    const renderedBuffer = await offlineContext.startRendering();
    const audioData = renderedBuffer.getChannelData(0);

    console.log(`[WhisperService] Audio processed to Float32Array (Length: ${audioData.length}). Running inference...`);

    // Using 'translate' task so it automatically detects Hindi/Marathi and outputs English text
    const result = await this.transcriber(audioData, {
      task: "translate",
      temperature: 0.0,
      prompt: "Medical consultation. Doctor and patient conversation. Symptoms, diagnosis, treatment, fever, medicine."
    });
    
    console.log("[WhisperService] Transcription/Translation completed.");
    return result.text;
  }
}
