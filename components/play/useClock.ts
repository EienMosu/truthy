// The Timed clock's link to the outside world (spec section 6, "Timed"): while a Timed round is running,
// the time of the services and the page's visibility reach the round as tick and visibility events. The
// engine does all the counting; this hook only reports.
import { useEffect } from "react";
import type { RoundEvent } from "@/src/engine/round";
import type { PlayServices } from "./useRound";

/** While `running`, reports time and page visibility to the round as tick and visibility events. */
export function useClock(
  running: boolean,
  dispatch: (event: RoundEvent) => void,
  services: Pick<PlayServices, "now" | "ticker" | "visibility">,
): void {
  useEffect(() => {
    if (!running) return;
    // A page that is already hidden pauses the clock before it starts. The first tick starts it: the clock
    // counts from the moment the first card is shown.
    if (services.visibility.hidden()) dispatch({ type: "visibility", hidden: true, at: services.now() });
    dispatch({ type: "tick", now: services.now() });
    const stopTicking = services.ticker(() => dispatch({ type: "tick", now: services.now() }));
    const stopListening = services.visibility.listen((hidden) => dispatch({ type: "visibility", hidden, at: services.now() }));
    return () => {
      stopTicking();
      stopListening();
    };
  }, [running, dispatch, services]);
}
