// The way back from a round to the start (spec section 7, the second safe moment). The play screen's own
// ways back (Choose another route, Close results, Leave round) come here once the round is left or finished,
// so a new version of the app that waits can take over without changing a round in progress.
import type { AppServices } from "./services";

/** What goToStart needs of the play screen's services (PlayServices has all of it). */
export interface ToStartServices {
  offline: AppServices["offline"];
  /** Goes back to the start flow's entry when it is right behind /play; false or left out: it is not. */
  backToStart?: () => boolean;
}

/**
 * Opens the start. When a new version waits and takes over, or took over this page earlier without a reload,
 * the start opens with a full page load, so the page runs the new version's code; /play is replaced, so a back
 * step does not lead into the left round.
 * Otherwise the in-app way of today: back to the start's entry, or / in place of /play, at once (before the
 * returned promise settles), and the worker is asked to look for a new version for the next safe moment.
 * Resolves true when it started the full page load: the page stays open until that load replaces it, and the
 * caller keeps it as it is until then. False: the in-app way was taken.
 */
export async function goToStart(services: ToStartServices, router: { replace(href: string): void }): Promise<boolean> {
  if (services.offline.updateWaiting()) {
    const applied = await services.offline.applyUpdate().catch(() => false);
    if (applied) {
      window.location.replace("/");
      return true;
    }
  }
  // A new version took over this page earlier and no load followed (the player pressed during the update when
  // the app opened, or it took over after applyUpdate gave up): nothing waits any more, but the page still runs
  // the old code, so the start opens with a full page load as well.
  if (services.offline.updateApplied()) {
    window.location.replace("/");
    return true;
  }
  if (!services.backToStart?.()) router.replace("/");
  services.offline.checkForUpdate().catch(() => undefined);
  return false;
}
