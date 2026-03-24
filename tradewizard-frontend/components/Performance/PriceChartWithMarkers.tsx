"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceArea,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import Card from "@/components/shared/Card";
import EmptyState from "@/components/shared/EmptyState";
import WarningBanner from "@/components/shared/WarningBanner";
import { RecommendationWithOutcome } from "@/hooks/useMarketPerformance";
import { PriceHistoryPoint } from "@/hooks/usePriceHistory";
import { downsamplePriceData, getOptimalMaxPoints } from "@/utils/chartDataDownsampling";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { validatePriceHistory } from "@/lib/data-validation";
import { logWarning } from "@/utils/errorLogging";

interface PriceChartWithMarkersProps {
  priceHistory: PriceHistoryPoint[];
  recommendations: RecommendationWithOutcome[];
  highlightedPeriod?: { start: string; end: string };
  className?: string;
}

interface ChartDataPoint {
  timestamp: number;
  price: number;
  formattedDate: string;
}

interface MarkerData {
  id: string;
  timestamp: number;
  price: number;
  type: "entry" | "exit";
  isProfitable: boolean;
  recommendation: RecommendationWithOutcome;
}

/**
 * PriceChartWithMarkers Component
 * 
 * Displays a price chart with entry/exit markers overlaid on the price line.
 * Markers are color-coded based on profitability and show tooltips on hover.
 * Optimized for mobile with reduced data points and touch-friendly interactions.
 * 
 * Requirements: 6.2, 6.3, 6.4, 6.5, 14.3, 11.4
 * 
 * @param priceHistory - Historical price data points
 * @param recommendations - AI recommendations with entry/exit data
 * @param highlightedPeriod - Optional period to highlight on the chart
 */
export default function PriceChartWithMarkers({
  priceHistory,
  recommendations,
  highlightedPeriod,
  className = "",
}: PriceChartWithMarkersProps) {
  // Detect mobile device for responsive optimizations
  const isMobile = useIsMobile();
  
  // Validate price history
  const priceHistoryValidation = useMemo(() => {
    const validation = validatePriceHistory(priceHistory);
    if (!validation.isValid) {
      logWarning("Incomplete price history detected", {
        component: "PriceChartWithMarkers",
        reason: validation.reason,
        dataPoints: priceHistory?.length || 0,
      });
    }
    return validation;
  }, [priceHistory]);
  
  // Downsample price data for performance (100 points mobile, 200 desktop)
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!priceHistoryValidation.isValid) return [];
    const maxPoints = getOptimalMaxPoints(isMobile);
    return downsamplePriceData(priceHistory, maxPoints);
  }, [priceHistory, isMobile, priceHistoryValidation.isValid]);

  // Prepare marker data for entry and exit points
  const markers = useMemo<MarkerData[]>(() => {
    if (!recommendations || recommendations.length === 0) return [];

    const markerList: MarkerData[] = [];

    recommendations.forEach((rec) => {
      // Skip NO_TRADE recommendations
      if (rec.direction === "NO_TRADE") return;

      // Calculate profitability
      const exitPrice = rec.exitPrice ?? (rec.actualOutcome === "YES" ? 1 : 0);
      const isProfitable = exitPrice > rec.entryPrice;

      // Add entry marker
      markerList.push({
        id: `${rec.id}-entry`,
        timestamp: new Date(rec.createdAt).getTime(),
        price: rec.entryPrice,
        type: "entry",
        isProfitable,
        recommendation: rec,
      });

      // Add exit marker if exit price exists
      if (rec.exitPrice !== undefined && rec.exitPrice !== null) {
        markerList.push({
          id: `${rec.id}-exit`,
          timestamp: new Date(rec.resolutionDate).getTime(),
          price: rec.exitPrice,
          type: "exit",
          isProfitable,
          recommendation: rec,
        });
      }
    });

    return markerList;
  }, [recommendations]);

  // Calculate highlighted area bounds
  const highlightedArea = useMemo(() => {
    if (!highlightedPeriod) return null;

    const startTime = new Date(highlightedPeriod.start).getTime();
    const endTime = new Date(highlightedPeriod.end).getTime();

    return { startTime, endTime };
  }, [highlightedPeriod]);

  // Handle incomplete data
  if (!priceHistoryValidation.isValid) {
    const details: string[] = [];
    
    if (!priceHistoryValidation.hasMinimumPoints) {
      details.push("Insufficient price data points for chart rendering");
    }
    
    if (priceHistoryValidation.hasGaps) {
      details.push(`${priceHistoryValidation.gapCount} gap(s) detected in price history`);
    }
    
    details.push("Some performance metrics may be unavailable");
    
    return (
      <Card className={`p-6 ${className}`}>
        <WarningBanner
          type="warning"
          title="Incomplete Price Data"
          message={priceHistoryValidation.reason || "Historical price data is incomplete for this market."}
          details={details}
        />
      </Card>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Card className={`p-6 ${className}`}>
        <EmptyState
          icon={TrendingUp}
          title="No Recommendations Available"
          message="This market has no AI recommendations to display on the chart. Price charts with entry/exit markers will appear once recommendations are generated."
        />
      </Card>
    );
  }

  // Calculate price range for Y-axis
  const prices = chartData.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const yAxisMin = Math.max(0, minPrice - priceRange * 0.1);
  const yAxisMax = Math.min(1, maxPrice + priceRange * 0.1);

  return (
    <Card className={`p-6 ${className}`}>
      <div className="mb-4">
        <h4 className="text-lg font-bold text-white mb-1">
          Price Chart with Entry/Exit Points
        </h4>
        <p className="text-sm text-gray-400">
          Historical market price with AI recommendation markers
        </p>
      </div>

      {/* Legend - Responsive: wrap on mobile, inline on desktop */}
      <div className="mb-4 flex flex-wrap items-center gap-3 sm:gap-4 text-xs" role="list" aria-label="Chart legend">
        <div className="flex items-center gap-2" role="listitem">
          <div className="w-3 h-3 rounded-full bg-emerald-500" aria-hidden="true"></div>
          <span className="text-gray-400">Profitable</span>
        </div>
        <div className="flex items-center gap-2" role="listitem">
          <div className="w-3 h-3 rounded-full bg-red-500" aria-hidden="true"></div>
          <span className="text-gray-400">Unprofitable</span>
        </div>
        <div className="flex items-center gap-2" role="listitem">
          <TrendingUp className="w-3 h-3 text-blue-400" aria-hidden="true" />
          <span className="text-gray-400">Entry Point</span>
        </div>
        <div className="flex items-center gap-2" role="listitem">
          <TrendingDown className="w-3 h-3 text-purple-400" aria-hidden="true" />
          <span className="text-gray-400">Exit Point</span>
        </div>
      </div>

      {/* Chart - Responsive: 300px mobile, 400px desktop */}
      <div 
        role="img" 
        aria-label={`Price chart showing market price over time with ${markers.length} recommendation markers. Price range from ${minPrice.toFixed(2)} to ${maxPrice.toFixed(2)}.`}
      >
        <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
          <LineChart 
            data={chartData}
            margin={isMobile ? { top: 5, right: 5, left: 0, bottom: 5 } : { top: 20, right: 30, left: 20, bottom: 20 }}
            aria-hidden="true"
          >
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={["dataMin", "dataMax"]}
            stroke="#9ca3af"
            tick={{ fill: "#9ca3af", fontSize: isMobile ? 10 : 11 }}
            tickFormatter={(timestamp) =>
              new Date(timestamp).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
          />
          
          <YAxis
            domain={[yAxisMin, yAxisMax]}
            stroke="#9ca3af"
            tick={{ fill: "#9ca3af", fontSize: isMobile ? 10 : 11 }}
            tickFormatter={(value) => `${value.toFixed(2)}`}
            label={!isMobile ? {
              value: "Price",
              angle: -90,
              position: "insideLeft",
              fill: "#9ca3af",
              fontSize: 12,
            } : undefined}
          />
          
          <Tooltip content={<CustomTooltip isMobile={isMobile} />} />

          {/* Highlighted period area */}
          {highlightedArea && (
            <ReferenceArea
              x1={highlightedArea.startTime}
              x2={highlightedArea.endTime}
              fill="#3b82f6"
              fillOpacity={0.1}
              stroke="#3b82f6"
              strokeOpacity={0.3}
            />
          )}

          {/* Price line */}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#6366f1"
            strokeWidth={isMobile ? 1.5 : 2}
            dot={false}
            activeDot={{ r: isMobile ? 3 : 4, fill: "#6366f1" }}
          />

          {/* Entry and exit markers */}
          {markers.map((marker) => (
            <ReferenceDot
              key={marker.id}
              x={marker.timestamp}
              y={marker.price}
              r={isMobile ? 5 : 6}
              fill={marker.isProfitable ? "#10b981" : "#ef4444"}
              stroke="#fff"
              strokeWidth={isMobile ? 1.5 : 2}
              style={{ cursor: "pointer" }}
              shape={<MarkerShape type={marker.type} isProfitable={marker.isProfitable} size={isMobile ? 6 : 8} />}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      </div>
    </Card>
  );
}

/**
 * Custom marker shape for entry/exit points
 */
function MarkerShape({
  cx,
  cy,
  type,
  isProfitable,
  size = 8,
}: {
  cx?: number;
  cy?: number;
  type: "entry" | "exit";
  isProfitable: boolean;
  size?: number;
}) {
  if (cx === undefined || cy === undefined) return null;

  const color = isProfitable ? "#10b981" : "#ef4444";

  if (type === "entry") {
    // Triangle pointing up for entry
    return (
      <polygon
        points={`${cx},${cy - size} ${cx - size},${cy + size} ${cx + size},${cy + size}`}
        fill={color}
        stroke="#fff"
        strokeWidth={1.5}
      />
    );
  } else {
    // Triangle pointing down for exit
    return (
      <polygon
        points={`${cx},${cy + size} ${cx - size},${cy - size} ${cx + size},${cy - size}`}
        fill={color}
        stroke="#fff"
        strokeWidth={1.5}
      />
    );
  }
}

/**
 * Custom tooltip for chart data points and markers
 */
function CustomTooltip({ active, payload, isMobile }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className={`bg-black/95 border border-white/20 rounded-lg p-3 shadow-xl ${isMobile ? 'max-w-[200px]' : 'max-w-xs'}`}>
      <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-400 mb-2`}>
        {new Date(data.timestamp).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: isMobile ? undefined : "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-300`}>Price:</span>
          <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold text-white font-mono`}>
            ${data.price.toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  );
}
