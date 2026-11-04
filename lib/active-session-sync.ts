"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Multi-device Daily Register sync.
 *
 * - Persists the active register snapshot to /api/active-session (Prisma `ActiveRegisterSession`)
 *   shortly after any local change (file import, manual entry, POS match, edits).
 * - Polls the shared record every few seconds (and on window focus) so a change made on one
 *   device (upload, edit, "Clear / Start Over", lock) shows up on every other device without a refresh.
 * - Revision numbers + a per-tab client id prevent echo loops; unsaved local edits win over
 *   incoming remote revisions until they are flushed.
 */

export interface ActiveSessionSnapshot<I = unknown, B = unknown, E = unknown> {
  erpInvoices: I[];
  preLoggedBankInvoices: B[];
  preLoggedEntries: E[];
  reportDate: string | null;
}

export type ActiveSessionSyncState = "connecting" | "saving" | "synced" | "offline";

export interface ActiveSessionSyncStatus {
  state: ActiveSessionSyncState;
  lastSyncedAt: string | null;
  lastRemoteUpdateAt: string | null;
  remoteStatus: string | null;
}

interface RemoteSession {
  branch: string;
  status: string;
  reportDate: string | null;
  dataJson: string | null;
  revision: number;
  updatedBy: string | null;
  updatedAt: string;
}

interface UseActiveSessionSyncOptions<I, B, E> {
  branch: string;
  enabled: boolean;
  snapshot: ActiveSessionSnapshot<I, B, E>;
  onRemoteSnapshot: (snapshot: ActiveSessionSnapshot<I, B, E>, meta: { status: string; isEmpty: boolean }) => void;
  pollMs?: number;
  debounceMs?: number;
}

const CLIENT_ID_KEY = "jct_active_session_client_id";

const isSnapshotEmpty = (s: ActiveSessionSnapshot<unknown, unknown, unknown>) =>
  s.erpInvoices.length === 0 && s.preLoggedBankInvoices.length === 0 && s.preLoggedEntries.length === 0;

/** Stable serialization; the report date only matters while the session actually holds data. */
const serializeSnapshot = (s: ActiveSessionSnapshot<unknown, unknown, unknown>): string =>
  JSON.stringify({
    erpInvoices: s.erpInvoices,
    preLoggedBankInvoices: s.preLoggedBankInvoices,
    preLoggedEntries: s.preLoggedEntries,
    reportDate: isSnapshotEmpty(s) ? null : s.reportDate,
  });

const EMPTY_SERIALIZED = serializeSnapshot({
  erpInvoices: [],
  preLoggedBankInvoices: [],
  preLoggedEntries: [],
  reportDate: null,
});

const getClientId = (): string => {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.sessionStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const fresh = `dev-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    window.sessionStorage.setItem(CLIENT_ID_KEY, fresh);
    return fresh;
  } catch {
    return `dev-${Math.random().toString(36).slice(2, 10)}`;
  }
};

const parseRemote = <I, B, E>(session: RemoteSession | null): ActiveSessionSnapshot<I, B, E> => {
  const empty: ActiveSessionSnapshot<I, B, E> = {
    erpInvoices: [],
    preLoggedBankInvoices: [],
    preLoggedEntries: [],
    reportDate: null,
  };
  if (!session || session.status === "CLEARED" || session.status === "COMPLETED" || !session.dataJson) {
    return empty;
  }
  try {
    const parsed = JSON.parse(session.dataJson) as Partial<ActiveSessionSnapshot<I, B, E>>;
    return {
      erpInvoices: Array.isArray(parsed.erpInvoices) ? parsed.erpInvoices : [],
      preLoggedBankInvoices: Array.isArray(parsed.preLoggedBankInvoices) ? parsed.preLoggedBankInvoices : [],
      preLoggedEntries: Array.isArray(parsed.preLoggedEntries) ? parsed.preLoggedEntries : [],
      reportDate: typeof parsed.reportDate === "string" ? parsed.reportDate : session.reportDate,
    };
  } catch {
    return empty;
  }
};

export function useActiveSessionSync<I, B, E>({
  branch,
  enabled,
  snapshot,
  onRemoteSnapshot,
  pollMs = 4000,
  debounceMs = 700,
}: UseActiveSessionSyncOptions<I, B, E>) {
  const [status, setStatus] = useState<ActiveSessionSyncStatus>({
    state: "connecting",
    lastSyncedAt: null,
    lastRemoteUpdateAt: null,
    remoteStatus: null,
  });

  const clientIdRef = useRef<string>("");
  const revisionRef = useRef<number>(0);
  const lastSerializedRef = useRef<string>(EMPTY_SERIALIZED);
  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightPollRef = useRef(false);
  const snapshotRef = useRef(snapshot);
  const onRemoteRef = useRef(onRemoteSnapshot);
  const branchRef = useRef(branch);

  useEffect(() => {
    snapshotRef.current = snapshot;
    onRemoteRef.current = onRemoteSnapshot;
  });

  const pushSnapshot = useCallback(async (snap: ActiveSessionSnapshot<I, B, E>) => {
    const serialized = serializeSnapshot(snap);
    const empty = isSnapshotEmpty(snap);
    setStatus((s) => ({ ...s, state: "saving" }));
    try {
      const res = await fetch("/api/active-session", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-branch-id": branchRef.current },
        body: JSON.stringify({
          branch: branchRef.current,
          clientId: clientIdRef.current,
          status: empty ? "DRAFT" : "IN_PROGRESS",
          reportDate: empty ? null : snap.reportDate,
          data: serialized,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { session: RemoteSession | null };
      if (data.session) revisionRef.current = data.session.revision;
      lastSerializedRef.current = serialized;
      dirtyRef.current = serializeSnapshot(snapshotRef.current) !== serialized;
      setStatus((s) => ({
        ...s,
        state: "synced",
        lastSyncedAt: new Date().toISOString(),
        remoteStatus: data.session?.status ?? s.remoteStatus,
      }));
    } catch (err) {
      console.warn("Active session save failed (will retry):", err);
      dirtyRef.current = true;
      setStatus((s) => ({ ...s, state: "offline" }));
    }
  }, []);

  const applyRemote = useCallback((session: RemoteSession | null) => {
    if (session) revisionRef.current = Math.max(revisionRef.current, session.revision);
    const remoteSnap = parseRemote<I, B, E>(session);
    const remoteSerialized = serializeSnapshot(remoteSnap);
    lastSerializedRef.current = remoteSerialized;
    if (remoteSerialized !== serializeSnapshot(snapshotRef.current)) {
      onRemoteRef.current(remoteSnap, {
        status: session?.status ?? "DRAFT",
        isEmpty: isSnapshotEmpty(remoteSnap),
      });
    }
    setStatus((s) => ({
      ...s,
      state: "synced",
      lastSyncedAt: new Date().toISOString(),
      lastRemoteUpdateAt: session?.updatedAt ?? s.lastRemoteUpdateAt,
      remoteStatus: session?.status ?? null,
    }));
  }, []);

  const poll = useCallback(
    async (isHydration = false) => {
      if (inFlightPollRef.current) return;
      inFlightPollRef.current = true;
      try {
        // Unsaved local edits win: flush them before accepting remote revisions
        if (!isHydration && (saveTimerRef.current || dirtyRef.current)) {
          if (!saveTimerRef.current && dirtyRef.current) {
            await pushSnapshot(snapshotRef.current);
          }
          return;
        }
        const res = await fetch(`/api/active-session?branch=${encodeURIComponent(branchRef.current)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { session: RemoteSession | null };
        const session = data.session;

        if (isHydration) {
          hydratedRef.current = true;
          const remoteSnap = parseRemote<I, B, E>(session);
          if (isSnapshotEmpty(remoteSnap) && !isSnapshotEmpty(snapshotRef.current)) {
            // Nothing shared yet but this device already has data: publish it
            if (session) revisionRef.current = session.revision;
            await pushSnapshot(snapshotRef.current);
            return;
          }
          applyRemote(session);
          return;
        }

        // A save may have started while the request was in flight
        if (saveTimerRef.current || dirtyRef.current) return;

        if (session && session.revision > revisionRef.current) {
          applyRemote(session);
        } else {
          setStatus((s) => (s.state === "offline" || s.state === "connecting" ? { ...s, state: "synced" } : s));
        }
      } catch (err) {
        console.warn("Active session poll failed:", err);
        setStatus((s) => ({ ...s, state: "offline" }));
      } finally {
        inFlightPollRef.current = false;
      }
    },
    [applyRemote, pushSnapshot]
  );

  // Hydrate + start polling (re-hydrate when the branch changes)
  useEffect(() => {
    if (!enabled || !branch) return;
    clientIdRef.current = clientIdRef.current || getClientId();
    branchRef.current = branch;
    hydratedRef.current = false;
    revisionRef.current = 0;
    dirtyRef.current = false;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void poll(true);

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void poll(false);
    }, pollMs);

    const handleFocus = () => void poll(false);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [enabled, branch, pollMs, poll]);

  // Debounced persistence whenever local session data changes
  const serializedLocal = serializeSnapshot(snapshot);
  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;
    if (serializedLocal === lastSerializedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void pushSnapshot(snapshotRef.current);
    }, debounceMs);
  }, [serializedLocal, enabled, debounceMs, pushSnapshot]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  /** "Clear / Start Over": wipe the shared draft for every device. */
  const clearRemoteSession = useCallback(async (finalStatus: "CLEARED" | "COMPLETED" = "CLEARED") => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    dirtyRef.current = false;
    lastSerializedRef.current = EMPTY_SERIALIZED;
    setStatus((s) => ({ ...s, state: "saving" }));
    try {
      const res =
        finalStatus === "CLEARED"
          ? await fetch(
              `/api/active-session?branch=${encodeURIComponent(branchRef.current)}&clientId=${encodeURIComponent(
                clientIdRef.current
              )}`,
              { method: "DELETE" }
            )
          : await fetch("/api/active-session", {
              method: "PUT",
              headers: { "Content-Type": "application/json", "x-branch-id": branchRef.current },
              body: JSON.stringify({
                branch: branchRef.current,
                clientId: clientIdRef.current,
                status: "COMPLETED",
                reportDate: null,
                data: null,
              }),
            });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { session: RemoteSession | null };
      if (data.session) revisionRef.current = data.session.revision;
      setStatus((s) => ({
        ...s,
        state: "synced",
        lastSyncedAt: new Date().toISOString(),
        remoteStatus: data.session?.status ?? finalStatus,
      }));
    } catch (err) {
      console.warn("Active session clear failed:", err);
      // Local state is already empty; flag dirty so the empty snapshot is retried on the next poll
      dirtyRef.current = true;
      lastSerializedRef.current = "__unsynced__";
      setStatus((s) => ({ ...s, state: "offline" }));
    }
  }, []);

  return { syncStatus: status, clearRemoteSession };
}
