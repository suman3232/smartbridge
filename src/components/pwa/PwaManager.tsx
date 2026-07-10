import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { WifiOff } from "lucide-react";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // hourly

/** Auto-applies new versions (no stale cache) and shows an offline indicator. */
export function PwaManager() {
  const {
    needRefresh: [needRefresh],
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

  // As soon as a new build is ready, activate it and reload — so users always
  // run the latest version instead of a cached one.
  useEffect(() => {
    if (needRefresh) {
      void updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);

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

  if (!offline) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[200] flex items-center justify-center gap-2 bg-warning/90 px-4 py-1.5 text-center text-xs font-medium text-warning-foreground backdrop-blur">
      <WifiOff className="h-3.5 w-3.5" />
      You're offline — some data may be unavailable until you reconnect.
    </div>
  );
}
