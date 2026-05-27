import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Zap, Sparkles, Cpu, Layers, Search, Award, CheckCircle2, 
  XCircle, AlertCircle, Clock, ArrowRight, Code2, Brain, 
  ExternalLink, Eye, Settings2, Flame, RefreshCw, Send, ChevronRight,
  Copy, Check, Download, History, Trash2, X, BookOpen, ChevronDown, BookmarkPlus
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BENCHMARK_CASES } from "./benchmarks";
import { PipelineConfig, GenerationResult, PipelineStep } from "./types";

const PROMPT_TEMPLATES = [
  {
    id: "step-by-step",
    name: "Step-by-step logic",
    description: "Enforces detailed analytical breakdowns, explicit constraint tracking, and outline deduction.",
    text: "Please solve the following task with absolute logical precision. Break down your answer into clear, sequential reasoning steps. List all constraints, parameters, or hidden edge cases, then derive the solution with high correctness:\n\n[Your Task or Riddle or Math Question Directives]:\n"
  },
  {
    id: "creative-brainstorming",
    name: "Creative brainstorming",
    description: "Drives divergent lateral thinking, unconventional angles, name hooks, and memorable narratives.",
    text: "Let's brainstorm highly creative ideas, alternative pathways, and expressive hooks under strict constraints. Provide 5 distinct, highly original, non-obvious concepts. Emphasize memorable storytelling, unique analogies, and highly visual names:\n\n[Your Project, Campaign, or Hook Criteria]:\n"
  },
  {
    id: "code-refinement",
    name: "Code refinement",
    description: "Deep-dives into performance bottlenecks, safety bugs, Time/Space (Big O) complexity, and edge cases.",
    text: "Analyze this code structure for bugs, safety hazards, optimization avenues, and edge cases. Detail the theoretical computational complexity (amortized runtime, allocation cost) and provide a polished, clean, and highly robust refactored implementation:\n\n[Your Source Code or Refactoring Goal]:\n"
  },
  {
    id: "socratic-model",
    name: "Socratic explanation",
    description: "Distills complex technical frameworks into simple intuitive analogies with follow-up checkpoints.",
    text: "Please explain this complex technical, scientific, or mathematical concept using hyper-intuitive real-world models and analogies, avoiding academic jargon. Conclude with an active Socratic follow-up question to test comprehension:\n\n[Your Concept or Topic]:\n"
  },
  {
    id: "network-diagnostics",
    name: "Network Audit & Hardening",
    description: "Enforces a systematic security audit of server configurations, router routing paths, subnet ranges, and firewalls.",
    text: "Review the following network architecture, log fragment, or configuration. Analyze it for subnetting correctness (CIDR boundary overlap), routing loops, packet vulnerabilities, single points of failure, open port risks, and security exploits. Recommend specific defensive policies (e.g., iptables, firewalls) and diagnostic tooling (e.g. Wireshark, tcpdump, nmap, netstat) for verification:\n\n[Your Network Setup, Configuration, log fragment or routing table]:\n"
  }
];

export default function App() {
  // Application states
  const [prompt, setPrompt] = useState<string>("");
  const [config, setConfig] = useState<PipelineConfig>({
    useCoT: true,
    useCritique: true,
    useSearch: false,
    persona: "default",
    temperature: 0.7,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"comparison" | "inspection">("comparison");
  const [selectedCase, setSelectedCase] = useState<string>("" as string);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState<boolean>(false);
  
  // Pipeline result and live steps tracking
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [animatedSteps, setAnimatedSteps] = useState<PipelineStep[]>([]);

  // History state for last 5 requests (persisted in localStorage)
  const [history, setHistory] = useState<GenerationResult[]>(() => {
    try {
      const saved = localStorage.getItem("gemini_supercharger_history");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Dynamic templates state (persisted in localStorage, seeded with default PROMPT_TEMPLATES)
  const [templates, setTemplates] = useState<typeof PROMPT_TEMPLATES>(() => {
    try {
      const saved = localStorage.getItem("gemini_supercharger_templates");
      if (saved) {
        const parsed = JSON.parse(saved);
        const combined = [...parsed];
        PROMPT_TEMPLATES.forEach(p => {
          if (!combined.some(c => c.id === p.id)) {
            combined.push(p);
          }
        });
        return combined;
      }
      return PROMPT_TEMPLATES;
    } catch (e) {
      return PROMPT_TEMPLATES;
    }
  });

  const [isSavingCustom, setIsSavingCustom] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>("");
  const [customDesc, setCustomDesc] = useState<string>("");

  // Adaptive layout representation
  const [layoutMode, setLayoutMode] = useState<"side-by-side" | "stacked" | "spotlight">("side-by-side");

  // Custom polish loop and progressive states
  const [polishCritique, setPolishCritique] = useState<string>("");
  const [isPolishing, setIsPolishing] = useState<boolean>(false);

  // Custom synthesizer personas
  const [customPersonas, setCustomPersonas] = useState<Array<{ id: string; name: string; instruction: string }>>(() => {
    try {
      const PRESET_CUSTOM_PERSONAS = [
        {
          id: "custom-socrates",
          name: "Socratic Dialogist",
          instruction: "Do not provide direct, dry answers. Instead, respond entirely in guided Socratic checkups and questions, steering the reader to discover answers incrementally with high logical depth."
        },
        {
          id: "custom-explainer",
          name: "ELIF5 Analogy Forge",
          instruction: "Explain all technical parameters, math constants, and algorithms as if the reader is a 5-year old, using hyper-clear analogies like lego blocks, water pipes, or space rockets."
        }
      ];
      const saved = localStorage.getItem("gemini_supercharger_custom_personas");
      return saved ? JSON.parse(saved) : PRESET_CUSTOM_PERSONAS;
    } catch (e) {
      return [];
    }
  });

  // Clipboard copy states
  const [copiedStandard, setCopiedStandard] = useState<boolean>(false);
  const [copiedSupercharged, setCopiedSupercharged] = useState<boolean>(false);

  const handleCopy = async (text: string, type: "standard" | "supercharged") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "standard") {
        setCopiedStandard(true);
        setTimeout(() => setCopiedStandard(false), 2000);
      } else {
        setCopiedSupercharged(true);
        setTimeout(() => setCopiedSupercharged(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  const handleExportMarkdown = (resultObj: GenerationResult) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `gemini-titan-${timestamp}.md`;
      
      const mdContent = `# Gemini Titan Response
**Original Prompt**: ${resultObj.originalPrompt}

**Configuration Used**:
- Chain of Thought: ${resultObj.steps.some(s => s.name === "cot" && s.status === "completed") ? "Enabled" : "Disabled"}
- Adaptive Self-Critique & Rewrite: ${resultObj.steps.some(s => s.name === "critique" && s.status === "completed") ? "Enabled" : "Disabled"}
- Google Search Grounding: ${resultObj.steps.some(s => s.name === "search" && s.status === "completed") ? "Enabled" : "Disabled"}
- Synthesizer Persona: ${config.persona}
- Temperature Tuning: ${config.temperature}
- Reactor Pipeline Duration: ${(resultObj.totalTime / 1000).toFixed(2)} seconds

---

## Reactor Masterpiece Output

${resultObj.superchargedResponse}

---

*Generated via Gemini Titan inside Google AI Studio*
`;

      const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export to Markdown failed!", err);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem("gemini_supercharger_history");
    } catch (e) {
      console.error("Local storage remove failed:", e);
    }
  };

  const handleSelectHistoryItem = (item: GenerationResult) => {
    if (!item) return;
    setPrompt(item.originalPrompt);
    setResult(item);
    if (item.config) {
      setConfig(item.config);
    } else {
      const hasCoT = item.steps.some(s => s.name === "cot");
      const hasCritique = item.steps.some(s => s.name === "critique");
      const hasSearch = item.steps.some(s => s.name === "search");
      setConfig(prev => ({
        ...prev,
        useCoT: hasCoT,
        useCritique: hasCritique,
        useSearch: hasSearch
      }));
    }
    setSelectedCase("");
    setActiveTab("comparison");
    setIsSidebarOpen(false);
  };

  // Pre-load the first benchmark as default representation
  useEffect(() => {
    handleSelectCase(BENCHMARK_CASES[0].id);
  }, []);

  const handleSelectCase = (id: string) => {
    const testCase = BENCHMARK_CASES.find((c) => c.id === id);
    if (testCase) {
      setSelectedCase(id);
      setPrompt(testCase.originalPrompt);
      setConfig(testCase.recommendedConfig);
    }
  };

  // Simulating real-time timeline movement based on actual API start states
  const handleSupercharge = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setCurrentStepIndex(0);

    // Bootstrap initial empty logging steps so the user sees a loading pipeline
    const initialSteps: PipelineStep[] = [];
    initialSteps.push({ name: "baseline", status: "running", message: "Generating standard baseline response..." });
    initialSteps.push({ name: "enhance", status: "idle", message: "Optimizing prompt structure & constraints..." });
    if (config.useCoT) {
      initialSteps.push({ name: "cot", status: "idle", message: "Decomposing problem structure step-by-step..." });
    }
    if (config.useSearch) {
      initialSteps.push({ name: "search", status: "idle", message: "Retrieving real-time world knowledge via Google Search..." });
    }
    initialSteps.push({ name: "draft", status: "idle", message: "Synthesizing deep reasoning model draft..." });
    if (config.useCritique) {
      initialSteps.push({ name: "critique", status: "idle", message: "Subjecting draft output to strict self-criticism..." });
      initialSteps.push({ name: "refine", status: "idle", message: "Refining output elements according to feedback loop..." });
    }
    setAnimatedSteps(initialSteps);

    // Progressive step simulation during the active HTTP fetch
    let stepSimulatedIndex = 0;
    const loadStartTime = Date.now();
    const simInterval = setInterval(() => {
      setAnimatedSteps(prev => {
        if (stepSimulatedIndex >= prev.length) {
          clearInterval(simInterval);
          return prev;
        }
        const copy = [...prev];
        // Complete current simulated step
        copy[stepSimulatedIndex] = {
          ...copy[stepSimulatedIndex],
          status: "completed",
          duration: Math.max(100, Date.now() - loadStartTime - (stepSimulatedIndex * 1500))
        };
        // Advance to next
        if (stepSimulatedIndex + 1 < copy.length) {
          copy[stepSimulatedIndex + 1].status = "running";
        }
        stepSimulatedIndex += 1;
        setCurrentStepIndex(stepSimulatedIndex);
        return copy;
      });
    }, 1500);

    try {
      // Resolve custom persona instructions if active
      const configToSend = { ...config };
      if (config.persona.startsWith("custom-")) {
        const foundPersona = customPersonas.find(cp => cp.id === config.persona);
        if (foundPersona) {
          configToSend.customInstruction = foundPersona.instruction;
        }
      }

      // Start api call
      const response = await fetch("/api/supercharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, config: configToSend }),
      });

      clearInterval(simInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to contact pipeline reactor server.");
      }

      const data: GenerationResult = await response.json();
      
      // Update with final precise steps from server
      setAnimatedSteps(data.steps);
      setCurrentStepIndex(data.steps.length - 1);

      setResult(data);
      setHistory(prev => {
        const updated = [data, ...prev].slice(0, 10);
        try {
          localStorage.setItem("gemini_supercharger_history", JSON.stringify(updated));
        } catch (e) {
          console.error("Local storage set failed:", e);
        }
        return updated;
      });
      setIsLoading(false);
      setActiveTab("comparison");

    } catch (err: any) {
      clearInterval(simInterval);
      console.error(err);
      setError(err.message || "An unexpected error occurred during synthesis.");
      setIsLoading(false);
    }
  };

  const handleManualPolish = async () => {
    if (!result || !polishCritique.trim() || isPolishing) return;

    setIsPolishing(true);
    try {
      const configToSend = { ...config };
      if (config.persona.startsWith("custom-")) {
        const foundPersona = customPersonas.find(cp => cp.id === config.persona);
        if (foundPersona) {
          configToSend.customInstruction = foundPersona.instruction;
        }
      }

      const response = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftText: result.superchargedResponse,
          critiqueText: polishCritique,
          persona: config.persona,
          temperature: config.temperature,
          config: configToSend
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to polish response.");
      }

      const data = await response.json();
      
      setResult(prev => {
        if (!prev) return null;
        
        // Append actual token stats
        const updatedUsage = prev.usage ? {
          inputTokens: prev.usage.inputTokens + data.usage.inputTokens,
          outputTokens: prev.usage.outputTokens + data.usage.outputTokens,
          totalTokens: prev.usage.totalTokens + data.usage.totalTokens,
          estimatedCost: prev.usage.estimatedCost + data.usage.estimatedCost,
        } : data.usage;

        // Append to step logs
        const updatedSteps = [...prev.steps];
        updatedSteps.push({
          name: `polish-${Date.now()}`,
          status: "completed",
          message: `Polished: "${polishCritique.length > 50 ? polishCritique.substring(0, 50) + "..." : polishCritique}"`,
          duration: 400,
          output: data.polishedResponse
        });

        const updatedResult = {
          ...prev,
          superchargedResponse: data.polishedResponse,
          usage: updatedUsage,
          steps: updatedSteps,
        };

        // Also update in hist
        setHistory(hist => hist.map(h => h.originalPrompt === prev.originalPrompt ? updatedResult : h));
        return updatedResult;
      });

      setPolishCritique("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during manual refinement.");
    } finally {
      setIsPolishing(false);
    }
  };

  // Inline renderer helper to make response outputs look polished with code highlighted
  const renderResponseText = (text: string) => {
    if (!text) return <p className="text-gray-500 italic">No output produced yet.</p>;
    
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.split("\n");
        const language = lines[0].replace("```", "").trim() || "code";
        const code = lines.slice(1, -1).join("\n");
        return (
          <div key={i} className="my-3 overflow-hidden rounded-lg border border-gray-800 bg-[#0d1117] font-mono text-sm">
            <div className="flex items-center justify-between bg-gray-900/60 px-4 py-1.5 text-xs text-gray-400 border-b border-gray-800">
              <span>{language}</span>
              <span className="text-[10px] text-gray-500">READ-ONLY OUTPUT</span>
            </div>
            <pre className="p-4 overflow-x-auto text-emerald-400">{code}</pre>
          </div>
        );
      }
      
      // Simple line space formatter
      return (
        <div key={i} className="whitespace-pre-line leading-relaxed text-gray-300">
          {part}
        </div>
      );
    });
  };

  // Format token data for the last 5 supercharged requests (falls back to premium reference profile when history is empty)
  const chartData = history.length > 0
    ? [...history].reverse().slice(-5).map((h, index) => {
        const shortPrompt = h.originalPrompt.length > 20
          ? h.originalPrompt.substring(0, 20) + "..."
          : h.originalPrompt;
        return {
          name: `Req ${history.length - (history.length > 5 ? 5 : history.length) + index + 1}`,
          prompt: shortPrompt,
          "Input Tokens": h.usage?.inputTokens || 0,
          "Output Tokens": h.usage?.outputTokens || 0,
        };
      })
    : [
        { name: "Req 1 (Ref)", prompt: "Acrostic Neural Poem with Rules", "Input Tokens": 412, "Output Tokens": 850 },
        { name: "Req 2 (Ref)", prompt: "The Strawberry Counting Test", "Input Tokens": 285, "Output Tokens": 540 },
        { name: "Req 3 (Ref)", prompt: "Yesterday's Tech Milestones", "Input Tokens": 350, "Output Tokens": 720 },
        { name: "Req 4 (Ref)", prompt: "The Unstated Second-Player Riddle", "Input Tokens": 512, "Output Tokens": 980 },
        { name: "Req 5 (Ref)", prompt: "Active Live Grounded Query", "Input Tokens": 650, "Output Tokens": 1210 }
      ];

  return (
    <div className="min-h-screen bg-[#070913] text-gray-100 flex flex-col p-4 md:p-6 lg:p-8 selection:bg-indigo-500/30 selection:text-white" id="main_reactor_container">
      {/* RECENT PROMPTS SIDEBAR */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              id="sidebar_backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black z-50 backdrop-blur-xs cursor-pointer"
            />

            {/* Sidebar drawer panel */}
            <motion.div
              id="recent_prompts_sidebar"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 left-0 w-full sm:w-96 bg-[#090b14]/98 border-r border-gray-800/80 shadow-2xl z-55 flex flex-col backdrop-blur-md"
            >
              {/* Sidebar Header */}
              <div className="p-5 border-b border-gray-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-indigo-950/50 border border-indigo-900 p-1.5 rounded-lg flex items-center justify-center">
                    <History className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-gray-100 uppercase tracking-wider">Recent Prompts</h3>
                    <p className="text-[10px] text-gray-500 font-mono">REACTOR SYSTEM LOGS</p>
                  </div>
                </div>
                <button
                  id="btn_close_sidebar"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-800/50 text-gray-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick info panel */}
              <div className="px-5 py-3 bg-indigo-950/10 border-b border-indigo-900/10 text-[11px] text-gray-400 leading-normal font-sans">
                Click any prompt to instantly inject it back into the human intent forge and restore its complete original pipeline outcomes.
              </div>

              {/* Sidebar List Content */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin">
                {history.length > 0 ? (
                  history.slice(0, 10).map((h, i) => {
                    const shortText = h.originalPrompt;
                    const truncatedText = shortText.length > 110 
                      ? shortText.substring(0, 110) + "..." 
                      : shortText;
                    
                    return (
                      <button
                        key={i}
                        id={`recent_prompt_item_${i}`}
                        onClick={() => handleSelectHistoryItem(h)}
                        className="w-full text-left p-3.5 rounded-xl border border-gray-900 hover:border-indigo-900/60 bg-[#070912]/40 hover:bg-indigo-950/15 transition-all cursor-pointer group flex flex-col gap-2 relative overflow-hidden"
                      >
                        <div className="text-gray-300 text-xs leading-relaxed font-sans group-hover:text-white line-clamp-3">
                          {truncatedText}
                        </div>
                        
                        <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-900/40 text-[9px] font-mono text-gray-500">
                          <div className="flex gap-2">
                            {h.usage && (
                              <span className="text-cyan-500/80">
                                {h.usage.totalTokens.toLocaleString()} tokens
                              </span>
                            )}
                            {h.totalTime && (
                              <span>
                                {(h.totalTime / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>
                          <span className="text-indigo-400 group-hover:text-indigo-300 transition-colors uppercase tracking-wider flex items-center gap-0.5 font-semibold">
                            Select <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" id="empty_sidebar_state">
                    <History className="w-8 h-8 text-gray-600/60 mb-2.5 animate-pulse" />
                    <p className="text-xs text-gray-400 font-semibold">No Recent Prompts</p>
                    <p className="text-[10px] text-gray-500 mt-1 max-w-[200px] leading-normal font-sans">
                      Start running pipeline queries to automatically record your supercharged synthesis history entries here.
                    </p>
                  </div>
                )}
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-gray-800 bg-[#070912]/80 flex gap-2">
                <button
                  id="btn_clear_history"
                  disabled={history.length === 0}
                  onClick={handleClearHistory}
                  className="w-full cursor-pointer bg-red-950/30 hover:bg-red-950/50 disabled:bg-transparent disabled:text-gray-600 disabled:border-gray-900 border border-red-900/30 text-red-400 hover:text-red-300 font-medium font-mono text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge Recent History</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <header className="max-w-7xl w-full mx-auto mb-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-indigo-950/40 pb-6 gap-4" id="app_header">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-600 to-cyan-500 p-2 rounded-xl text-white shadow-lg shadow-indigo-600/10">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-3xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-indigo-200">
                GEMINI <span className="text-indigo-400">TITAN</span>
              </h1>
              <p className="text-gray-400 text-xs font-mono mt-0.5">PIPELINE CORE REACTION FORGE / v1.4.1</p>
            </div>
          </div>
          <p className="text-gray-400 text-sm mt-3 max-w-2xl font-sans">
            Standard chat queries execute as simple, unverified direct outputs. The **Titan Reactor** upgrades Gemini with a multi-agent pipeline: automatic prompt enrichment, isolated Chain-Of-Thought planning, recursive self-critique/editing loops, and Google Search grounding to easily out-perform static LLMs.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row md:items-center gap-3 shrink-0 w-full md:w-auto" id="header_tools">
          <button
            id="btn_toggle_sidebar"
            onClick={() => setIsSidebarOpen(true)}
            className="flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border border-indigo-900/40 bg-[#0c0f1d] hover:bg-indigo-950/40 hover:border-indigo-800 text-indigo-300 hover:text-white transition-all cursor-pointer shadow-lg shadow-indigo-950/15 shrink-0 self-stretch sm:self-auto group"
            title="View recent prompts history"
          >
            <History className="w-4 h-4 text-indigo-400 group-hover:rotate-12 transition-transform" />
            <span>Recent Prompts ({history.length})</span>
          </button>

          {/* System telemetry banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-indigo-950/20 border border-indigo-900/30 px-4 py-3 rounded-2xl font-mono text-[11px] flex-1 md:flex-initial" id="telemetry_rail">
            <div className="flex items-center gap-3">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </div>
              <div>
                <div className="text-gray-400">ENGINE STATE: <span className="text-emerald-400">ONLINE</span></div>
                <div className="text-gray-500 text-[9px] mt-0.5">TARGET ACTIVE: @google/genai</div>
              </div>
            </div>

            {result?.usage && (
              <div className="border-t sm:border-t-0 sm:border-l border-indigo-900/40 pt-2 sm:pt-0 sm:pl-4 flex flex-wrap gap-x-4 gap-y-1" id="token_usage_container">
                <div>
                  <span className="text-gray-500">TOTAL TOKENS: </span>
                  <span className="text-cyan-400 font-bold">{result.usage.totalTokens.toLocaleString()}</span>
                  <span className="text-gray-500 text-[9px] ml-1">({result.usage.inputTokens.toLocaleString()} in / {result.usage.outputTokens.toLocaleString()} out)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">EST. COST: </span>
                  <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/45 px-1.5 py-0.5 rounded font-bold">${result.usage.estimatedCost.toFixed(5)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CORE WORKSPACE */}
      <main className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1" id="workspace_matrix">
        
        {/* LEFT COLUMN: CONTROL & INPUT FORGE (4 Cols) */}
        <div className="col-span-1 lg:col-span-5 flex flex-col gap-6" id="forge_controls">
          
          {/* THE PROMPT COMPILER BOX */}
          <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden backdrop-blur-md">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold tracking-wider font-display uppercase text-gray-300 flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-400" /> Human Intent Input
              </h2>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-gray-400/50 border border-gray-800/60 px-1.5 py-0.5 rounded bg-[#0b0d18]/40 select-none">⌘/Ctrl + Enter</span>
                <span className={`px-1.5 py-0.5 rounded border transition-all duration-300 ${
                  prompt.length > 2000 
                    ? 'text-amber-400 bg-amber-950/40 border-amber-500/50 font-semibold' 
                    : 'text-gray-500 bg-[#0b0d18]/40 border-transparent'
                }`}>
                  {prompt.length} chars
                </span>
              </div>
            </div>

            {/* PROMPT TEMPLATE LIBRARY DROPDOWN */}
            <div className="relative z-30" id="prompt_template_selector_container">
              <button
                type="button"
                id="btn_prompt_templates"
                onClick={() => setIsTemplateMenuOpen(!isTemplateMenuOpen)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold rounded-xl border border-gray-800 bg-[#0c0f1d] hover:bg-indigo-950/20 hover:border-indigo-900/60 text-gray-300 hover:text-white transition-all cursor-pointer shadow-inner shadow-black/40"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Prompt Template Library</span>
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[9px] text-gray-500 font-normal">
                  <span>optimized structures</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${isTemplateMenuOpen ? "rotate-180" : ""}`} />
                </span>
              </button>

              <AnimatePresence>
                {isTemplateMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setIsTemplateMenuOpen(false)} 
                    />
                    <motion.div
                      id="prompt_templates_dropdown"
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-40 top-full inset-x-0 mt-1.5 p-2 rounded-xl border border-gray-800 bg-[#101222]/98 shadow-2xl backdrop-blur-md flex flex-col gap-1 max-h-80 overflow-y-auto scrollbar-thin"
                    >
                      {templates.map((tmpl) => {
                        const isCustom = tmpl.id.startsWith("custom-");
                        return (
                          <div
                            key={tmpl.id}
                            className="relative"
                          >
                            <button
                              id={`btn_template_option_${tmpl.id}`}
                              onClick={() => {
                                setPrompt(tmpl.text);
                                setSelectedCase("");
                                setIsTemplateMenuOpen(false);
                              }}
                              className="w-full text-left p-2.5 rounded-lg hover:bg-indigo-950/30 hover:border-indigo-900/40 border border-transparent transition-all duration-150 cursor-pointer group flex flex-col gap-1 pr-14"
                            >
                              <span className="font-sans font-bold text-xs text-gray-200 group-hover:text-indigo-300 flex items-center justify-between">
                                <span className="flex items-center gap-1.5 truncate">
                                  {tmpl.name}
                                  {isCustom && (
                                    <span className="text-[8px] bg-indigo-950/80 border border-indigo-900/60 px-1 py-0.5 rounded text-indigo-400 font-mono font-medium shrink-0">
                                      CUSTOM
                                    </span>
                                  )}
                                </span>
                                <span className="text-[8px] font-mono font-medium text-indigo-400/80 bg-indigo-950/50 border border-indigo-900/30 px-1.5 py-0.5 rounded-md uppercase tracking-wider group-hover:bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  Inject
                                </span>
                              </span>
                              <span className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed font-sans pr-4">
                                {tmpl.description}
                              </span>
                            </button>

                            {isCustom && (
                              <button
                                type="button"
                                title="Delete Custom Template"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTemplates(prev => {
                                    const updated = prev.filter(t => t.id !== tmpl.id);
                                    try {
                                      localStorage.setItem("gemini_supercharger_templates", JSON.stringify(updated));
                                    } catch (err) {
                                      console.error("Local storage templates write failed:", err);
                                    }
                                    return updated;
                                  });
                                }}
                                className="absolute right-2 top-1.5 p-1 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-950/20 cursor-pointer transition-colors z-10 flex items-center justify-center"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="relative group">
              <textarea
                id="prompt_input"
                className={`w-full h-36 bg-[#0c0f1d] border rounded-xl p-3.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 resize-none transition-all duration-200 ${
                  prompt.length > 2000 
                    ? 'border-amber-500/80 focus:ring-amber-500/30 focus:border-amber-500' 
                    : 'border-gray-800 focus:ring-indigo-500/50 focus:border-indigo-500/80'
                }`}
                placeholder="Enter some raw reasoning task, riddles, math constraints, or complex question here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    if (!isLoading && prompt.trim()) {
                      handleSupercharge();
                    }
                  }
                }}
              />
              {prompt.trim() === "" && (
                <div className="absolute top-3 left-3 pointer-events-none text-xs text-gray-500 flex flex-col gap-1 italic">
                  <span>Try: "How many letters 'r' are in strawberry?"</span>
                </div>
              )}
            </div>

            {/* DYNAMIC COST WARNING INDICATOR */}
            <AnimatePresence>
              {prompt.length > 2000 && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: "auto", scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-amber-950/20 border border-amber-900/60 rounded-xl p-3 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0 animate-pulse" />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-amber-400 font-mono">Cost & Performance Efficiency Guard</div>
                      <div className="text-[11px] text-amber-300/80 leading-relaxed mt-0.5">
                        Your prompt contains <span className="font-bold text-amber-400">{prompt.length}</span> characters. Massive inputs compiled through recursive critique loops may decrease response speed or exceed execution budgets. Consider pruning redundancy.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SAVE TO LIBRARY SUB-TRAY / FORM CONTROLS */}
            {prompt.trim() !== "" && (
              <div className="flex flex-col gap-2 bg-[#0a0c16]/50 border border-gray-800/80 rounded-xl p-3" id="save_template_tray">
                {!isSavingCustom ? (
                  <div className="flex items-center justify-between gap-2" id="save_prompt_action_row">
                    <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                      Drafting Custom Intel
                    </span>
                    <button
                      type="button"
                      id="btn_trigger_save_custom"
                      onClick={() => {
                        setIsSavingCustom(true);
                        setCustomName("");
                        setCustomDesc("");
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-indigo-400 border border-indigo-950 hover:border-indigo-800 bg-indigo-950/20 hover:bg-indigo-950/40 rounded-lg transition-all cursor-pointer font-mono"
                    >
                      <BookmarkPlus className="w-3 h-3" />
                      <span>SAVE TO LIBRARY</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2" id="save_prompt_form">
                    <div className="flex items-center justify-between border-b border-gray-800/60 pb-1.5 mb-1">
                      <span className="text-[10px] font-bold text-indigo-400 font-mono uppercase tracking-wider flex items-center gap-1">
                        <BookmarkPlus className="w-3.5 h-3.5" /> Save custom template
                      </span>
                      <button
                        type="button"
                        id="btn_cancel_save_custom"
                        onClick={() => setIsSavingCustom(false)}
                        className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800/20 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor="custom_template_name" className="text-[9px] font-mono text-gray-400 uppercase">Template Name</label>
                      <input
                        type="text"
                        id="custom_template_name"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="e.g., My Coding Critique Frame"
                        className="bg-[#0c0f1d] border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        maxLength={40}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor="custom_template_desc" className="text-[9px] font-mono text-gray-400 uppercase">Description (optional)</label>
                      <input
                        type="text"
                        id="custom_template_desc"
                        value={customDesc}
                        onChange={(e) => setCustomDesc(e.target.value)}
                        placeholder="e.g., For checking standard variables"
                        className="bg-[#0c0f1d] border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        maxLength={110}
                      />
                    </div>

                    <div className="flex justify-end gap-2 mt-1">
                      <button
                        type="button"
                        id="btn_cancel_save_custom_footer"
                        onClick={() => setIsSavingCustom(false)}
                        className="px-2.5 py-1 text-[10px] text-gray-400 hover:text-white hover:bg-gray-800/40 border border-transparent rounded-md cursor-pointer font-mono"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        id="btn_confirm_save_custom"
                        disabled={!customName.trim()}
                        onClick={() => {
                          if (!customName.trim()) return;
                          const newTmpl = {
                            id: `custom-${Date.now()}`,
                            name: customName.trim(),
                            description: customDesc.trim() || "User saved custom structure",
                            text: prompt
                          };
                          setTemplates(prev => {
                            const updated = [newTmpl, ...prev];
                            try {
                              localStorage.setItem("gemini_supercharger_templates", JSON.stringify(updated));
                            } catch (e) {
                              console.error("Local storage templates write failed:", e);
                            }
                            return updated;
                          });
                          setIsSavingCustom(false);
                          setCustomName("");
                          setCustomDesc("");
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 rounded-md transition-all cursor-pointer font-mono shadow-md shadow-indigo-600/10"
                      >
                        Confirm Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* QUICK BLUEPRINT BENCHMARKS */}
            <div className="flex flex-col gap-2.5">
              <span className="text-gray-500 font-mono text-[10px] uppercase tracking-wider">Benchmark Blueprints</span>
              <div className="grid grid-cols-2 gap-2">
                {BENCHMARK_CASES.map((b) => (
                  <button
                    key={b.id}
                    id={`btn_bench_${b.id}`}
                    onClick={() => handleSelectCase(b.id)}
                    className={`flex flex-col text-left p-2 rounded-lg border text-xs transition-all duration-150 ${
                      selectedCase === b.id
                        ? "bg-indigo-950/40 border-indigo-500/80 text-white"
                        : "bg-[#0b0c16] border-gray-800 hover:border-gray-700 text-gray-400"
                    }`}
                  >
                    <span className="font-semibold truncate">{b.title}</span>
                    <span className="text-[9px] text-gray-500 truncate mt-0.5">{b.category}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PIPELINE COGNITIVE CONTROLS */}
          <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-5 flex flex-col gap-4 backdrop-blur-md">
            <h2 className="text-sm font-semibold tracking-wider font-display uppercase text-gray-300 flex items-center gap-2 border-b border-gray-800/60 pb-2.5">
              <Settings2 className="w-4 h-4 text-indigo-400" /> Pipeline Multi-Agents
            </h2>

            {/* COT TOGGLE */}
            <div className="flex gap-3.5 items-start p-2 rounded-xl transition-all duration-200 hover:bg-gray-800/20">
              <input
                type="checkbox"
                id="toggle_cot"
                checked={config.useCoT}
                onChange={(e) => setConfig({ ...config, useCoT: e.target.checked })}
                className="w-4 h-4 mt-1 rounded text-indigo-600 bg-gray-900 border-gray-700 focus:ring-indigo-500 accent-indigo-500"
              />
              <label htmlFor="toggle_cot" className="cursor-pointer">
                <div className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" /> [Agent 1] Chain-Of-Thought Plan
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  Enforces explicit step-by-step reasoning & planning within isolated tags before executing answer drafting.
                </div>
              </label>
            </div>

            {/* CRITIQUE TOGGLE */}
            <div className="flex gap-3.5 items-start p-2 rounded-xl transition-all duration-200 hover:bg-gray-800/20">
              <input
                type="checkbox"
                id="toggle_critique"
                checked={config.useCritique}
                onChange={(e) => setConfig({ ...config, useCritique: e.target.checked })}
                className="w-4 h-4 mt-1 rounded text-indigo-600 bg-gray-900 border-gray-700 focus:ring-indigo-500 accent-indigo-500"
              />
              <label htmlFor="toggle_critique" className="cursor-pointer">
                <div className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-rose-400" /> [Agent 2] Adversarial Critique & Rewrite
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  Draft is passed to a strict critic agent that audits logical gaps, forcing an upgraded recursive re-draft step.
                </div>
              </label>
            </div>

            {/* WEB GROUNDING TOGGLE */}
            <div className="flex gap-3.5 items-start p-2 rounded-xl transition-all duration-200 hover:bg-gray-800/20">
              <input
                type="checkbox"
                id="toggle_search"
                checked={config.useSearch}
                onChange={(e) => setConfig({ ...config, useSearch: e.target.checked })}
                className="w-4 h-4 mt-1 rounded text-indigo-600 bg-gray-900 border-gray-700 focus:ring-indigo-500 accent-indigo-500"
              />
              <label htmlFor="toggle_search" className="cursor-pointer">
                <div className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-emerald-400" /> [Agent 3] Live Google Search Tool
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  Injects live Google Search web indexing blocks with source citations to defeat static knowledge walls.
                </div>
              </label>
            </div>

            {/* PERSONA DROPDOWN */}
            <div className="flex flex-col gap-1.5 mt-2" id="persona_control_section">
              <div className="flex items-center justify-between">
                <label htmlFor="persona_selector" className="text-xs font-mono text-gray-400">Synthesizer Persona</label>
                <button
                  type="button"
                  id="btn_create_custom_persona"
                  onClick={() => {
                    const id = `custom-${Date.now()}`;
                    const newCP = {
                      id,
                      name: `My Persona ${customPersonas.length + 1}`,
                      instruction: "You are an assistant. Address the user constraints with clear precision..."
                    };
                    const updated = [...customPersonas, newCP];
                    setCustomPersonas(updated);
                    try {
                      localStorage.setItem("gemini_supercharger_custom_personas", JSON.stringify(updated));
                    } catch (e) {}
                    setConfig(prev => ({ ...prev, persona: id }));
                  }}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1 cursor-pointer transition-colors"
                >
                  + CRAFT NEW
                </button>
              </div>
              <select
                id="persona_selector"
                value={config.persona}
                onChange={(e) => setConfig({ ...config, persona: e.target.value })}
                className="w-full bg-[#0c0f1d] border border-gray-800 rounded-lg py-2 px-3 text-xs text-gray-300 focus:ring-indigo-500/50"
              >
                <option value="default">Standard Smart Companion</option>
                <option value="academic">Scientific Researcher & Scholar</option>
                <option value="code-architect">Principal Code Architect</option>
                <option value="creative-writer">Prize Creative Essayist</option>
                <option value="logical-solver">Mathematical Logician</option>
                <option value="network-admin">Enterprise Network Admin</option>
                {customPersonas.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    🎭 {cp.name}
                  </option>
                ))}
              </select>

              {/* DYNAMIC CUSTOM PERSONA EDITOR PANEL */}
              {config.persona.startsWith("custom-") && (() => {
                const activeCP = customPersonas.find(cp => cp.id === config.persona);
                if (!activeCP) return null;
                return (
                  <div className="mt-2.5 p-3 rounded-xl border border-indigo-900/40 bg-[#0b0c16]/80 flex flex-col gap-2.5" id="custom_persona_editor_tray">
                    <div className="flex items-center justify-between border-b border-gray-800/60 pb-1.5">
                      <span className="text-[10px] font-bold text-indigo-400 font-mono tracking-wider uppercase flex items-center gap-1">
                        <Settings2 className="w-3 h-3" /> Persona Settings
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = customPersonas.filter(cp => cp.id !== activeCP.id);
                          setCustomPersonas(updated);
                          try {
                            localStorage.setItem("gemini_supercharger_custom_personas", JSON.stringify(updated));
                          } catch (e) {}
                          setConfig(prev => ({ ...prev, persona: "default" }));
                        }}
                        className="text-[9px] font-mono text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer transition-colors font-bold"
                        title="Delete Persona"
                      >
                        <Trash2 className="w-3 h-3" /> DELETE
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-mono text-gray-500 uppercase">Persona Title</label>
                      <input
                        type="text"
                        value={activeCP.name}
                        onChange={(e) => {
                          const updated = customPersonas.map(cp => cp.id === activeCP.id ? { ...cp, name: e.target.value } : cp);
                          setCustomPersonas(updated);
                          try {
                            localStorage.setItem("gemini_supercharger_custom_personas", JSON.stringify(updated));
                          } catch (err) {}
                        }}
                        placeholder="e.g., Sassy Debugger"
                        className="bg-[#0c0f1d] border border-gray-800 rounded-md px-2 py-1 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                        maxLength={25}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-mono text-gray-500 uppercase">System Instructions Injector</label>
                      <textarea
                        value={activeCP.instruction}
                        onChange={(e) => {
                          const updated = customPersonas.map(cp => cp.id === activeCP.id ? { ...cp, instruction: e.target.value } : cp);
                          setCustomPersonas(updated);
                          try {
                            localStorage.setItem("gemini_supercharger_custom_personas", JSON.stringify(updated));
                          } catch (err) {}
                        }}
                        placeholder="Define how this custom synthesis agent acts and structures its output masterpiece..."
                        className="bg-[#0c0f1d] border border-gray-800 rounded-md p-2 text-[10px] text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-20 resize-none leading-relaxed font-sans"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* TEMPERATURE SLIDER */}
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex justify-between text-xs font-mono text-gray-400">
                <span>Core Temperature</span>
                <span>{config.temperature}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* TRIGGER BUTTON */}
            <button
              id="btn_ignite_supercharger"
              disabled={isLoading || !prompt.trim()}
              onClick={handleSupercharge}
              className="mt-4 w-full cursor-pointer bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 disabled:from-gray-900 disabled:to-gray-900 disabled:text-gray-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
                  <span>Processing Engine Loops...</span>
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>IGNITE PIPELINE REACTION</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: REACTION CHAMBER & BENCHMARK ARENA (7 Cols) */}
        <div className="col-span-1 lg:col-span-7 flex flex-col gap-6" id="reactor_display">
          
          {/* PROCESS TIMELINE LOGS (VISIBLE WHEN LOADING OR DONE) */}
          <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-5 flex flex-col gap-3.5 backdrop-blur-md">
            <h2 className="text-sm font-semibold tracking-wider font-display uppercase text-gray-300 flex items-center justify-between border-b border-gray-800/60 pb-2.5">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400 animate-spin" /> Reaction Chamber Logic Pipeline
              </span>
              {result && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 px-2 py-0.5 rounded-full">
                  Cycles Completed in {(result.totalTime / 1000).toFixed(2)}s
                </span>
              )}
            </h2>

            <div className="flex flex-col gap-2">
              {animatedSteps.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-500 italic">
                  Adjust controls on the left and ignite the reactor engine.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {animatedSteps.map((step, idx) => {
                    const isCompleted = step.status === "completed";
                    const isRunning = step.status === "running";
                    const isFailed = step.status === "failed";
                    const isIdle = step.status === "idle";

                    return (
                      <div 
                        key={step.name} 
                        className={`p-3 rounded-xl border flex items-center gap-3 transition-all duration-200 ${
                          isRunning 
                            ? "bg-indigo-950/20 border-indigo-500/50 shadow-sm shadow-indigo-500/10" 
                            : isCompleted 
                              ? "bg-[#090b14]/90 border-emerald-950/40" 
                              : "bg-[#090b14]/40 border-gray-900/80 opacity-60"
                        }`}
                      >
                        {/* Status Icon */}
                        <div className="shrink-0">
                          {isCompleted && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />}
                          {isRunning && <RefreshCw className="w-4.5 h-4.5 text-indigo-400 animate-spin" />}
                          {isFailed && <XCircle className="w-4.5 h-4.5 text-rose-500" />}
                          {isIdle && <Clock className="w-4.5 h-4.5 text-gray-700" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">Agent Step {idx + 1}</span>
                            {isCompleted && step.duration && (
                              <span className="text-[9px] text-gray-500 font-mono">{step.duration}ms</span>
                            )}
                          </div>
                          <p className="text-[11px] font-sans text-gray-200 font-medium truncate mt-0.5">{step.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {error && (
              <div className="mt-2 p-3 bg-red-950/30 border border-red-900/50 rounded-xl text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Pipeline Core Breakdown</p>
                  <p className="text-[11px] text-red-400/80 mt-0.5">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* MAIN OUTPUT COMPARISON TABS (ONLY VISIBLE IF RESULT EXISTS) */}
          {result && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="flex flex-col flex-1"
            >
              {/* TAB SELECTOR & LAYOUT TUNER ROW */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4" id="view_control_bar">
                <div className="flex rounded-lg bg-[#0c0e1a] p-1 border border-gray-800/60 w-full sm:max-w-sm">
                  <button
                    type="button"
                    onClick={() => setActiveTab("comparison")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
                      activeTab === "comparison"
                        ? "bg-indigo-900/30 text-white border border-indigo-700/30 shadow-inner"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" /> Comparison View
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("inspection")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
                      activeTab === "inspection"
                        ? "bg-indigo-900/30 text-white border border-indigo-700/30 shadow-inner"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" /> Inspection Lab
                  </button>
                </div>

                {activeTab === "comparison" && (
                  <div className="flex items-center gap-2 bg-[#0a0c16] border border-gray-800/80 p-1 rounded-lg text-xs w-full sm:w-auto" id="layout_selector">
                    <span className="text-[10px] text-gray-500 font-mono px-2 uppercase font-semibold hidden lg:block">Layout Preset:</span>
                    <button
                      type="button"
                      id="btn_layout_side"
                      onClick={() => setLayoutMode("side-by-side")}
                      className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-md font-medium text-[11px] transition-all cursor-pointer ${
                        layoutMode === "side-by-side"
                          ? "bg-indigo-900/30 text-indigo-300 border border-indigo-700/30"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                      title="Split columns"
                    >
                      Split Columns
                    </button>
                    <button
                      type="button"
                      id="btn_layout_spot"
                      onClick={() => setLayoutMode("spotlight")}
                      className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-md font-medium text-[11px] transition-all cursor-pointer ${
                        layoutMode === "spotlight"
                          ? "bg-indigo-900/30 text-indigo-300 border border-indigo-700/30"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                      title="Supercharged spotlight wide screen"
                    >
                      Spotlight Wide
                    </button>
                    <button
                      type="button"
                      id="btn_layout_stack"
                      onClick={() => setLayoutMode("stacked")}
                      className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-md font-medium text-[11px] transition-all cursor-pointer ${
                        layoutMode === "stacked"
                          ? "bg-indigo-900/30 text-indigo-300 border border-indigo-700/30"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                      title="Horizontal Stack"
                    >
                      Stacked Rows
                    </button>
                  </div>
                )}
              </div>

              {/* REACTOR REACTION METRICS GRID */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-in" id="reactor_advanced_metrics_grid">
                
                {/* METRIC 1: CONTEXT EXPANSION */}
                <div className="bg-[#0b0c16]/50 border border-gray-800/80 p-4 rounded-xl flex flex-col gap-1 relative overflow-hidden group">
                  <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider font-semibold">Synthesis Expansion Depth</span>
                  <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-300 font-display">
                    {(() => {
                      const stdLen = result.standardResponse?.length || 1;
                      const supLen = result.superchargedResponse?.length || 1;
                      const ratio = supLen / stdLen;
                      return `${ratio.toFixed(1)}x deeper`;
                    })()}
                  </span>
                  <p className="text-[10px] text-gray-400 font-sans mt-1 leading-relaxed">Multi-stage pipeline content and formatting resolution vs original LLM responses.</p>
                </div>

                {/* METRIC 2: CRITIQUE CORRECTION LEVEL */}
                <div className="bg-[#0b0c16]/50 border border-gray-800/80 p-4 rounded-xl flex flex-col gap-1 relative overflow-hidden group">
                  <span className="text-[9px] font-mono text-rose-400 uppercase tracking-wider font-semibold">Self-Criticism Audits</span>
                  <span className="text-xl font-extrabold text-rose-400 font-display">
                    {result.critiqueText ? (
                      (() => {
                        const bulletMatches = result.critiqueText.match(/^[-*\d+.]/gm);
                        return bulletMatches ? `${bulletMatches.length} items caught` : "Audit Completed";
                      })()
                    ) : "Bypassed"}
                  </span>
                  <p className="text-[10px] text-gray-400 font-sans mt-1 leading-relaxed">Structural errors, logical loops, formatting misses audited by adversarial critic agent.</p>
                </div>

                {/* METRIC 3: WEB GROUNDING */}
                <div className="bg-[#0b0c16]/50 border border-gray-800/80 p-4 rounded-xl flex flex-col gap-1 relative overflow-hidden group">
                  <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">Google Index Grounding</span>
                  <span className="text-xl font-extrabold text-emerald-400 font-display">
                    {result.searchSources && result.searchSources.length > 0 
                      ? `${result.searchSources.length} Fact Sources` 
                      : "Knowledge Cutoff"
                    }
                  </span>
                  <p className="text-[10px] text-gray-400 font-sans mt-1 leading-relaxed">Real-time indices fetched dynamically and referenced by grounding engine blocks.</p>
                </div>

                {/* METRIC 4: SYNTHESIS VELOCITY */}
                <div className="bg-[#0b0c16]/50 border border-gray-800/80 p-4 rounded-xl flex flex-col gap-1 relative overflow-hidden group">
                  <span className="text-[9px] font-mono text-amber-400 uppercase tracking-wider font-semibold">Pipeline Velocity Rate</span>
                  <span className="text-xl font-extrabold text-amber-400 font-display">
                    {(() => {
                      const words = result.superchargedResponse ? result.superchargedResponse.split(/\s+/).length : 0;
                      const secs = result.totalTime ? (result.totalTime / 1000) : 1;
                      return `${(words / secs).toFixed(1)} words/sec`;
                    })()}
                  </span>
                  <p className="text-[10px] text-gray-400 font-sans mt-1 leading-relaxed">Pipeline master text synthesis speed relative to concurrent background planning.</p>
                </div>

              </div>

              {/* TAB 1: COMPARISON VIEW */}
              <AnimatePresence mode="wait">
                {activeTab === "comparison" && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    key="tab-comparison"
                    className={
                      layoutMode === "side-by-side"
                        ? "grid grid-cols-1 md:grid-cols-2 gap-6 flex-1"
                        : layoutMode === "spotlight"
                          ? "grid grid-cols-1 md:grid-cols-3 gap-6 flex-1"
                          : "flex flex-col gap-6 flex-1"
                    }
                  >
                    {/* STANDARD RESPONSE (CHATGPT STYLE) */}
                    <div className={`bg-[#090b14] border border-gray-900 rounded-2xl flex flex-col shadow-2xl transition-all duration-300 ${
                      layoutMode === "spotlight" ? "col-span-1 h-[520px]" : layoutMode === "stacked" ? "w-full h-[320px]" : "h-[520px]"
                    }`}>
                      <div className="px-5 py-3.5 bg-gray-900/30 border-b border-gray-900 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                          <div>
                            <div className="text-xs font-bold text-gray-200">Standard Direct Response</div>
                            <div className="text-[9px] text-gray-500 font-mono">Analogous to single-turn ChatGPT-3.5</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCopy(result.standardResponse, "standard")}
                          className="flex items-center gap-1 text-[11px] font-mono text-gray-400 hover:text-white bg-gray-800/40 hover:bg-gray-800/80 px-2 py-1 rounded transition-all cursor-pointer"
                          title="Copy standard response"
                        >
                          {copiedStandard ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="p-5 overflow-y-auto text-sm flex-1">
                        {renderResponseText(result.standardResponse)}
                      </div>
                    </div>

                    {/* SUPERCHARGED RESPONSE */}
                    <div className={`bg-[#090b14] border border-indigo-950/60 rounded-2xl flex flex-col shadow-2xl relative overflow-hidden transition-all duration-300 ${
                      layoutMode === "spotlight" ? "col-span-1 md:col-span-2 h-[520px]" : layoutMode === "stacked" ? "w-full h-auto min-h-[480px]" : "h-[520px]"
                    }`}>
                      {/* Active glow effects */}
                      <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/5 blur-3xl pointer-events-none"></div>

                      <div className="px-5 py-3.5 bg-indigo-950/20 border-b border-indigo-950/60 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping"></div>
                          <div>
                            <div className="text-xs font-bold text-indigo-300">Reactor Masterpiece</div>
                            <div className="text-[9px] text-gray-400 font-mono">Enriched through cognitive pipeline</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="hidden sm:flex text-[10px] font-semibold text-emerald-400 items-center gap-1">
                            <Award className="w-3 h-3" /> VERIFIED OUTSTANDING
                          </span>
                          <button
                            onClick={() => handleExportMarkdown(result)}
                            className="flex items-center gap-1 text-[11px] font-mono text-indigo-300 hover:text-white bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-800/40 px-2 py-1 rounded transition-all cursor-pointer"
                            title="Export to Markdown"
                          >
                            <Download className="w-3 h-3" />
                            <span>Export .md</span>
                          </button>
                          <button
                            onClick={() => handleCopy(result.superchargedResponse, "supercharged")}
                            className="flex items-center gap-1 text-[11px] font-mono text-indigo-300 hover:text-white bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-800/40 px-2 py-1 rounded transition-all cursor-pointer"
                            title="Copy supercharged response"
                          >
                            {copiedSupercharged ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="p-5 overflow-y-auto text-sm flex-1">
                        {renderResponseText(result.superchargedResponse)}
                      </div>

                      {/* MANUAL CRITIQUE SANDBOX PANEL */}
                      <div className="px-5 py-3.5 border-t border-indigo-950/40 bg-indigo-950/5 flex flex-col gap-2 shrink-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                            Multi-Agent Critique Sandbox
                          </span>
                          <span className="text-[9px] font-mono text-gray-500">Ad-Hoc Manual Correction Loop</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            id="input_manual_critique"
                            value={polishCritique}
                            onChange={(e) => setPolishCritique(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !isPolishing && polishCritique.trim()) {
                                handleManualPolish();
                              }
                            }}
                            disabled={isPolishing}
                            placeholder="Feedback e.g., 'Translate to French', 'Convert to bullet points', 'Make more technical'..."
                            className="flex-1 bg-[#090b14] border border-indigo-950/60 rounded-xl px-3.5 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
                          />
                          <button
                            type="button"
                            id="btn_apply_manual_polish"
                            disabled={isPolishing || !polishCritique.trim()}
                            onClick={handleManualPolish}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap min-w-[110px] justify-center"
                          >
                            {isPolishing ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Refining...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3 h-3 text-indigo-200" />
                                <span>Inject Feedbacks</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* DURATION BREAKDOWN FOOTER */}
                      {(() => {
                        const getStepDur = (name: string): number => {
                          const s = result.steps?.find(item => item.name === name);
                          return (s && s.status === "completed") ? (s.duration || 0) : 0;
                        };

                        const cotDur = getStepDur("cot");
                        const searchDur = getStepDur("search");
                        const critiqueDur = getStepDur("critique") + getStepDur("refine");
                        const baselineDur = getStepDur("baseline");
                        const draftDur = getStepDur("draft");
                        const enhanceDur = getStepDur("enhance");

                        const coreDur = baselineDur + draftDur + enhanceDur;
                        const totalAccounted = cotDur + searchDur + critiqueDur + coreDur;
                        const totalTime = result.totalTime || totalAccounted || 1;

                        // Percentages based on actual total execution time
                        const cotPct = totalTime > 1 ? (cotDur / totalTime) * 100 : 0;
                        const searchPct = totalTime > 1 ? (searchDur / totalTime) * 100 : 0;
                        const critiquePct = totalTime > 1 ? (critiqueDur / totalTime) * 100 : 0;
                        const corePct = totalTime > 1 ? (coreDur / totalTime) * 100 : 0;

                        const activeConfig = result.config || config;

                        return (
                          <div id="supercharged_duration_breakdown" className="px-5 py-3 border-t border-indigo-950/70 bg-[#070914] flex flex-col gap-2 shrink-0 select-none">
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="text-gray-400 font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                Pipeline Audit Timeline
                              </span>
                              <span className="text-indigo-300 font-bold bg-indigo-950/40 border border-indigo-900/30 px-2 py-0.5 rounded text-[10px]">
                                Real-Time: {(result.totalTime / 1000).toFixed(2)}s
                              </span>
                            </div>

                            {/* Stacked Percentage Timeline Track */}
                            <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden flex shadow-inner">
                              {cotPct > 0 && (
                                <div 
                                  className="h-full bg-cyan-500 transition-all duration-300"
                                  style={{ width: `${cotPct}%` }}
                                  title={`Chain-of-Thought (CoT): ${cotDur}ms (${cotPct.toFixed(1)}%)`}
                                />
                              )}
                              {searchPct > 0 && (
                                <div 
                                  className="h-full bg-emerald-500 transition-all duration-300"
                                  style={{ width: `${searchPct}%` }}
                                  title={`Web Search Grounding: ${searchDur}ms (${searchPct.toFixed(1)}%)`}
                                />
                              )}
                              {critiquePct > 0 && (
                                <div 
                                  className="h-full bg-rose-500 transition-all duration-300"
                                  style={{ width: `${critiquePct}%` }}
                                  title={`Self-Critique Audit Loop: ${critiqueDur}ms (${critiquePct.toFixed(1)}%)`}
                                />
                              )}
                              {corePct > 0 && (
                                <div 
                                  className="h-full bg-indigo-500 transition-all duration-300"
                                  style={{ width: `${corePct}%` }}
                                  title={`Drafting & Compiling: ${coreDur}ms (${corePct.toFixed(1)}%)`}
                                />
                              )}
                            </div>

                            {/* Metrics Details */}
                            <div className="grid grid-cols-4 gap-1.5 text-[9px] font-mono leading-tight">
                              <div className="flex flex-col">
                                <span className="text-cyan-400 font-semibold flex items-center gap-1 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                                  CoT Pre-Think
                                </span>
                                <span className="text-gray-400 font-medium pl-2.5 mt-0.5">
                                  {activeConfig.useCoT ? `${cotDur}ms (${cotPct.toFixed(0)}%)` : "Bypassed"}
                                </span>
                              </div>

                              <div className="flex flex-col">
                                <span className="text-emerald-400 font-semibold flex items-center gap-1 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                                  Google Search
                                </span>
                                <span className="text-gray-400 font-medium pl-2.5 mt-0.5">
                                  {activeConfig.useSearch ? `${searchDur}ms (${searchPct.toFixed(0)}%)` : "Bypassed"}
                                </span>
                              </div>

                              <div className="flex flex-col">
                                <span className="text-rose-400 font-semibold flex items-center gap-1 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
                                  Agent Critique
                                </span>
                                <span className="text-gray-400 font-medium pl-2.5 mt-0.5">
                                  {activeConfig.useCritique ? `${critiqueDur}ms (${critiquePct.toFixed(0)}%)` : "Bypassed"}
                                </span>
                              </div>

                              <div className="flex flex-col">
                                <span className="text-indigo-400 font-semibold flex items-center gap-1 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                                  Core Synthesis
                                </span>
                                <span className="text-gray-400 font-medium pl-2.5 mt-0.5">
                                  {coreDur}ms ({corePct.toFixed(0)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}

                {/* TAB 2: INSPECTION LAB */}
                {activeTab === "inspection" && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    key="tab-inspection"
                    className="flex flex-col gap-5 flex-1"
                  >
                    {/* OPTIMIZED PROMPT */}
                    <div className="bg-[#080a13] border border-gray-800 rounded-2xl p-5">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono">Enriched Meta-Prompt Compile</span>
                        <span className="text-gray-500 text-[9px] font-mono">Auto generated</span>
                      </div>
                      <pre className="text-xs text-gray-300 bg-gray-900/40 p-4 rounded-xl border border-gray-850 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {result.enhancedPrompt}
                      </pre>
                    </div>

                    {/* SECTIONS GRID - COT AND CRITIQUE COGNITION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* CHAIN OF THOUGHT PATH */}
                      <div className="bg-[#080a13] border border-gray-800 rounded-2xl p-5 flex flex-col h-72">
                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5 border-b border-gray-800 pb-1.5">
                          <Cpu className="w-3.5 h-3.5" /> Chain-Of-Thought planning XML
                        </span>
                        <div className="overflow-y-auto pr-1 flex-1 font-mono text-[11px] text-cyan-200/80 py-1 leading-relaxed">
                          {result.cotText ? (
                            <pre className="whitespace-pre-wrap">{result.cotText}</pre>
                          ) : (
                            <span className="text-gray-500 italic font-sans text-xs">Chain-Of-Thought plan was disabled for this run.</span>
                          )}
                        </div>
                      </div>

                      {/* THE HARSH ADVERSARIAL CRITIQUE */}
                      <div className="bg-[#080a13] border border-gray-800 rounded-2xl p-5 flex flex-col h-72">
                        <span className="text-xs font-bold text-rose-400 uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5 border-b border-gray-800 pb-1.5">
                          <Award className="w-3.5 h-3.5" /> Agent Critique Feedbacks
                        </span>
                        <div className="overflow-y-auto pr-1 flex-1 font-mono text-[11px] text-rose-200/80 py-1 leading-relaxed">
                          {result.critiqueText ? (
                            <pre className="whitespace-pre-wrap">{result.critiqueText}</pre>
                          ) : (
                            <span className="text-gray-500 italic font-sans text-xs">Critique and self-correction loop was disabled for this run.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SEARCH SOURCES IF APPLICABLE */}
                    {result.searchSources && result.searchSources.length > 0 && (
                      <div className="bg-[#080a13] border border-gray-800 rounded-2xl p-5">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono mb-3 block">
                          Grounded Knowledge Sources ({result.searchSources.length})
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {result.searchSources.map((source, idx) => (
                            <a 
                              key={idx} 
                              href={source.uri} 
                              target="_blank" 
                              rel="noreferrer referrer" 
                              className="p-3 bg-[#0c101c]/60 hover:bg-[#0c101c] border border-emerald-950/40 hover:border-emerald-500/40 rounded-xl flex items-center justify-between text-xs transition-all duration-150 text-gray-300"
                            >
                              <span className="truncate pr-4">{source.title || source.uri}</span>
                              <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* PIPELINE TOKEN DISTRIBUTION BAR CHART */}
                    <div className="bg-[#080a13] border border-gray-800 rounded-2xl p-5 flex flex-col" id="token_inspection_chart">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono mb-3 flex items-center justify-between border-b border-gray-800 pb-2">
                        <span className="flex items-center gap-1.5 text-indigo-400">
                          <Cpu className="w-3.5 h-3.5" /> Pipeline Token Distribution (Last 5 Runs)
                        </span>
                        {history.length > 0 ? (
                          <span className="text-emerald-400 text-[10px] bg-emerald-950/20 px-2 py-0.5 rounded-full border border-emerald-900/40 font-mono">
                            Live Reactor History
                          </span>
                        ) : (
                          <span className="text-amber-400 text-[10px] bg-amber-950/20 px-2 py-0.5 rounded-full border border-amber-900/40 font-mono">
                            Demo Baseline Profile
                          </span>
                        )}
                      </span>
                      <p className="text-xs text-gray-400 mb-5 leading-normal">
                        Reactor requests utilize nested validation steps, which automatically swell standard input prompts with extensive planning matrices and iterative critiques.
                      </p>
                      
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.4} />
                            <XAxis 
                              dataKey="name" 
                              stroke="#9ca3af" 
                              fontSize={10}
                              tickLine={false}
                            />
                            <YAxis 
                              stroke="#9ca3af" 
                              fontSize={10}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "#0c0f1d", 
                                borderColor: "#1f2937", 
                                borderRadius: "0.75rem",
                                color: "#f3f4f6",
                                fontSize: "11px",
                                fontFamily: "var(--font-mono)"
                              }} 
                              cursor={{ fill: "rgba(99, 102, 241, 0.05)" }}
                            />
                            <Legend 
                              verticalAlign="bottom" 
                              height={32}
                              iconType="circle"
                              fontSize={11}
                              wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                            />
                            <Bar name="Input Tokens" dataKey="Input Tokens" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
                            <Bar name="Output Tokens" dataKey="Output Tokens" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* INITIAL STATE EMPTY PANEL CASE */}
          {!result && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-800 rounded-3xl min-h-[350px]">
              <div className="bg-indigo-950/30 p-4 rounded-full text-indigo-400 mb-4 border border-indigo-900/50">
                <Brain className="w-10 h-10 animate-pulse" />
              </div>
              <h3 className="font-display font-medium text-lg text-gray-200">Ready to Ignite the Reaction</h3>
              <p className="text-gray-500 text-xs max-w-md mt-2">
                Configure your pipeline modules on the left, select any of the benchmarking blueprints to see specialized logic processing, and ignite the task reactor.
              </p>
              
              {/* Educational quick comparative row */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-2xl w-full">
                <div className="bg-[#0b0d18]/40 border border-gray-900 p-3.5 rounded-xl">
                  <div className="text-xs font-semibold text-cyan-400 mb-1">1. Pre-think Analysis</div>
                  <div className="text-[10px] text-gray-400 leading-normal">
                    Decomposes math and text challenges into intermediate logical reasoning layers inside dedicated tags before answering.
                  </div>
                </div>
                <div className="bg-[#0b0d18]/40 border border-gray-900 p-3.5 rounded-xl">
                  <div className="text-xs font-semibold text-rose-400 mb-1">2. Critic Checkups</div>
                  <div className="text-[10px] text-gray-400 leading-normal">
                    Subjects draft output to an adversarial feedback loop, automatically self-correcting constraints and compliance.
                  </div>
                </div>
                <div className="bg-[#0b0d18]/40 border border-gray-900 p-3.5 rounded-xl">
                  <div className="text-xs font-semibold text-emerald-400 mb-1">3. Live Grounding</div>
                  <div className="text-[10px] text-gray-400 leading-normal">
                    Injects live web indexes directly into the context window to fetch real-time market data, ticker quotes, and citations.
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl w-full mx-auto text-center border-t border-gray-900 pt-6 mt-8 text-gray-600 text-xs font-mono">
        <p>Built with ❤️ inside Google AI Studio Applet Developer Container | Powered by GenAI SDK @google/genai</p>
      </footer>
    </div>
  );
}

