import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { playSound } from "@/hooks/useSound";

/**
 * GlobalClickSounds — makes every interaction feel alive.
 *
 * Rules:
 *   - Any <a>, <button>, [role="button"] plays a sound on click.
 *   - Sidebar nav links → soft "tick" (fires often, whisper-quiet)
 *   - Everything else → "clink" (subtle metallic)
 *   - Route change → brief "pageTurn" whoosh
 *   - Elements can opt out with data-no-sound attribute
 *   - Habit toggles (data-testid starts with "toggle-habit") skip — they
 *     already play their own richer "tick"/"uncheck" sounds.
 */
export function GlobalClickSounds() {
  const [location] = useLocation();
  const lastLocation = useRef(location);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Find the nearest interactive ancestor within a small depth.
      let el = e.target as HTMLElement | null;
      let depth = 0;
      while (el && depth++ < 6) {
        const tag = el.tagName;
        const role = el.getAttribute("role");
        if (
          tag === "A" ||
          tag === "BUTTON" ||
          role === "button" ||
          role === "tab" ||
          el.hasAttribute("data-play-sound")
        ) {
          break;
        }
        el = el.parentElement;
      }
      if (!el) return;
      if (el.hasAttribute("data-no-sound")) return;

      // Skip habit toggle buttons — they already play richer feedback.
      const testId = el.getAttribute("data-testid") || "";
      if (testId.startsWith("toggle-") && testId !== "toggle-sound") return;
      // Skip habit rows and their input fields (they have their own SFX).
      if (testId.startsWith("input-")) return;

      // Nav sidebar links use a quieter "tick"; anything else uses "clink".
      const isNav = testId.startsWith("nav-") || el.closest("aside") !== null;
      playSound(isNav ? "navTick" : "buttonClink");
    };

    // Use pointerdown so the sound fires at press-time (feels snappier than click).
    document.addEventListener("pointerdown", handler, { capture: true });
    return () => document.removeEventListener("pointerdown", handler, { capture: true });
  }, []);

  // Play a page-turn whoosh on route change.
  useEffect(() => {
    if (lastLocation.current !== location) {
      playSound("pageTurn");
      lastLocation.current = location;
    }
  }, [location]);

  return null;
}
