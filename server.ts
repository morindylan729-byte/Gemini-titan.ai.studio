import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize the GoogleGenAI SDK safely
let ai: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set. Please configure it in Settings > Secrets.");
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// System Instruction templates for Personas
const PERSONA_INSTRUCTIONS = {
  default: "You are a helpful, extremely precise, and direct AI assistant.",
  academic: "You are a world-class academic researcher and scholar. Maintain high rigor, list sources conceptually, use objective scholarly language, and provide comprehensive citations and logical depth.",
  "code-architect": "You are an elite principal software engineer and system architect. Write modular, robust, clean, and highly optimized code. Always explain architectural trade-offs, add TypeScript types, and avoid boilerplate or incomplete placeholders.",
  "creative-writer": "You are a prize-winning novelist and essayist. Write with vivid, descriptive language, deep stylistic texture, and a non-generic narrative flow. Avoid predictable tropes and elevate the prose standard.",
  "logical-solver": "You are a hyper-logical deductive analyst and mathematics wizard. Your style is strictly analytical, parsing information to identify edge cases, mathematical constraints, and formal logical breakdowns. Avoid fluff.",
  "network-admin": "You are an expert Enterprise Network Administrator, Cyber Security Operations Specialist, and Infrastructure Engineer. Analyze network configurations, verify subnet boundaries and CIDR ranges, parse routing tables/traceroutes, inspect packet capture summaries, identify security threats or misconfigurations, design reliable network architectures, and provide precise diagnostic CLI commands (e.g., ip, iptables, nmap, netstat, tcpdump, systemctl). Focus on security hardening, redundancy, protocol-level deep dives, and standard RFC guidelines, while explaining network performance and latency trade-offs.",
};

// POST endpoint: Supercharge a prompt
app.post("/api/supercharge", async (req, res) => {
  const { prompt, config } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "A valid prompt string is required." });
  }

  const {
    useCoT = false,
    useCritique = false,
    useSearch = false,
    persona = "default",
    temperature = 0.7,
  } = config || {};

  const stepsLogs: Array<{ name: string; status: "idle" | "running" | "completed" | "failed"; message: string; duration: number; output?: string }> = [];
  const logStepStart = (name: string, message: string) => {
    const step = { name, status: "running" as const, message, duration: 0, startTime: Date.now() };
    stepsLogs.push(step as any);
    return step;
  };
  const logStepEnd = (step: any, status: "completed" | "failed", extra = {}) => {
    const found = stepsLogs.find((s) => s.name === step.name);
    if (found) {
      found.status = status;
      found.duration = Date.now() - (step as any).startTime;
      Object.assign(found, extra);
    }
  };

  const totalStartTime = Date.now();

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const trackUsage = (res: any, fallbackPromptText: string, fallbackResponseText: string) => {
    if (res && res.usageMetadata) {
      totalInputTokens += res.usageMetadata.promptTokenCount || 0;
      totalOutputTokens += res.usageMetadata.candidatesTokenCount || 0;
    } else {
      totalInputTokens += Math.ceil((fallbackPromptText || "").length / 4);
      totalOutputTokens += Math.ceil((fallbackResponseText || "").length / 4);
    }
  };

  try {
    const client = getGeminiClient();
    const modelName = "gemini-3.5-flash"; // Excellent general-purpose model with high performance

    // --- STEP 1: Standard Baseline Generation (Simulating generic single-turn chat) ---
    const stepBaseline = logStepStart("baseline", "Generating standard baseline response...");
    let standardResponse = "";
    try {
      const baselineRes = await client.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature,
        }
      });
      standardResponse = baselineRes.text || "No response generated.";
      trackUsage(baselineRes, prompt, standardResponse);
      logStepEnd(stepBaseline, "completed", { output: standardResponse });
    } catch (e: any) {
      standardResponse = `Baseline run failed: ${e.message}`;
      logStepEnd(stepBaseline, "failed");
    }

    // --- STEP 2: Enhanced Prompt Engineering (Generates optimized instructions) ---
    const stepEnhance = logStepStart("enhance", "Optimizing prompt structure & constraints...");
    let enhancedPrompt = prompt;
    try {
      const enhanceRes = await client.models.generateContent({
        model: modelName,
        contents: `You are an expert prompt compiler. Rewrite this raw user request to be 10x more effective, incorporating explicit analytical structure, style directives, edge-case checks, and output formatting.
        
Raw user request: "${prompt}"

Provide the fully optimized compiled prompt that asks for perfect execution without raw preamble. output only the compiled prompt itself.`,
        config: { temperature: 0.5 }
      });
      enhancedPrompt = enhanceRes.text?.trim() || prompt;
      trackUsage(enhanceRes, prompt, enhancedPrompt);
      logStepEnd(stepEnhance, "completed", { output: enhancedPrompt });
    } catch (e) {
      logStepEnd(stepEnhance, "failed");
    }

    // --- STEP 3: Chain-Of-Thought (CoT) Breakdown (Pre-thinking) ---
    let cotText = "";
    if (useCoT) {
      const stepCoT = logStepStart("cot", "Decomposing problem structure step-by-step...");
      try {
        const cotRes = await client.models.generateContent({
          model: modelName,
          contents: `Perform an in-depth, step-by-step cognitive analysis of how to solve this request perfectly.
Break down logical requirements, identify subtle edge cases, make explicit unstated constraints, and lay out an execution roadmap.

User prompt to analyze:
"${enhancedPrompt}"

Output only your technical analytical steps inside <cot>...</cot> XML tags. Do not solve the prompt yet, just model the reasoning path.`,
          config: { temperature: 0.3 }
        });
        cotText = cotRes.text || "";
        trackUsage(cotRes, enhancedPrompt, cotText);
        logStepEnd(stepCoT, "completed", { output: cotText });
      } catch (e: any) {
        cotText = `CoT breakdown failed: ${e.message}`;
        logStepEnd(stepCoT, "failed");
      }
    }

    // --- STEP 4: Live Google Search Grounding for Fresh Data ---
    let searchSources: Array<{ title: string; uri: string }> = [];
    let searchContext = "";
    if (useSearch) {
      const stepSearch = logStepStart("search", "Retrieving real-time world knowledge via Google Search...");
      try {
        const searchRes = await client.models.generateContent({
          model: modelName,
          contents: `List essential, fresh, or factual search queries needed to answer the following prompt with maximum factual accuracy, or query Google directly if appropriate:
          
"${enhancedPrompt}"`,
          config: {
            tools: [{ googleSearch: {} }],
          }
        });

        searchContext = searchRes.text || "";
        const chunks = searchRes.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          searchSources = chunks
            .map((chunk: any) => ({
              title: chunk.web?.title || chunk.web?.uri || "Google Search Source",
              uri: chunk.web?.uri || "",
            }))
            .filter((source: any) => source.uri);
        }
        trackUsage(searchRes, enhancedPrompt, searchContext);
        logStepEnd(stepSearch, "completed", { output: searchContext });
      } catch (e: any) {
        searchContext = `Search grounding failed: ${e.message}`;
        logStepEnd(stepSearch, "failed");
      }
    }

    // --- STEP 5: Draft Generation ---
    const stepDraft = logStepStart("draft", "Synthesizing deep reasoning model draft...");
    let draftResponse = "";
    const systemInstruction = config?.customInstruction || PERSONA_INSTRUCTIONS[persona as keyof typeof PERSONA_INSTRUCTIONS] || PERSONA_INSTRUCTIONS.default;
    
    const draftContentParts: any[] = [];
    if (useCoT && cotText) {
      draftContentParts.push(`PRE-THINKING ANALYSIS PATH:\n${cotText}\n\n`);
    }
    if (useSearch && searchContext) {
      draftContentParts.push(`LIVE GOOGLE SEARCH GROUNDED INSIGHTS:\n${searchContext}\n\n`);
    }
    draftContentParts.push(`TASK TO SOLVE:\nBased on any pre-thinking and search context, solve this prompt perfectly:\n${enhancedPrompt}`);

    try {
      const draftRes = await client.models.generateContent({
        model: modelName,
        contents: draftContentParts.join("\n"),
        config: {
          systemInstruction,
          temperature,
        }
      });
      draftResponse = draftRes.text || "";
      trackUsage(draftRes, draftContentParts.join("\n"), draftResponse);
      logStepEnd(stepDraft, "completed", { output: draftResponse });
    } catch (e: any) {
      draftResponse = `Draft generation failed: ${e.message}`;
      logStepEnd(stepDraft, "failed");
    }

    // --- STEP 6: Adversarial Critique & Refinement Loop ---
    let finalSelection = draftResponse;
    let critiqueText = "";
    if (useCritique && draftResponse) {
      const stepCritique = logStepStart("critique", "Subjecting draft output to strict self-criticism...");
      try {
        const critiquePrompt = `Analyze the draft response below with brutal academic rigor. 
Identify logical gaps, missed formatting constraints, superficial statements, or errors. Provide a numbered list of corrections.

Prompt: "${enhancedPrompt}"
Draft to critique:
"${draftResponse}"

Provide your feedback inside <critique>...</critique> XML tags.`;

        const critiqueRes = await client.models.generateContent({
          model: modelName,
          contents: critiquePrompt,
          config: {
            temperature: 0.4,
          }
        });
        critiqueText = critiqueRes.text || "";
        trackUsage(critiqueRes, critiquePrompt, critiqueText);
        logStepEnd(stepCritique, "completed", { output: critiqueText });

        // Compile rewrite step
        const stepRefine = logStepStart("refine", "Refining output elements according to feedback loop...");
        try {
          const refinePrompt = `You are a master scientific synthesis editor. Rewrite the draft response below to completely address all identified critiques, ensuring perfection in format, logical soundness, and elegant styling. Ensure no critique items remain unaddressed.

Original raw request: "${enhancedPrompt}"
Draft Draft Response:
"${draftResponse}"
Harsh critique feedback to solve:
"${critiqueText}"

Output only the fully-polished final masterpiece.`;

          const perfectRes = await client.models.generateContent({
            model: modelName,
            contents: refinePrompt,
            config: {
              systemInstruction,
              temperature: temperature * 0.8, // Slightly tighten temperature for synthesis
            }
          });
          finalSelection = perfectRes.text || draftResponse;
          trackUsage(perfectRes, refinePrompt, finalSelection);
          logStepEnd(stepRefine, "completed", { output: finalSelection });
        } catch (err: any) {
          logStepEnd(stepsLogs.find(s => s.name === "refine") as any, "failed");
        }
        
      } catch (e: any) {
        critiqueText = `Critique loop failed: ${e.message}`;
        logStepEnd(stepCritique, "failed");
      }
    }

    const totalTime = Date.now() - totalStartTime;

    // Pricing formulas for Gemini 1.5/2.5 Flash
    // Input: $0.075 / 1M tokens ($0.000000075 / token)
    // Output: $0.30 / 1M tokens ($0.000000300 / token)
    const inputCost = totalInputTokens * 0.000000075;
    const outputCost = totalOutputTokens * 0.000000300;
    const estimatedCost = parseFloat((inputCost + outputCost).toFixed(6));

    const usage = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      estimatedCost,
    };

    res.json({
      originalPrompt: prompt,
      enhancedPrompt,
      standardResponse,
      superchargedResponse: finalSelection,
      critiqueText,
      cotText,
      searchSources,
      steps: stepsLogs.map(s => ({
        name: s.name,
        status: s.status,
        message: s.message,
        duration: s.duration,
        output: s.output
      })),
      totalTime,
      usage,
      config,
    });

  } catch (error: any) {
    console.error("Supercharge endpoint execution error:", error);
    res.status(500).json({
      error: error.message || "An error occurred during the supercharged pipeline run. Please verify your GEMINI_API_KEY.",
    });
  }
});

// POST endpoint: Manual Polish with senior editor feedback
app.post("/api/polish", async (req, res) => {
  const { draftText, critiqueText, persona = "default", temperature = 0.7, config } = req.body;

  if (!draftText || !critiqueText) {
    return res.status(400).json({ error: "Both draftText and critiqueText are required." });
  }

  try {
    const client = getGeminiClient();
    const modelName = "gemini-3.5-flash";
    const systemInstruction = config?.customInstruction || PERSONA_INSTRUCTIONS[persona as keyof typeof PERSONA_INSTRUCTIONS] || PERSONA_INSTRUCTIONS.default;

    const refinePrompt = `You are an elite, world-class synthesis editor. Your job is to rewrite the draft response below to address the user's specific polish critiques, maintaining flawless styling, perfect constraints satisfaction, and elegant formatting.

Draft response to refine:
"${draftText}"

User's specific critiquing & refinement feedback to apply:
"${critiqueText}"

Be highly creative and strictly satisfy the user's request. Output only the refined masterpiece.`;

    const perfectRes = await client.models.generateContent({
      model: modelName,
      contents: refinePrompt,
      config: {
        systemInstruction,
        temperature,
      }
    });

    const polishedResponse = perfectRes.text || draftText;

    // Calculate token usage of this polish turn
    let inputTokens = Math.ceil(refinePrompt.length / 4);
    let outputTokens = Math.ceil(polishedResponse.length / 4);
    if (perfectRes.usageMetadata) {
      inputTokens = perfectRes.usageMetadata.promptTokenCount || inputTokens;
      outputTokens = perfectRes.usageMetadata.candidatesTokenCount || outputTokens;
    }
    const cost = inputTokens * 0.000000075 + outputTokens * 0.000000300;

    res.json({
      polishedResponse,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCost: parseFloat(cost.toFixed(6)),
      }
    });
  } catch (error: any) {
    console.error("Polish endpoint execution error:", error);
    res.status(500).json({
      error: error.message || "An error occurred during manual polish refinement.",
    });
  }
});

// Start server
async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Gemini Titan backend running at http://localhost:${PORT}`);
  });
}

startServer();
