"use client";

import { useState } from "react";
import type { AgentNode, AgentStatus } from "@/types/forecast";

// ─── Icons ────────────────────────────────────────────────────

const NODE_ICONS: Record<AgentNode, string> = {
  market_analysis: "📊",
  news_retrieval: "📰",
  bullish: "📈",
  bearish: "📉",
  judge: "⚖️",
};

const NODE_DESCRIPTIONS: Record<AgentNode, string> = {
  market_analysis: "Parsing price action, volume, and market sentiment",
  news_retrieval: "Semantic search across news corpus via RAG",
  bullish: "Building strongest case for YES outcome",
  bearish: "Building strongest case for NO + rebutting YES",
  judge: "Weighing both sides, calibrating final probability",
};

// ─── Status dot ───────────────────────────────────────────────

function StatusDot({ status }: { status: AgentStatus["status"] }) {
  const base = "w-2.5 h-2.5 rounded-full border-2 flex-shrink-0";
  if (status === "running")
    return <span className={`${base} border-blue-500 bg-blue-500 animate-pulse`} />;
  if (status === "complete")
    return <span className={`${base} border-emerald-500 bg-emerald-500`} />;
  if (status === "error")
    return <span className={`${base} border-red-500 bg-red-500`} />;
  return <span className={`${base} border-zinc-600 bg-zinc-800`} />;
}

// ─── Single timeline step ─────────────────────────────────────

interface StepProps {
  node: AgentNode;
  status: AgentStatus;
  isLast: boolean;
}

function TimelineStep({ node, status, isLast }: StepProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = status.status === "complete" && status.streamedText.length > 0;
  const isActive = status.status === "running";

  return (
    <div className="flex gap-3">
      {/* Left gutter: dot + line */}
      <div className="flex flex-col items-center">
        <div className="mt-0.5">
          <StatusDot status={status.status} />
        </div>
        {!isLast && (
          <div
            className={`w-px flex-1 mt-1 ${
              status.status === "complete" ? "bg-emerald-800" : "bg-zinc-700"
            }`}
          />
        )}
      </div>

      {/* Right content */}
      <div className={`pb-4 flex-1 min-w-0 ${isLast ? "" : ""}`}>
        <button
          className="w-full text-left"
          onClick={() => canExpand && setExpanded((x) => !x)}
          disabled={!canExpand}
        >
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{NODE_ICONS[node]}</span>
            <span
              className={`text-sm font-semibold ${
                isActive ? "text-blue-400" :
                status.status === "complete" ? "text-white" : "text-zinc-500"
              }`}
            >
              {status.label}
            </span>
            {status.status === "running" && (
              <span className="text-[10px] text-blue-400 font-mono tracking-wide animate-pulse">
                RUNNING
              </span>
            )}
            {status.status === "complete" && (
              <span className="text-[10px] text-emerald-400 font-mono tracking-wide">DONE</span>
            )}
            {canExpand && (
              <span className="ml-auto text-zinc-500 text-xs">{expanded ? "▲" : "▼"}</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
            {NODE_DESCRIPTIONS[node]}
          </p>
        </button>

        {/* Streaming or expanded text */}
        {isActive && status.streamedText && (
          <div className="mt-2 text-[11px] font-mono text-zinc-400 leading-relaxed bg-zinc-900 rounded px-2 py-1.5 max-h-28 overflow-y-auto">
            {status.streamedText}
            <span className="inline-block w-1.5 h-3 bg-blue-400 ml-0.5 align-middle animate-pulse" />
          </div>
        )}

        {canExpand && expanded && (
          <div className="mt-2 text-[11px] font-mono text-zinc-400 leading-relaxed bg-zinc-900 rounded px-2 py-1.5 max-h-40 overflow-y-auto">
            {status.streamedText}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

interface Props {
  nodes: AgentNode[];
  agents: Record<AgentNode, AgentStatus>;
  phase: "idle" | "running" | "complete" | "error";
}

export function AgentTimeline({ nodes, agents, phase }: Props) {
  const completedCount = nodes.filter((n) => agents[n].status === "complete").length;
  const progress = Math.round((completedCount / nodes.length) * 100);

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-100 tracking-widest uppercase">
              Agent Pipeline
            </span>
            {phase === "running" && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] text-blue-400">LIVE</span>
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            {completedCount}/{nodes.length} complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 pt-4 pb-2">
        {nodes.map((node, i) => (
          <TimelineStep
            key={node}
            node={node}
            status={agents[node]}
            isLast={i === nodes.length - 1}
          />
        ))}
      </div>

      {/* Footer */}
      {phase === "idle" && (
        <div className="px-4 pb-4 text-center text-[11px] text-zinc-600">
          Click &ldquo;Run Analysis&rdquo; to start the agent pipeline
        </div>
      )}
      {phase === "error" && (
        <div className="px-4 pb-4 text-center text-[11px] text-red-500">
          Pipeline encountered an error
        </div>
      )}
    </div>
  );
}
