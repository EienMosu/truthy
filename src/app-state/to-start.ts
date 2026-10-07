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

/** How the way back may go. */
export interface ToStartOptions {
  /**
   * A full page load that an earlier way back from this screen started was lost (it never replaced the page), and
   * the same load would most likely stall again. When the start's entry is right behind /play, the way back goes
   * back to it whatever the worker says; that stays in the page when the start flow opened /play in this page,
   * and after a reload of /play it is a load of the document behind it, which nothing guards or stops. Otherwise
   * it takes the full page load again, under the play screen's guard: router.replace("/") is no way out, as a
   * newer release has taken over, so the payload comes from another build and Next.js answers with a document
   * load of its own, which nothing guards or stops either, and once that is lost too, every later
   * router.replace("/") in this page does nothing.
   */
  loadLost?: boolean;
}

/**
 * Opens the start. When a new version waits and takes over, or took over this page earlier without a reload,
 * the start opens with a full page load, so the page runs the new version's code; /play is replaced, so a back
 * step does not lead into the left round. With `loadLost`, a back step to the start's entry comes first.
 * Otherwise the in-app way of today: back to the start's entry, or / in place of /play, at once (before the
 * returned promise settles), and the worker is asked to look for a new version for the next safe moment.
 * Resolves true when it started the full page load: the page stays open until that load replaces it, and the
 * play screen keeps it as it is for FULL_LOAD_WAIT_MS at most, after which it takes the load as lost. False: the
 * in-app way was taken.
 */
export async function goToStart(
  services: ToStartServices,
  router: { replace(href: string): void },
  options: ToStartOptions = {},
): Promise<boolean> {
  const backTried = options.loadLost === true;
  if (backTried && services.backToStart?.()) return askForUpdate(services);
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
  if (backTried || !services.backToStart?.()) router.replace("/");
  return askForUpdate(services);
}

// After the in-app way back has moved: asks the worker to look for a new version for the next safe moment.
function askForUpdate(services: ToStartServices): false {
  services.offline.checkForUpdate().catch(() => undefined);
  return false;
}
