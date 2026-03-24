"use client";

import React, { useMemo, lazy, Suspense } from "react";
import { useMarketPerformance } from "@/hooks/useMarketPerformance";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import AccuracyMetrics from "@/components/Performance/AccuracyMetrics";
import ROIMetrics from "@/components/Performance/ROIMetrics";
import { AlertTriangle, BarChart2 } from "lucide-react";
import { logError, logWarning } from "@/utils/errorLogging";

// Lazy load heavy chart components for better performance
// Requirements: 11.4 - Cache performance calculations to avoid redundant computation
const PriceChartWithMarkers = lazy(() => import("@/components/Performance/PriceChartWithMarkers"));
const CalibrationAnalysis = lazy(() => import("@/components/Performance/CalibrationAnalysis"));

interface PerformanceTabProps {
  marketId: string; // Polymarket condition_id (used for API queries)
  conditionId: string;
  resolvedOutcome: string;
  resolutionDate: string;
}

/**
 * PerformanceTab - Container component for market performance analysis
 * 
 * This component coordinates all performance analysis child components and manages
 * data fetching for closed markets with AI recommendations. It displays:
 * - Investment simulation with P/L calculations
 * - Accuracy metrics and confidence analysis
 * - Price charts with entry/exit markers
 * - Recommendation timeline
 * - Risk-adjusted metrics
 * - Calibration analysis
 * - Baseline strategy comparisons
 * 
 * @param marketId - The Polymarket condition_id to fetch performance data for
 * @param conditionId - The Polymarket condition ID (same as marketId, kept for compatibility)
 * @param resolvedOutcome - The final market resolution (YES/NO)
 * @param resolutionDate - ISO timestamp of market resolution
 * 
 * Requirements: 3.1, 3.2, 15.4
 */
export default function PerformanceTab({
  marketId,
  conditionId,
  resolvedOutcome,
  resolutionDate,
}: PerformanceTabProps) {
  const { data, isLoading, error, refetch } = useMarketPerformance(marketId);

  // Data validation warning - memoized to avoid recalculation
  // MUST be called before any conditional returns (Rules of Hooks)
  const hasIncompleteData = useMemo(() => {
    return data?.recommendations?.some(
      (rec) => !rec.entryPrice || rec.entryPrice === 0
    ) ?? false;
  }, [data?.recommendations]);

  // Log errors for debugging
  React.useEffect(() => {
    if (error) {
      logError(error, {
        component: "PerformanceTab",
        action: "fetchMarketPerformance",
        marketId,
        conditionId,
      });
    }
  }, [error, marketId, conditionId]);

  // Log warning for incomplete data
  React.useEffect(() => {
    if (hasIncompleteData && data?.recommendations) {
      const incompleteCount = data.recommendations.filter(
        (rec) => !rec.entryPrice || rec.entryPrice === 0
      ).length;
      
      logWarning("Incomplete price data detected in recommendations", {
        component: "PerformanceTab",
        marketId,
        incompleteCount,
      });
    }
  }, [hasIncompleteData, data?.recommendations, marketId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="py-12">
        <LoadingState message="Loading performance data..." />
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div className="py-8">
        <div className="max-w-2xl mx-auto">
          <ErrorState 
            error={error} 
            title="Failed to load performance data" 
            onRetry={refetch}
          />
        </div>
      </div>
    );
  }

  // Empty state - no recommendations
  if (!data || !data.recommendations || data.recommendations.length === 0) {
    return (
      <div className="py-12">
        <EmptyState
          icon={BarChart2}
          title="No AI Analysis Available"
          message="This market did not receive AI recommendations during its active period. The AI system may not have had sufficient data or confidence to generate predictions for this market."
          action={{
            label: "View All Markets",
            onClick: () => window.location.href = "/history"
          }}
        />
      </div>
    );
  }

  return (
    <ErrorBoundary resetKeys={[marketId]}>
      <div className="space-y-8 py-6">
      {/* Data Quality Warning */}
      {hasIncompleteData && (
        <div className="p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Incomplete Data</span>
          </div>
          <p className="text-sm text-gray-400">
            Some recommendations have incomplete price data. Performance metrics
            may be limited for these entries.
          </p>
        </div>
      )}

      {/* Market Summary */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Market Resolution
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Outcome</div>
            <div className="text-xl font-bold text-white">{resolvedOutcome}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Resolution Date</div>
            <div className="text-xl font-bold text-white">
              {new Date(resolutionDate).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Total Recommendations</div>
            <div className="text-xl font-bold text-white">
              {data.recommendations.length}
            </div>
          </div>
        </div>
      </div>

      {/* ROI Metrics */}
      <ROIMetrics
        totalROI={data.metrics.roi.total}
        averageROI={data.metrics.roi.average}
        bestROI={data.metrics.roi.best}
        worstROI={data.metrics.roi.worst}
        byRecommendation={data.metrics.roi.byRecommendation}
      />

      {/* Accuracy Metrics */}
      <AccuracyMetrics recommendations={data.recommendations} />

      {/* Confidence Breakdown */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Performance by Confidence Level
        </h3>
        <div className="space-y-3">
          {Object.entries(data.metrics.accuracy.byConfidence).map(
            ([level, stats]) => {
              if (stats.total === 0) return null;
              
              return (
                <div
                  key={level}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                        level === "high"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : level === "moderate"
                          ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                          : "bg-red-500/10 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {level[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white font-semibold capitalize">
                        {level} Confidence
                      </div>
                      <div className="text-sm text-gray-400">
                        {stats.correct} of {stats.total} correct
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">
                      {stats.percentage.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">Accuracy</div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Recommendations List */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Recommendation History
        </h3>
        <div className="space-y-3">
          {data.recommendations.map((rec, index) => (
            <div
              key={rec.id}
              className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-mono text-gray-500">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          rec.direction === "LONG_YES"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : rec.direction === "LONG_NO"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {rec.direction}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                          rec.confidence === "high"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : rec.confidence === "moderate"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {rec.confidence}
                      </span>
                      {rec.wasCorrect ? (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                          ✓ Target Hit
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400">
                          ✗ Stop Hit
                        </span>
                      )}
                      {rec.gradedByPriceHistory && (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-indigo-500/20 text-indigo-400">
                          ⚡ Intraday
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Opened: {new Date(rec.createdAt).toLocaleString()}
                      {rec.exitTimestamp && (
                        <span className="ml-2 text-gray-600">
                          · Closed: {new Date(rec.exitTimestamp).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-lg font-bold ${
                      (rec.roiRealized ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {(rec.roiRealized ?? 0) >= 0 ? "+" : ""}
                    {rec.roiRealized != null ? rec.roiRealized.toFixed(2) : "0.00"}%
                  </div>
                  <div className="text-xs text-gray-500">ROI</div>
                </div>
              </div>
              <div className="text-sm text-gray-400 mt-2">
                {rec.explanation}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3 pt-3 border-t border-white/10">
                <div>
                  <div className="text-xs text-gray-500">Entry Zone</div>
                  <div className="text-sm text-white font-mono">
                    {rec.entryZoneMin != null && rec.entryZoneMax != null
                      ? `${rec.entryZoneMin.toFixed(2)} – ${rec.entryZoneMax.toFixed(2)}`
                      : "N/A"}
                  </div>
                </div>
                {rec.direction !== "NO_TRADE" && (
                  <>
                    <div>
                      <div className="text-xs text-emerald-500">Target Zone</div>
                      <div className="text-sm text-emerald-400 font-mono">
                        {rec.targetZoneMin != null && rec.targetZoneMax != null
                          ? `${rec.targetZoneMin.toFixed(2)} – ${rec.targetZoneMax.toFixed(2)}`
                          : "N/A"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-red-500">Stop Loss</div>
                      <div className="text-sm text-red-400 font-mono">
                        {rec.stopLoss != null ? rec.stopLoss.toFixed(2) : "N/A"}
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <div className="text-xs text-gray-500">Market Price</div>
                  <div className="text-sm text-white font-mono">
                    {rec.marketPriceAtRecommendation != null
                      ? rec.marketPriceAtRecommendation.toFixed(2)
                      : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Fair Probability</div>
                  <div className="text-sm text-white font-mono">
                    {rec.fairProbability != null
                      ? `${(rec.fairProbability * 100).toFixed(1)}%`
                      : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Market Edge</div>
                  <div className="text-sm text-white font-mono">
                    {rec.marketEdge != null
                      ? `${(rec.marketEdge * 100).toFixed(1)}%`
                      : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Signals */}
      {data.agentSignals && data.agentSignals.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Agent Signals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.agentSignals.map((signal, index) => (
              <div
                key={index}
                className="p-3 bg-white/5 rounded-lg border border-white/10"
              >
                <div className="text-sm font-semibold text-white mb-1">
                  {signal.agent_name}
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      signal.direction === "LONG_YES"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {signal.direction}
                  </span>
                  <span className="text-xs text-gray-400">
                    {signal.agent_probability != null
                      ? `${(signal.agent_probability * 100).toFixed(1)}%`
                      : "N/A"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Placeholder for future child components */}
      <div className="space-y-8">
        {/* Price Chart with Entry/Exit Markers - Lazy Loaded */}
        {data.priceHistory && data.priceHistory.length > 0 && (
          <Suspense
            fallback={
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-white/10 rounded w-1/4"></div>
                  <div className="h-64 bg-white/10 rounded"></div>
                </div>
              </div>
            }
          >
            <PriceChartWithMarkers
              priceHistory={data.priceHistory}
              recommendations={data.recommendations}
              highlightedPeriod={undefined}
            />
          </Suspense>
        )}

        {/* Calibration Analysis - Lazy Loaded */}
        <Suspense
          fallback={
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-white/10 rounded w-1/3"></div>
                <div className="h-80 bg-white/10 rounded"></div>
              </div>
            </div>
          }
        >
          <CalibrationAnalysis recommendations={data.recommendations} />
        </Suspense>
      </div>
    </div>
    </ErrorBoundary>
  );
}
