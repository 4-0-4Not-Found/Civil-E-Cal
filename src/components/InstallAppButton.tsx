"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const isIos = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches;
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setMsg("App installed. You can launch it from your device icon.");
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (isStandalone) return <p className="text-xs text-slate-500">Installed app mode is active.</p>;

  const onInstall = async () => {
    if (!deferredPrompt) {
      if (isIos) {
        setMsg("iPhone/iPad: tap Share, then 'Add to Home Screen'.");
      } else {
        setMsg("If no prompt appears, use browser menu: Install app / Add to Home screen.");
      }
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setMsg(choice.outcome === "accepted" ? "Install started." : "Install canceled.");
    setDeferredPrompt(null);
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onInstall}
        className="inline-flex items-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100"
      >
        Install app
      </button>
      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
    </div>
  );
}
