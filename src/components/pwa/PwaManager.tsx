import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { RefreshCw, WifiOff, X } from "lucide-react";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // hourly

/** Renders the "new version available" prompt and an offline indicator. */
export function PwaManager() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {});
        }, UPDATE_CHECK_INTERVAL);
      }
    },
  });

  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <>
      {/* Offline indicator */}
      {offline && (
        <div className="fixed inset-x-0 top-0 z-[200] flex items-center justify-center gap-2 bg-warning/90 px-4 py-1.5 text-center text-xs font-medium text-warning-foreground backdrop-blur">
          <WifiOff className="h-3.5 w-3.5" />
          You're offline — some data may be unavailable until you reconnect.
        </div>
      )}

      {/* New version available */}
      {needRefresh && (
        <div className="fixed bottom-4 left-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-fade-up">
          <div className="surface flex items-center gap-3 p-3 shadow-lg">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">New version available</p>
              <p className="text-xs text-muted-foreground">Update to get the latest OfferBridge.</p>
            </div>
            <Button
              size="sm"
              className="press shrink-0"
              disabled={updating}
              onClick={() => {
                setUpdating(true);
                void updateServiceWorker(true);
              }}
            >
              {updating ? "Updating…" : "Update"}
            </Button>
            <button
              aria-label="Dismiss"
              onClick={() => setNeedRefresh(false)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
