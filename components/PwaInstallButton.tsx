"use client";

import React, { useEffect, useState } from "react";
import { Download, X, Smartphone, Monitor } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "jct_pwa_install_dismissed";

export function PwaInstallButton({ compact = false }: { compact?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent || "";
    setIsIos(/iPad|iPhone|iPod/.test(ua));

    if (window.sessionStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setShowGuideModal(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (isStandalone || dismissed) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
        }
        return;
      } catch {
        // Fallback to guide modal
      }
    }
    setShowGuideModal(true);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    }
  };

  return (
    <>
      <div className="inline-flex items-center rounded-lg border border-jct-turquoise/40 bg-jct-turquoise/10 text-jct-charcoal dark:text-jct-turquoise shadow-sm overflow-hidden print:hidden">
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 font-bold hover:bg-jct-turquoise/20 transition ${
            compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
          }`}
          title="Install JCT Financial OS as a standalone Desktop or Mobile App"
        >
          <Download size={compact ? 12 : 13} />
          <span>📲 Install as App</span>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="px-1.5 py-1.5 text-slate-400 hover:text-rose-500 border-l border-jct-turquoise/20 transition"
          title="Dismiss install helper for this session"
          aria-label="Dismiss install button"
        >
          <X size={11} />
        </button>
      </div>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/75 backdrop-blur-md transition-opacity duration-200 p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-jct-turquoise/40 bg-[#070e24] p-6 text-white shadow-2xl space-y-4 animate-modal-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFD200] to-[#FACC15] font-black text-black text-sm">
                  JCT
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Install JCT Financial OS</h3>
                  <p className="text-[11px] text-slate-400">Run full-screen without browser bars</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {isIos ? (
              <div className="space-y-3 text-xs text-slate-200">
                <div className="flex items-start gap-2.5 rounded-xl bg-white/5 border border-white/10 p-3">
                  <Smartphone size={18} className="text-jct-turquoise shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">iPhone / iPad (Safari):</p>
                    <ol className="mt-1.5 list-decimal list-inside space-y-1 text-slate-300">
                      <li>Tap the <strong>Share</strong> button (square with arrow ↑) in Safari.</li>
                      <li>Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.</li>
                      <li>Tap <strong>Add</strong> in the top-right corner.</li>
                    </ol>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-200">
                <div className="flex items-start gap-2.5 rounded-xl bg-white/5 border border-white/10 p-3">
                  <Monitor size={18} className="text-jct-turquoise shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Desktop Chrome / Edge:</p>
                    <p className="mt-1 text-slate-300">
                      Click the <strong>Install App</strong> icon (computer with down arrow) on the right side of your browser&apos;s address bar, or open the browser menu (⋮) → <strong>Install JCT Financial OS</strong>.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl bg-white/5 border border-white/10 p-3">
                  <Smartphone size={18} className="text-jct-yellow shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Android Chrome / iPhone Safari:</p>
                    <p className="mt-1 text-slate-300">
                      Open your browser menu and tap <strong>&ldquo;Install App&rdquo;</strong> or <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full rounded-xl bg-jct-turquoise py-2.5 text-xs font-extrabold text-black hover:brightness-95 transition"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
