"use client";

import Header from "@/components/Header";
import { useTrading } from "@/providers/TradingProvider";

export default function HistoryPage() {
  const { endTradingSession } = useTrading();

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0A] text-white">
      <Header onEndSession={endTradingSession} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12" />
    </div>
  );
}
