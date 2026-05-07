import React, { useState, useEffect, useRef } from 'react';
import { LLMService } from './services/llmService';
import { RAGService } from './services/ragService';
// import { WhisperService } from './services/whisperService';
import { Loader2, Send, Stethoscope, FileText, Database, ShieldAlert } from 'lucide-react';

export default function App() {
  const [llmService] = useState(new LLMService());
  const [ragService] = useState(new RAGService());
  // const [whisperService] = useState(new WhisperService());
  
  const [status, setStatus] = useState("Initializing models...");
  const [isReady, setIsReady] = useState(false);
  // const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [report, setReport] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // const mediaRecorder = useRef(null);
  // const audioChunks = useRef([]);

  useEffect(() => {
    const initModels = async () => {
      try {
        console.log("[App] Starting models initialization...");
        await ragService.init((msg) => setStatus(msg));
        // await whisperService.init((msg) => setStatus(msg));
        await llmService.loadModel((msg) => setStatus(msg));
        
        console.log("[App] All models initialized successfully.");
        setStatus("All systems ready.");
        setIsReady(true);
      } catch (err) {
        setStatus(`Error initializing: ${err.message}`);
      }
    };
    initModels();
  }, [llmService, ragService]);

  /*
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        console.log(`[App] Recording stopped. Collected ${audioChunks.current.length} audio chunks.`);
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        await handleAudio(audioBlob);
      };

      mediaRecorder.current.start();
      console.log("[App] Recording started...");
      setIsRecording(true);
      setStatus("Recording...");
    } catch (err) {
      alert("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleAudio = async (blob) => {
    setIsProcessing(true);
    setStatus("Transcribing audio locally...");
    try {
      const text = await whisperService.transcribe(blob);
      setTranscript(text);
      await processText(text);
    } catch (err) {
      setStatus(`Transcription failed: ${err.message}`);
      setIsProcessing(false);
    }
  };
  */

  const processText = async (text) => {
    if (!text.trim()) return;
    console.log(`[App] Processing text input (Length: ${text.length})...`);
    setIsProcessing(true);
    setStatus("Searching local knowledge base...");
    setReport("");

    try {
      // Retrieve Context
      console.log("[App] Calling RAGService for context retrieval...");
      const contextDocs = await ragService.search(text, 3);
      console.log(`[App] RAG retrieval finished. Retrieved ${contextDocs.length} documents.`);
      
      setStatus("Generating medical report...");
      
      // Generate Report
      console.log("[App] Calling LLMService to generate report...");
      await llmService.generateReport(text, contextDocs, (partialReport) => {
        setReport(partialReport);
      });
      
      console.log("[App] Report generation completed.");
      setStatus("Report complete.");
    } catch (err) {
      setStatus(`Processing failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (transcript) processText(transcript);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-emerald-500/10 rounded-xl">
              <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">MedAI Offline</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium">
            <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
              {isReady ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-amber-500"></span>
              )}
            </span>
            <span className={isReady ? "text-emerald-400" : "text-amber-400"}>
              {isReady ? 'Active' : 'Loading...'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 flex flex-col gap-6 sm:gap-8">
        
        {/* Status Bar */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-sm flex-wrap gap-2">
          <div className="flex items-center gap-2 sm:gap-3 text-slate-400 text-xs sm:text-sm truncate">
            {isProcessing || !isReady ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Database className="w-4 h-4 shrink-0" />}
            <span className="truncate">{status}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/50 rounded-full text-[10px] sm:text-xs text-slate-500 border border-slate-700 shrink-0">
            <ShieldAlert className="w-3 h-3" />
            100% Offline
          </div>
        </div>

        {/* Input Section */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <label className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider pl-1">Consultation Notes</label>
          <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row items-end gap-3 bg-slate-900/60 p-2 sm:p-2.5 rounded-3xl border border-slate-800 focus-within:border-emerald-500/50 transition-colors shadow-lg">
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Type consultation notes here..."
              className="w-full bg-transparent resize-none outline-none px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-slate-200 placeholder-slate-600 min-h-[80px] sm:min-h-[56px] max-h-[200px]"
              disabled={!isReady || isProcessing}
            />
            
            <div className="flex items-center justify-end w-full sm:w-auto pb-1 pr-1">
              <button
                type="submit"
                disabled={!isReady || isProcessing || !transcript.trim()}
                className="w-full sm:w-auto p-3 sm:p-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl sm:rounded-[1.25rem] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20"
              >
                <span className="sm:hidden mr-2">Process Notes</span>
                <Send className="w-5 h-5 sm:ml-0.5" />
              </button>
            </div>
          </form>
        </div>

        {/* Output Section */}
        <div className="flex flex-col gap-3 sm:gap-4 flex-1 pb-8">
          <label className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider pl-1 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Medical Report
          </label>
          <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-3xl p-5 sm:p-6 min-h-[300px] shadow-inner relative overflow-hidden">
            {/* Decorative background blur */}
            <div className="absolute top-[-100px] right-[-100px] w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] bg-emerald-500/10 rounded-full blur-[60px] sm:blur-[80px] pointer-events-none"></div>
            <div className="absolute bottom-[-100px] left-[-100px] w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] bg-blue-500/10 rounded-full blur-[60px] sm:blur-[80px] pointer-events-none"></div>
            
            <div className="relative z-10 whitespace-pre-wrap leading-relaxed text-sm sm:text-base text-slate-300">
              {report || (
                <span className="text-slate-600 italic flex items-center justify-center h-full text-center">
                  No report generated yet. Type a consultation above.
                </span>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
