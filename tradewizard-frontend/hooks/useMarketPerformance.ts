import { useQuery } from "@tanstack/react-query";

export interface RecommendationWithOutcome {
  id: string;
  marketId: string;
  direction: "LONG_YES" | "LONG_NO" | "NO_TRADE";
  confidence: "high" | "moderate" | "low";
  fairProbability: number;
  marketEdge: number;
  expectedValue: number;
  entryZoneMin: number;
  entryZoneMax: number;
  targetZoneMin?: number | null;
  targetZoneMax?: number | null;
  stopLoss?: number | null;
  explanation: string;
  createdAt: string;
  actualOutcome: string;
  wasCorrect: boolean;
  roiRealized: number;
  edgeCaptured: number;
  marketPriceAtRecommendation: number;
  resolutionDate: string;
  entryPrice: number;
  exitPrice?: number;
  exitTimestamp?: string | null;
  gradedByPriceHistory?: boolean;
}

export interface MarketInfo {
  id: string;
  conditionId: string;
  question: string;
  description: string;
  eventType: string;
  resolvedOutcome: string;
  resolutionDate: string;
  slug: string;
}

export interface AgentSignal {
  agent_name: string;
  direction: string;
  agent_probability: number;
  agent_confidence: number;
}

export interface AccuracyMetrics {
  total: number;
  correct: number;
  percentage: number;
  byConfidence: {
    high: { total: number; correct: number; percentage: number };
    moderate: { total: number; correct: number; percentage: number };
    low: { total: number; correct: number; percentage: number };
  };
}

export interface ROIMetrics {
  total: number;
  average: number;
  best: number;
  worst: number;
  byRecommendation: Array<{ id: string; roi: number }>;
}

export interface PerformanceMetrics {
  accuracy: AccuracyMetrics;
  roi: ROIMetrics;
}

export interface MarketPerformanceDetailResponse {
  market: MarketInfo;
  recommendations: RecommendationWithOutcome[];
  metrics: PerformanceMetrics;
  agentSignals: AgentSignal[];
  priceHistory?: Array<{ timestamp: string; price: number }>;
}

export interface UseMarketPerformanceOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch detailed performance data for a single market
 * 
 * @param marketId - The market ID to fetch performance data for
 * @param options - Optional configuration
 * @returns TanStack Query result with market performance data
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error } = useMarketPerformance('market-123');
 * 
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 * 
 * return (
 *   <div>
 *     <h1>{data.market.question}</h1>
 *     <p>Accuracy: {data.metrics.accuracy.percentage}%</p>
 *   </div>
 * );
 * ```
 */
export function useMarketPerformance(
  marketId: string | null,
  options: UseMarketPerformanceOptions = {}
) {
  const { enabled = true } = options;

  return useQuery<MarketPerformanceDetailResponse>({
    queryKey: ["market-performance", marketId],
    queryFn: async () => {
      if (!marketId) {
        throw new Error("Market ID is required");
      }

      const response = await fetch(
        `/api/tradewizard/performance/${marketId}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to fetch market performance: ${response.status}`
        );
      }

      return response.json();
    },
    enabled: enabled && !!marketId,
    staleTime: 10 * 60 * 1000, // 10 minutes (closed markets don't change)
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
    refetchOnWindowFocus: false, // Closed markets are static
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
