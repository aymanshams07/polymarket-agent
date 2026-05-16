"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentNode, AgentStatus, DebateResult, SSEEvent } from "@/types/forecast";

const NODES: AgentNode[] = [
  "market_analysis",
  "news_retrieval",
  "bullish",
  "bearish",
  "judge",
];

const NODE_LABELS: Record<AgentNode, string> = {
  market_analysis: "Market Analysis",
  news_retrieval: "News Retrieval",
  bullish: "Bullish Argument",
  bearish: "Bearish Rebuttal",
  judge: "Judge Verdict",
};

const DEFAULT_AGENTS = (): Record<AgentNode, AgentStatus> =>
  Object.fromEntries(
    NODES.map((n) => [n, { status: "idle", label: NODE_LABELS[n], streamedText: "" }])
  ) as Record<AgentNode, AgentStatus>;

export type DebatePhase = "idle" | "running" | "complete" | "error";

interface DebateStreamState {
  phase: DebatePhase;
  runId: string | null;
  agents: Record<AgentNode, AgentStatus>;
  currentNode: AgentNode | null;
  result: DebateResult | null;
  error: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function useDebateStream(conditionId: string) {
  const [state, setState] = useState<DebateStreamState>({
    phase: "idle",
    runId: null,
    agents: DEFAULT_AGENTS(),
    currentNode: null,
    result: null,
    error: null,
  });

  const esRef = useRef<EventSource | null>(null);

  const start = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    setState({
      phase: "running",
      runId: null,
      agents: DEFAULT_AGENTS(),
      currentNode: null,
      result: null,
      error: null,
    });

    const es = new EventSource(
      `${API_BASE}/api/v1/forecast/stream/${conditionId}`
    );
    esRef.current = es;

    es.onmessage = (rawEvent) => {
      let msg: SSEEvent;
      try {
        msg = JSON.parse(rawEvent.data as string) as SSEEvent;
      } catch {
        return;
      }

      switch (msg.event) {
        case "run_start":
          setState((s) => ({ ...s, runId: msg.run_id }));
          break;

        case "node_start":
          setState((s) => ({
            ...s,
            currentNode: msg.node as AgentNode,
            agents: {
              ...s.agents,
              [msg.node]: { ...s.agents[msg.node as AgentNode], status: "running" },
            },
          }));
          break;

        case "token":
          setState((s) => {
            const node = msg.node as AgentNode;
            if (!s.agents[node]) return s;
            return {
              ...s,
              agents: {
                ...s.agents,
                [node]: {
                  ...s.agents[node],
                  streamedText: s.agents[node].streamedText + msg.content,
                },
              },
            };
          });
          break;

        case "node_complete":
          setState((s) => ({
            ...s,
            agents: {
              ...s.agents,
              [msg.node]: { ...s.agents[msg.node as AgentNode], status: "complete" },
            },
          }));
          break;

        case "done":
          setState((s) => ({
            ...s,
            phase: "complete",
            result: msg.result,
            currentNode: null,
          }));
          es.close();
          break;

        case "error":
          setState((s) => ({
            ...s,
            phase: "error",
            error: msg.message,
            currentNode: null,
          }));
          es.close();
          break;
      }
    };

    es.onerror = () => {
      setState((s) => ({
        ...s,
        phase: "error",
        error: "Connection to backend lost.",
        currentNode: null,
      }));
      es.close();
    };
  }, [conditionId]);

  const reset = useCallback(() => {
    esRef.current?.close();
    setState({
      phase: "idle",
      runId: null,
      agents: DEFAULT_AGENTS(),
      currentNode: null,
      result: null,
      error: null,
    });
  }, []);

  return { ...state, start, reset, nodes: NODES };
}
