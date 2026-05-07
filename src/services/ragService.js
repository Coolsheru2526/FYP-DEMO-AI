import { pipeline, env } from "@xenova/transformers";

// Disable local models loading from the filesystem for web environments
env.allowLocalModels = false;

export class RAGService {
  constructor() {
    this.extractor = null;
    this.knowledgeBase = [];
    this.isLoaded = false;
  }

  async init(onProgress) {
    if (this.isLoaded) return;
    console.log("[RAGService] Initializing RAG pipeline...");
    
    // Load local knowledge base (the JSON file built by data_prep.py)
    try {
      console.log("[RAGService] Fetching /knowledge_base.json...");
      const response = await fetch("/knowledge_base.json");
      if (response.ok) {
        this.knowledgeBase = await response.json();
        console.log(`[RAGService] Knowledge base loaded successfully. (${this.knowledgeBase.length} entries)`);
      } else {
        console.warn("knowledge_base.json not found, RAG will be limited.");
      }
    } catch (e) {
      console.warn("Failed to load knowledge base", e);
    }

    console.log("[RAGService] Loading Xenova/all-MiniLM-L6-v2 extractor...");
    // Load MiniLM model via Transformers.js
    this.extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      {
        progress_callback: (progress) => {
          if (onProgress && progress.status === 'downloading') {
            onProgress(`Loading DB Embeddings: ${Math.round((progress.loaded / progress.total) * 100) || 0}%`);
          }
        }
      }
    );
    this.isLoaded = true;
    console.log("[RAGService] Extractor model loaded successfully.");
  }

  // Cosine similarity between two arrays
  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async search(query, k = 3) {
    console.log(`[RAGService] Starting search. Original query length: ${query.length}`);
    if (!this.isLoaded) await this.init();
    
    let allDocs = [];
    
    // Properly use RAG by limiting the query length to prevent model/API crashes.
    // The transcript might be very long. We extract a search-friendly snippet.
    const safeQuery = query.length > 400 ? query.substring(0, 400) : query;
    if (query.length > 400) console.log(`[RAGService] Query truncated to 400 characters.`);

    // 1. Try Gale (Local)
    console.log("[RAGService] Searching Local Gale knowledge base...");
    if (this.knowledgeBase.length > 0) {
      try {
        // Embed the query, enforcing truncation to prevent max token limit errors
        const output = await this.extractor(safeQuery, { pooling: "mean", normalize: true });
        const queryEmbedding = Array.from(output.data);

        // Compute similarities
        const results = this.knowledgeBase.map((doc) => ({
          ...doc,
          score: this.cosineSimilarity(queryEmbedding, doc.embedding)
        }));

        // Sort by descending score and take top k
        results.sort((a, b) => b.score - a.score);
        const topLocal = results.slice(0, k).map(d => ({
          content: d.content || d.page_content || JSON.stringify(d),
          source: "Gale Encyclopedia of Medicine"
        }));
        console.log(`[RAGService] Gale retrieval successful: found ${topLocal.length} docs.`);
        allDocs.push(...topLocal);
      } catch (e) {
        console.error("Local Gale retrieval failed:", e);
      }
    } else {
      console.log("[RAGService] Skipping Gale (knowledge base is empty).");
    }

    // 2. Try Web (Tavily)
    console.log("[RAGService] Searching Tavily Web API...");
    try {
      const tavilyKey = import.meta.env.VITE_TAVILY_API_KEY || "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";
      if (tavilyKey && tavilyKey.startsWith("tvly")) {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: safeQuery, // Truncated to avoid 400 Bad Request
            max_results: 2,   // Matched to notebook medical_app.py
            include_domains: ["mayoclinic.org", "nih.gov"] // Matched to notebook medical_app.py
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.results) {
            console.log(`[RAGService] Tavily retrieval successful: found ${data.results.length} docs.`);
            const webDocs = data.results.map(res => ({
              content: res.content,
              source: res.url
            }));
            allDocs.push(...webDocs);
          }
        } else {
          console.error("Tavily API error:", await response.text());
        }
      }
    } catch (e) {
      console.error("Tavily search exception:", e);
    }

    if (allDocs.length === 0) {
      console.log("[RAGService] No documents found from any source.");
      allDocs = [{ content: "No specific medical context found. Use general knowledge.", source: "none" }];
    } else {
      console.log(`[RAGService] Total documents retrieved: ${allDocs.length}`);
    }

    return allDocs;
  }
}
