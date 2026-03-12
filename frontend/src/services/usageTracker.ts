// Local API usage tracking service
// Tracks API calls made by the app to help users monitor their usage

const USAGE_STORAGE_KEY = 'api_usage_stats';

export interface UsageRecord {
  timestamp: string;
  endpoint: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  success: boolean;
}

export interface UsageStats {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  callsByEndpoint: Record<string, number>;
  todayCalls: number;
  todayInputTokens: number;
  todayOutputTokens: number;
  records: UsageRecord[];
  lastReset: string;
}

const DEFAULT_STATS: UsageStats = {
  totalCalls: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  callsByEndpoint: {},
  todayCalls: 0,
  todayInputTokens: 0,
  todayOutputTokens: 0,
  records: [],
  lastReset: new Date().toISOString(),
};

// Rough token estimates for different operations (input, output)
const TOKEN_ESTIMATES: Record<string, { input: number; output: number }> = {
  'parse-resume': { input: 3000, output: 1500 },   // Resume text + prompt -> structured JSON
  'tailor-resume': { input: 4000, output: 2000 },  // Resume + job desc -> tailored content
  'chat': { input: 2000, output: 500 },            // Context + message -> response
  'health': { input: 5, output: 5 },               // Minimal health check
};

// Pricing per 1M tokens (as of 2026)
// Source: https://ai.google.dev/gemini-api/docs/pricing
export const PRICING = {
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    inputPer1M: 0.15,
    outputPer1M: 0.60,
  },
  'gemini-2.0-flash': {
    name: 'Gemini 2.0 Flash',
    inputPer1M: 0.10,
    outputPer1M: 0.40,
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    inputPer1M: 0.15,
    outputPer1M: 0.60,
  },
  'gpt-4o': {
    name: 'GPT-4o',
    inputPer1M: 2.50,
    outputPer1M: 10.00,
  },
} as const;

export type PricingModel = keyof typeof PRICING;

function getStats(): UsageStats {
  try {
    const stored = localStorage.getItem(USAGE_STORAGE_KEY);
    if (stored) {
      const stats = JSON.parse(stored) as UsageStats;
      // Migrate old format if needed
      if ('totalTokensEstimate' in stats) {
        const oldStats = stats as UsageStats & { totalTokensEstimate?: number; todayTokens?: number };
        stats.totalInputTokens = oldStats.totalTokensEstimate || 0;
        stats.totalOutputTokens = Math.round((oldStats.totalTokensEstimate || 0) * 0.4);
        stats.todayInputTokens = oldStats.todayTokens || 0;
        stats.todayOutputTokens = Math.round((oldStats.todayTokens || 0) * 0.4);
      }
      // Reset daily counters if it's a new day
      const lastResetDate = new Date(stats.lastReset).toDateString();
      const today = new Date().toDateString();
      if (lastResetDate !== today) {
        stats.todayCalls = 0;
        stats.todayInputTokens = 0;
        stats.todayOutputTokens = 0;
        stats.lastReset = new Date().toISOString();
      }
      return stats;
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_STATS };
}

function saveStats(stats: UsageStats): void {
  try {
    // Keep only last 100 records to avoid localStorage bloat
    if (stats.records.length > 100) {
      stats.records = stats.records.slice(-100);
    }
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Calculate cost for given token counts
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: PricingModel = 'gemini-2.5-flash'
): number {
  const pricing = PRICING[model];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return inputCost + outputCost;
}

/**
 * Format cost as currency string
 */
function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}

export const usageTracker = {
  /**
   * Record an API call
   */
  trackCall(endpoint: string, success: boolean = true): void {
    const stats = getStats();
    const estimates = TOKEN_ESTIMATES[endpoint] || { input: 500, output: 200 };

    const record: UsageRecord = {
      timestamp: new Date().toISOString(),
      endpoint,
      estimatedInputTokens: estimates.input,
      estimatedOutputTokens: estimates.output,
      success,
    };

    stats.totalCalls++;
    stats.totalInputTokens += estimates.input;
    stats.totalOutputTokens += estimates.output;
    stats.todayCalls++;
    stats.todayInputTokens += estimates.input;
    stats.todayOutputTokens += estimates.output;
    stats.callsByEndpoint[endpoint] = (stats.callsByEndpoint[endpoint] || 0) + 1;
    stats.records.push(record);

    saveStats(stats);
  },

  /**
   * Get current usage statistics
   */
  getStats(): UsageStats {
    return getStats();
  },

  /**
   * Reset all usage statistics
   */
  resetStats(): void {
    localStorage.removeItem(USAGE_STORAGE_KEY);
  },

  /**
   * Get a formatted summary for display
   */
  getSummary(model: PricingModel = 'gemini-2.5-flash'): {
    today: { calls: number; tokens: string; cost: string };
    total: { calls: number; tokens: string; cost: string };
    byEndpoint: { name: string; calls: number }[];
    costByModel: { model: string; name: string; todayCost: string; totalCost: string }[];
  } {
    const stats = getStats();

    const formatTokens = (input: number, output: number): string => {
      const total = input + output;
      if (total >= 1000000) {
        return `${(total / 1000000).toFixed(1)}M`;
      }
      if (total >= 1000) {
        return `${(total / 1000).toFixed(1)}K`;
      }
      return total.toString();
    };

    const todayCost = calculateCost(stats.todayInputTokens, stats.todayOutputTokens, model);
    const totalCost = calculateCost(stats.totalInputTokens, stats.totalOutputTokens, model);

    // Calculate costs for all models for comparison
    const costByModel = (Object.keys(PRICING) as PricingModel[]).map((modelKey) => ({
      model: modelKey,
      name: PRICING[modelKey].name,
      todayCost: formatCost(calculateCost(stats.todayInputTokens, stats.todayOutputTokens, modelKey)),
      totalCost: formatCost(calculateCost(stats.totalInputTokens, stats.totalOutputTokens, modelKey)),
    }));

    return {
      today: {
        calls: stats.todayCalls,
        tokens: formatTokens(stats.todayInputTokens, stats.todayOutputTokens),
        cost: formatCost(todayCost),
      },
      total: {
        calls: stats.totalCalls,
        tokens: formatTokens(stats.totalInputTokens, stats.totalOutputTokens),
        cost: formatCost(totalCost),
      },
      byEndpoint: Object.entries(stats.callsByEndpoint)
        .map(([name, calls]) => ({ name, calls }))
        .sort((a, b) => b.calls - a.calls),
      costByModel,
    };
  },
};
