"use client";

// Starts the service worker when a page opens, and applies a waiting new version at the first safe moment
// of spec section 7: "when the app opens". It sits in app/layout.tsx, so it runs once per page load, on every
// page; only a page that opened on / applies an update, and it does that before the player has done anything,
// so the reload looks like part of opening the app. The other safe moment, coming back from a round, belongs
// to the play screen's ways back to the start (goToStart).
import { useEffect, useRef } from "react";
import { browserAppServices, type AppServices } from "@/src/app-state/services";
import type { OfflineClient } from "@/src/offline/register";

/**
 * Registers the worker; then, when the page opened on /, lets a waiting update take over and reloads once it
 * has. Registration can take seconds, and the start flow may open /play meanwhile with the layout still
 * mounted, so the page must also still be on / when registration settles and when the update has taken over
 * (spec section 7: never on /play while a round is open). A router.push("/play") still in flight reads / for a
 * moment, so nothing is applied or reloaded either once the player has pressed anything (`pressed`). Otherwise
 * nothing is applied and nothing reloads: a new version that already took over leaves the loaded code running,
 * as in a second tab (spec section 10).
 */
export async function openApp(
  offline: OfflineClient,
  path: string,
  reload: () => void,
  currentPath: () => string,
  pressed: () => boolean,
): Promise<void> {
  await offline.start();
  if (path !== "/" || currentPath() !== "/" || pressed()) return;
  if (!offline.updateWaiting()) return;
  if ((await offline.applyUpdate()) && currentPath() === "/" && !pressed()) reload();
}

export interface OfflineStartProps {
  /** The service worker. Defaults to the browser's. */
  services?: Pick<AppServices, "offline">;
  /** Reloads the page once the update controls it. Defaults to window.location.reload. */
  reload?: () => void;
}

function reloadPage(): void {
  window.location.reload();
}

function pagePath(): string {
  return window.location.pathname;
}

const PRESSES = ["pointerdown", "keydown"] as const;

export function OfflineStart({ services = browserAppServices, reload = reloadPage }: OfflineStartProps) {
  // Whether the player has pressed anything since the page opened: a finger, pen or mouse, or a key.
  const pressed = useRef(false);
  useEffect(() => {
    const onPress = () => {
      pressed.current = true;
    };
    for (const type of PRESSES) document.addEventListener(type, onPress, { capture: true, passive: true });
    return () => {
      for (const type of PRESSES) document.removeEventListener(type, onPress, { capture: true });
    };
  }, []);

  // Once per page load: the layout stays mounted across in-app moves between / and /play, and React runs
  // an effect twice in development.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void openApp(services.offline, pagePath(), reload, pagePath, () => pressed.current);
  }, [services, reload]);
  return null;
}
