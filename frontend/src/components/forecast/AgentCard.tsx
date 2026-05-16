"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgentStatus } from "@/types/forecast";

const STATUS_STYLES: Record<AgentStatus["status"], string> = {
  idle: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-700 animate-pulse",
  complete: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<AgentStatus["status"], string> = {
  idle: "Waiting",
  running: "Running",
  complete: "Complete",
  error: "Error",
};

interface Props {
  node: string;
  status: AgentStatus;
  children?: React.ReactNode;
}

export function AgentCard({ node, status, children }: Props) {
  return (
    <Card
      className={`transition-all ${
        status.status === "running" ? "ring-2 ring-blue-400" : ""
      }`}
    >
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">{status.label}</CardTitle>
        <Badge className={`text-[10px] px-2 py-0.5 ${STATUS_STYLES[status.status]}`}>
          {STATUS_LABELS[status.status]}
        </Badge>
      </CardHeader>

      {(status.status === "running" || status.status === "complete") && (
        <CardContent className="pt-0">
          {/* Streaming text — typewriter effect */}
          {status.streamedText && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 max-h-32 overflow-y-auto font-mono leading-relaxed">
              {status.streamedText}
              {status.status === "running" && (
                <span className="inline-block w-1.5 h-3 bg-blue-500 ml-0.5 animate-pulse" />
              )}
            </div>
          )}
          {/* Structured output */}
          {status.status === "complete" && children}
        </CardContent>
      )}
    </Card>
  );
}
