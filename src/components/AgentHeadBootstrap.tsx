"use client";

import { useEffect } from "react";

/**
 * Replaces `<Script beforeInteractive>` and inline `<script>` in root layout.
 * React 19 warns/fails on `<script>` nodes in the component tree on the client;
 * beacon + console patch run here after mount instead.
 */
export function AgentHeadBootstrap() {
  useEffect(() => {
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev) return;

    // #region agent log
    fetch("http://127.0.0.1:7428/ingest/ca13048c-9d98-4bcc-a485-2fd46d0652e4", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a0af80" },
      body: JSON.stringify({
        sessionId: "a0af80",
        runId: "post-fix-verify",
        hypothesisId: "VERIFY",
        location: "src/components/AgentHeadBootstrap.tsx:mount",
        message: "AgentHeadBootstrap mounted (head scripts removed from layout)",
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    const send = (payload: Record<string, unknown>) => {
      try {
        void fetch("/api/agent-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    };

    try {
      void fetch(
        `/api/agent-beacon?runId=head-beacon&location=${encodeURIComponent("src/components/AgentHeadBootstrap.tsx:beacon-fetch")}&ts=${Date.now()}`,
        { method: "GET", cache: "no-store" },
      ).catch(() => {});
    } catch {
      /* ignore */
    }

    try {
      const origErr = console.error;
      console.error = (...args: unknown[]) => {
        try {
          const msg = args
            .map((a) => {
              try {
                return typeof a === "string" ? a : JSON.stringify(a);
              } catch {
                return String(a);
              }
            })
            .join(" ");
          if (
            msg &&
            (msg.includes("hydration") ||
              msg.includes("Hydration") ||
              msg.includes("didn't match") ||
              msg.includes("did not match"))
          ) {
            send({
              sessionId: "fd44da",
              runId: "console",
              hypothesisId: "H17",
              location: "src/components/AgentHeadBootstrap.tsx:consolePatch",
              message: "console.error hydration-related",
              data: { msg: msg.slice(0, 2000) },
              timestamp: Date.now(),
            });
          }
        } catch {
          /* ignore */
        }
        origErr.apply(console, args as []);
      };
    } catch {
      /* ignore */
    }

    try {
      const html = document.documentElement;
      const body = document.body;
      const htmlAttrs = html?.getAttributeNames?.() ?? [];
      const bodyAttrs = body?.getAttributeNames?.() ?? [];
      send({
        sessionId: "fd44da",
        runId: "postAttrs",
        hypothesisId: "H14",
        location: "src/components/AgentHeadBootstrap.tsx:attrs",
        message: "Post-mount html/body attribute names",
        data: { htmlAttrs, bodyAttrs },
        timestamp: Date.now(),
      });
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
