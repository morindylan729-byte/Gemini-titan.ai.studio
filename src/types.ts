export interface PipelineConfig {
  useCoT: boolean;       // Chain of thought decomposition
  useCritique: boolean;  // Self-criticism and refinement loop
  useSearch: boolean;    // Live Google Search grounding
  persona: string;       // Dynamic personas support (default | academic | code-architect | creative-writer | logical-solver | network-admin | custom-*)
  customInstruction?: string; // Overrides persona instructions on the server side
  temperature: number;
}

export interface PipelineStep {
  name: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  message: string;
  duration?: number;
  output?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface GenerationResult {
  originalPrompt: string;
  enhancedPrompt: string;
  standardResponse: string;
  streamedResponses?: string[];
  superchargedResponse: string;
  critiqueText?: string;
  cotText?: string;
  searchSources?: Array<{ title: string; uri: string }>;
  steps: PipelineStep[];
  totalTime: number;
  usage?: TokenUsage;
  config?: PipelineConfig;
}

export interface BenchmarkCase {
  id: string;
  category: string;
  title: string;
  description: string;
  originalPrompt: string;
  whyChatGPTFails: string;
  recommendedConfig: PipelineConfig;
}
