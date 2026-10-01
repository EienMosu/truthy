// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LOWER_CLOUD_TOP, SkyBackdrop } from "@/components/SkyBackdrop";

afterEach(cleanup);

function layer(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>("[data-sky-backdrop]");
  if (!element) throw new Error("no backdrop rendered");
  return element;
}

describe("SkyBackdrop", () => {
  it("is decorative: hidden from screen readers and ignoring touches", () => {
    const sky = layer(render(<SkyBackdrop />).container);
    expect(sky.getAttribute("aria-hidden")).toBe("true");
    expect(sky.className).toContain("pointer-events-none");
  });

  it("is a fixed layer behind everything, as wide as the viewport", () => {
    const sky = layer(render(<SkyBackdrop />).container);
    expect(sky.className).toContain("fixed");
    expect(sky.className).toContain("inset-0");
    expect(sky.className).toContain("-z-10");
    expect(sky.className).not.toContain("max-w-");
  });

  it("keeps the clouds inside the app frame", () => {
    const frame = render(<SkyBackdrop />).container.querySelector<HTMLElement>("[data-sky-frame]");
    expect(frame?.className).toContain("max-w-(--app-max-width)");
    expect(frame?.className).toContain("overflow-hidden");
    expect(frame?.querySelectorAll("svg")).toHaveLength(2);
  });

  it("blends the four sky colours smoothly from top to bottom, with no hard stops", () => {
    const sky = layer(render(<SkyBackdrop />).container);
    expect(sky.style.backgroundImage).toBe(
      "linear-gradient(180deg, var(--color-sky-1) 0%, var(--color-sky-2) 35%, var(--color-sky-3) 62%, var(--color-sky-4) 100%)",
    );
  });

  it("draws the upper cloud 150 by 46 at left -30, top 196", () => {
    const cloud = render(<SkyBackdrop />).container.querySelector<SVGElement>('[data-cloud="upper"]');
    expect(cloud?.getAttribute("width")).toBe("150");
    expect(cloud?.getAttribute("height")).toBe("46");
    expect(cloud?.style.left).toBe("-30px");
    expect(cloud?.style.top).toBe("196px");
  });

  it("puts the lower cloud 170 by 50 at right -40, top 620 on game screens by default", () => {
    const cloud = render(<SkyBackdrop />).container.querySelector<SVGElement>('[data-cloud="lower"]');
    expect(cloud?.getAttribute("width")).toBe("170");
    expect(cloud?.getAttribute("height")).toBe("50");
    expect(cloud?.style.right).toBe("-40px");
    expect(cloud?.style.top).toBe("620px");
  });

  it("moves the lower cloud to top 660 in the start flow", () => {
    const cloud = render(<SkyBackdrop lowerCloud="start" />).container.querySelector<SVGElement>('[data-cloud="lower"]');
    expect(cloud?.style.top).toBe("660px");
    expect(LOWER_CLOUD_TOP).toEqual({ game: 620, start: 660 });
  });

  it("fills both clouds with the cloud colour at the cloud opacity", () => {
    const clouds = render(<SkyBackdrop />).container.querySelectorAll("svg");
    expect(clouds).toHaveLength(2);
    for (const cloud of clouds) {
      expect(cloud.getAttribute("class")).toContain("fill-(--color-cloud)");
      expect(cloud.getAttribute("class")).toContain("opacity-(--opacity-cloud)");
    }
  });
});
