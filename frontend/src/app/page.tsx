import { Nav } from "@/components/layout/Nav";
import { MarketGrid } from "@/components/markets/MarketGrid";

export default function HomePage() {
  return (
    <>
      <Nav />
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-zinc-900">Active Markets</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Live Polymarket data · Click any market to run AI analysis
          </p>
        </div>
        <MarketGrid />
      </div>
    </>
  );
}
