"use client";

import type { SocketStatus } from "@/hooks/useMarketSocket";

const config: Record<SocketStatus, { dot: string; label: string }> = {
  connected: { dot: "bg-green-500 animate-pulse", label: "Live" },
  connecting: { dot: "bg-yellow-400 animate-pulse", label: "Connecting" },
  disconnected: { dot: "bg-red-500", label: "Disconnected" },
};

export function LiveBadge({ status }: { status: SocketStatus }) {
  const { dot, label } = config[status];
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
      <span>{label}</span>
    </div>
  );
}
