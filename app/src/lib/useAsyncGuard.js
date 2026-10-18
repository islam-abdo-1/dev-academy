import { useCallback, useRef, useState } from "react";

export function useAsyncGuard() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (task) => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await task();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  return { run, busy };
}
