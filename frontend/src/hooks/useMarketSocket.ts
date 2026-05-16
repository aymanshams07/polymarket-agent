"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WSMessage } from "@/types/market";

export type SocketStatus = "connecting" | "connected" | "disconnected";

interface Options {
  onSnapshot?: (msg: Extract<WSMessage, { type: "snapshot" }>) => void;
  onPriceUpdate?: (msg: Extract<WSMessage, { type: "price_update" }>) => void;
}

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
const MAX_RECONNECT_DELAY = 30_000;

export function useMarketSocket({ onSnapshot, onPriceUpdate }: Options) {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1_000);
  const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;
    setStatus("connecting");

    const ws = new WebSocket(`${WS_BASE}/ws/markets`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = 1_000;
      setStatus("connected");
      pingInterval.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 20_000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WSMessage;
        if (msg.type === "snapshot") onSnapshot?.(msg);
        else if (msg.type === "price_update") onPriceUpdate?.(msg);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (pingInterval.current) clearInterval(pingInterval.current);
      if (unmounted.current) return;
      setStatus("disconnected");
      setTimeout(connect, reconnectDelay.current);
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY);
    };

    ws.onerror = () => ws.close();
  }, [onSnapshot, onPriceUpdate]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (pingInterval.current) clearInterval(pingInterval.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return status;
}
