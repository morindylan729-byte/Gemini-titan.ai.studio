import { BenchmarkCase } from "./types";

export const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: "strawberry",
    category: "Character & Tokenization",
    title: "The 'Strawberry' Counting Test",
    description: "Standard LLMs (like ChatGPT) use subword tokenization, preventing them from 'seeing' individual characters. They often fail when asked how many times a character appears, e.g., stating there are only 2 'r's in strawberry.",
    originalPrompt: "How many times does the letter 'r' appear in the word 'strawberry'? Please analyze step-by-step and show exact indices.",
    whyChatGPTFails: "ChatGPT frequently fails on character-level counting tasks because it processes words as tokens rather than individual letter characters.",
    recommendedConfig: {
      useCoT: true,
      useCritique: true,
      useSearch: false,
      persona: "logical-solver",
      temperature: 0.2
    }
  },
  {
    id: "acrostic",
    category: "Complex Constraints",
    title: "Acrostic Neural Poem with Rules",
    description: "Writing an acrostic poem with exact line counts and word counts is extremely difficult for single-turn models. It requires keeping track of negative constraints and exact formatting simultaneously.",
    originalPrompt: "Write an acrostic poem where the first letter in each line spells 'GEMINI' vertically. The poem must be exactly 6 lines long, and each line must be exactly 8 words long, about the magic of neural weights. Double check your count and ensure compliance.",
    whyChatGPTFails: "ChatGPT routinely fails to satisfy simultaneous layered constraints (e.g., both capitalizing first letters AND keeping exactly 8 words per line).",
    recommendedConfig: {
      useCoT: true,
      useCritique: true,
      useSearch: false,
      persona: "creative-writer",
      temperature: 0.6
    }
  },
  {
    id: "riddle",
    category: "Deep Logic Deduction",
    title: "The Unstated Second-Player Riddle",
    description: "Standard question-answering often glosses over spatial and social constraints, providing generic answers because of lack of step-by-step reasoning verification.",
    originalPrompt: "In a physical room there are exactly 5 people. Alice is reading a science-fiction novel. Bob is playing chess on a board. Charlie is cooking pasta. David is writing a personal diary. What is the fifth person doing in the room?",
    whyChatGPTFails: "A fast, single-turn LLM response might output a random guess or claim we lack information, failing to deduce that chess requires two players, meaning the 5th person is playing with Bob.",
    recommendedConfig: {
      useCoT: true,
      useCritique: true,
      useSearch: false,
      persona: "logical-solver",
      temperature: 0.1
    }
  },
  {
    id: "realtime",
    category: "Real-time Knowledge",
    title: "Yesterday's Tech Milestones",
    description: "Standard LLMs are locked behind training cutoffs or basic web integrations. Google Search Grounding lets Gemini consult the latest web sources, pulling live links and exact citations instantly.",
    originalPrompt: "What was the closing stock price of Alphabet / Google yesterday, and what major AI project had an update in the news within the past 48 hours? Give sources.",
    whyChatGPTFails: "ChatGPT limits real-time search behind paid tiers, and standard models fail with 'I cannot browse the live web beyond my knowledge cutoff'.",
    recommendedConfig: {
      useCoT: false,
      useCritique: false,
      useSearch: true,
      persona: "academic",
      temperature: 0.3
    }
  }
];
