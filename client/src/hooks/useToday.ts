import { useEffect, useState } from "react";
import { todayStr } from "@/lib/analytics";
import { queryClient } from "@/lib/queryClient";

/**
 * Auto-updates when the local calendar day rolls over.
 * Also invalidates the logs / journal caches at midnight so a fresh
 * blank day loads. Any component using this hook re-renders once the
 * date changes.
 */
export function useToday(): string {
  const [today, setToday] = useState<string>(todayStr());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const now = new Date();
      const tomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        5 // 5s past midnight to avoid drift edge cases
      );
      const ms = tomorrow.getTime() - now.getTime();
      timer = setTimeout(() => {
        const fresh = todayStr();
        setToday(fresh);
        // Force a refetch so stats/streaks/curves reflect the new day.
        queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        scheduleNext();
      }, ms);
    };

    // Also detect day change on tab focus (in case the machine was asleep at midnight).
    const onFocus = () => {
      const fresh = todayStr();
      if (fresh !== today) {
        setToday(fresh);
        queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      }
    };

    scheduleNext();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  return today;
}
