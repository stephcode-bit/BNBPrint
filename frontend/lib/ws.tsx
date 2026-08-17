"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { WsEvent } from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/tokens";

type Listener = (event: WsEvent) => void;

interface WsContextValue {
  connected: boolean;
  subscribe: (listener: Listener) => () => void;
}

const WsContext = createContext<WsContextValue>({
  connected: false,
  subscribe: () => () => {},
});

export function useTokenStream() {
  return useContext(WsContext);
}

export function WsProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const listeners = useRef<Set<Listener>>(new Set());
  const retryDelay = useRef(1000);
  const wsRef = useRef<WebSocket | null>(null);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket;

    function connect() {
      if (cancelled) return;
      socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        retryDelay.current = 1000;
      };

      socket.onmessage = (event) => {
        try {
          const parsed: WsEvent = JSON.parse(event.data);
          listeners.current.forEach((l) => l(parsed));

          if (parsed.type === "runner_flagged") {
            toast.success(`🚀 Runner: ${parsed.data.symbol} (${Math.round(parsed.data.runner_score)}/100)`, {
              style: { background: "#1E2329", color: "#F0B90B", border: "1px solid #2B3139" },
            });
          } else if (parsed.type === "new_token") {
            toast(`New token: ${parsed.data.symbol}`, {
              icon: "🆕",
              style: { background: "#1E2329", color: "#EAECEF", border: "1px solid #2B3139" },
            });
          } else if (parsed.type === "bonding_complete") {
            toast(`${parsed.data.symbol} finished bonding ✅`, {
              style: { background: "#1E2329", color: "#0ECB81", border: "1px solid #2B3139" },
            });
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          setTimeout(connect, retryDelay.current);
          retryDelay.current = Math.min(retryDelay.current * 1.7, 20000);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();
    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, []);

  return <WsContext.Provider value={{ connected, subscribe }}>{children}</WsContext.Provider>;
}
