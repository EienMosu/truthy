// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LivesPath } from "@/components/LivesPath";

afterEach(cleanup);

/** n answers, wrong on the given cards (from 1). */
function results(n: number, ...wrongOn: number[]): boolean[] {
  return Array.from({ length: n }, (_, i) => !wrongOn.includes(i + 1));
}

describe("LivesPath on a very long round", () => {
  it("draws a dot for every right answer while a dot is wider than the line", () => {
    const { container } = render(<LivesPath results={results(80, 2, 3)} answered={false} />);
    expect(container.querySelectorAll('[data-trail="correct"]')).toHaveLength(78);
    expect(container.querySelectorAll('[data-trail="wrong"]')).toHaveLength(2);
  });

  it("stops adding dots once they would vanish inside the line, and keeps the wrong squares", () => {
    const { container } = render(<LivesPath results={results(300, 2, 3)} answered={false} />);
    expect(container.querySelectorAll('[data-trail="correct"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-trail="wrong"]')).toHaveLength(2);
    expect(container.querySelectorAll("*").length).toBeLessThan(40);
  });
});
