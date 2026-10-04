// @vitest-environment jsdom
// The action row's arrival is counted from the answer (NEXT_ARRIVES_MS). A second tap on the answer row as it
// leaves (its exit animation keeps it in the page, with its last props) answers nothing, and must not move
// that moment either: a tap once the action has arrived, counted from the first tap, takes it.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NEXT_ARRIVES_MS, PlayScreen } from "@/components/play/PlayScreen";
import { cardByStatement, harness, pendingFor, type Harness } from "../components/play/fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});
afterEach(cleanup);

let h: Harness;

describe("a double tap on the deciding answer", () => {
  it("leaves See results to arrive 420 ms after the first tap", async () => {
    h = harness(pendingFor("streak"));
    render(<PlayScreen services={h.services} />);
    await screen.findByRole("button", { name: "True" });
    await act(async () => {});
    h.advance(1000);
    const statement = document.querySelector("[data-statement] p:last-of-type")?.textContent;
    const wrong = screen.getByRole("button", { name: cardByStatement(statement).answer ? "False" : "True" });
    fireEvent.click(wrong);
    h.advance(150);
    // The answer row is leaving; the same button still takes the second tap.
    expect(wrong.isConnected).toBe(true);
    fireEvent.click(wrong);
    const results = await screen.findByRole("button", { name: "See results" });
    h.advance(NEXT_ARRIVES_MS - 150);
    fireEvent.click(results);
    expect(await screen.findByRole("heading", { name: "Round complete" })).toBeTruthy();
  });
});
