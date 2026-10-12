import { OpenRouterModel, OpenRouterTier, OpenRouterFuelPool } from '../types';
import { SOL_USD_RATE } from './bondingCurve';

export const OPENROUTER_MODELS: OpenRouterModel[] = [
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    description: 'Hybrid reasoning and leading code synthesis model. Excels at complex interactive sandboxes.',
    contextLength: 200000,
    costPer1mPromptTokensUsd: 3.0,
    costPer1mCompletionTokensUsd: 15.0,
    badge: 'Popular',
    speed: 'Fast',
    category: 'Coding',
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    description: 'High-power open reasoning weights. Solves mathematical, algorithmic, and WebAssembly logic.',
    contextLength: 64000,
    costPer1mPromptTokensUsd: 0.55,
    costPer1mCompletionTokensUsd: 2.19,
    badge: 'Heavy Reasoning',
    speed: 'Deep Reasoning',
    category: 'Reasoning',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o Omnichannel',
    provider: 'OpenAI',
    description: 'Flagship versatile multimodal engine with instant tool calling and UI formatting.',
    contextLength: 128000,
    costPer1mPromptTokensUsd: 2.5,
    costPer1mCompletionTokensUsd: 10.0,
    badge: 'Multimodal',
    speed: 'Ultra Fast',
    category: 'General',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'Meta',
    description: 'Ultra-fast open weights with high instruction adherence and low token cost.',
    contextLength: 128000,
    costPer1mPromptTokensUsd: 0.12,
    costPer1mCompletionTokensUsd: 0.30,
    badge: 'Ultra Cheap',
    speed: 'Ultra Fast',
    category: 'General',
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'Qwen',
    description: 'Specialized code generation engine trained on over 5.5T code tokens.',
    contextLength: 128000,
    costPer1mPromptTokensUsd: 0.20,
    costPer1mCompletionTokensUsd: 0.60,
    badge: 'Code Specialist',
    speed: 'Fast',
    category: 'Coding',
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    description: 'Next-gen sub-second latency with 1M tokens context and built-in multimodal understanding.',
    contextLength: 1000000,
    costPer1mPromptTokensUsd: 0.10,
    costPer1mCompletionTokensUsd: 0.40,
    badge: 'Sub-Second',
    speed: 'Ultra Fast',
    category: 'General',
  },
];

export const OPENROUTER_FUEL_TIERS: OpenRouterTier[] = [
  {
    id: 'tier-spark',
    title: '⚡ Chispa de Inicio',
    subtitle: 'Fuel rápido para 1 iteración o hotfix en vivo',
    tokens: 250_000,
    costUsd: 2.50,
    costSol: +(2.50 / SOL_USD_RATE).toFixed(3), // ~0.015 SOL
    icon: '⚡',
    promptEquivalent: '~10 iteraciones básicas de código',
  },
  {
    id: 'tier-reasoning',
    title: '🚀 DeepSeek R1 Boost',
    subtitle: 'Para cadenas de pensamiento profundas y lógica pesada',
    tokens: 1_000_000,
    costUsd: 8.00,
    costSol: +(8.00 / SOL_USD_RATE).toFixed(3), // ~0.048 SOL
    icon: '🧠',
    badge: 'Alta Potencia',
    promptEquivalent: '~35 prompts con razonamiento completo',
  },
  {
    id: 'tier-vibe-master',
    title: '🔥 Claude 3.7 Vibe Master',
    subtitle: 'El pack favorito de la comunidad para sesiones completas de vibe coding',
    tokens: 3_000_000,
    costUsd: 22.00,
    costSol: +(22.00 / SOL_USD_RATE).toFixed(3), // ~0.133 SOL
    icon: '🔥',
    popular: true,
    badge: 'Más Popular',
    promptEquivalent: '~100 sandboxes y ejecuciones en vivo',
  },
  {
    id: 'tier-titan-whale',
    title: '👑 Titán Patrocinador',
    subtitle: 'Financia una maratón de desarrollo en vivo. Insignia dorada en el chat',
    tokens: 10_000_000,
    costUsd: 70.00,
    costSol: +(70.00 / SOL_USD_RATE).toFixed(3), // ~0.424 SOL
    icon: '👑',
    badge: 'Mecenas VIP',
    promptEquivalent: '~350 sandboxes + Alerta visual en stream',
  },
];

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return tokens.toLocaleString();
}

export function getOpenRouterModel(id: string): OpenRouterModel {
  return (
    OPENROUTER_MODELS.find((m) => m.id === id) ||
    OPENROUTER_MODELS[0]
  );
}

export function createDefaultFuelPool(initialTokens: number = 2_500_000): OpenRouterFuelPool {
  const credits = +(initialTokens * 0.00001).toFixed(2);
  return {
    totalTokensRemaining: initialTokens,
    totalTokensSponsored: initialTokens,
    creditsUsd: credits,
    activeModel: 'anthropic/claude-3.7-sonnet',
    apiKeyConfigured: true,
    apiKeyMasked: 'sk-or-v1-••••••••••••••••3a9b',
    sponsorsCount: 12,
    totalPromptsExecuted: 28,
  };
}
