import { useEffect, useMemo, useSyncExternalStore } from "react";
import { F_VIEWS } from "../scene/furnaceLayout";
import { contextViews, type View } from "../scene/layout";
import { useView } from "../scene/Scene";
import { useDictation } from "../store/useDictation";
import { useLayout } from "../store/useLayout";
import { useSim } from "../store/useSim";

/** Hooks for the configurable job-screen layout (kept apart from the components for Fast Refresh). */

export function useWindowWidth(): number {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("resize", notify);
      return () => window.removeEventListener("resize", notify);
    },
    () => window.innerWidth,
  );
}

/** True for a finger (iPad, phone); false for a mouse, trackpad or Apple Pencil hover. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(pointer: coarse)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(pointer: coarse)").matches,
  );
}

export function useJobViews(): readonly View[] {
  const unitType = useSim((s) => s.unitType);
  const context = useSim((s) => s.context);
  return useMemo(
    () => (unitType === "furnace" ? F_VIEWS : contextViews(context)),
    [unitType, context],
  );
}

const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** T, V, J, 1–9 and Esc, for a PC or an iPad with a keyboard. Ignored while typing. */
export function useLayoutShortcuts(
  enabled: boolean,
  views: ReturnType<typeof useJobViews>,
): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent): void => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        typing(event.target)
      )
        return;
      const layout = useLayout.getState();
      const key = event.key.toLowerCase();
      if (key === "escape") {
        if (layout.surface && layout.surface !== "settings") layout.open(null);
        else if (layout.drawerOpen) layout.setDrawer(false);
        else return;
      } else if (key === "t") {
        if (
          layout.config.toolBag === "floating" ||
          document.querySelector(".toolbox") === null
        )
          layout.toggle("tools");
        else return;
      } else if (key === "v") {
        if (layout.config.views === "floating") layout.toggle("views");
        else return;
      } else if (key === "j") {
        if (document.getElementById("job-drawer"))
          layout.setDrawer(!layout.drawerOpen);
        else return;
      } else if (/^[1-9]$/.test(key) && views[Number(key) - 1]) {
        useView.getState().go(views[Number(key) - 1]!);
        layout.open(null);
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, views]);
}

/** Clears voice-input errors and OS-dictation tips after a few seconds. */
export function useDictationNotices(): void {
  const error = useDictation((s) => s.error);
  const hint = useDictation((s) => s.hint);
  useEffect(() => {
    if (!error && !hint) return;
    const timer = window.setTimeout(
      () => useDictation.setState({ error: null, hint: null }),
      9000,
    );
    return () => window.clearTimeout(timer);
  }, [error, hint]);
}
