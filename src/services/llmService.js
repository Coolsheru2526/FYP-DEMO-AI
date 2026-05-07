import { MLCEngine, CreateMLCEngine } from "@mlc-ai/web-llm";

export class LLMService {
  constructor() {
    this.engine = null;
    this.isLoaded = false;
  }

  async loadModel(onProgress) {
    if (this.isLoaded) return;
    console.log("[LLMService] Loading local LLM Engine...");
    
    // We use an ultra-compact quantized model for mobile compatibility.
    // Llama-3.2-1B-Instruct is ~800MB and prevents Out-Of-Memory crashes.
    const selectedModel = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    console.log(`[LLMService] Selected model: ${selectedModel}`);

    this.engine = await CreateMLCEngine(
      selectedModel,
      {
        initProgressCallback: (progress) => {
          if (onProgress) {
            onProgress(progress.text);
          }
        }
      }
    );
    this.isLoaded = true;
    console.log("[LLMService] LLM Engine loaded successfully.");
  }

  async generateReport(transcript, contextDocs, onUpdate) {
    console.log("[LLMService] Generating report based on transcript and context...");
    if (!this.isLoaded) throw new Error("Model not loaded");

    const contextText = contextDocs.map((d, i) => `--- Document ${i + 1} (Source: ${d.source || 'Unknown'}) ---\n${d.content}`).join("\n\n");
    
    const messages = [
      {
        role: "system",
        content: `You are a medical AI. Use the Context and Transcript to generate a report.
- If the transcript is in Hindi/Marathi, rely on the Translated Transcript for analysis.

Output strictly in this format:
Clinical Summary: [summary of patient condition]
Possible Diagnoses: [List all possible differential diagnoses with a probability percentage. IMPORTANT: The probabilities of all listed diagnoses must sum exactly to 100%. Do NOT assign 100% to multiple diagnoses.]
Medication Suggestions: [list recommended meds]
Follow-up Questions: [list questions to ask]`
      },
      {
        role: "user",
        content: `Context:\n${contextText}\n\nTranscript (Corrected & Translated):\n${transcript}\n\nGenerate Medical Report.`
      }
    ];

    console.log("[LLMService] Starting completion stream...");
    const chunks = await this.engine.chat.completions.create({
      messages,
      temperature: 0.3,
      stream: true,
    });

    let fullOutput = "";
    for await (const chunk of chunks) {
      fullOutput += chunk.choices[0]?.delta?.content || "";
      if (onUpdate) onUpdate(fullOutput);
    }
    
    return fullOutput;
  }
}
