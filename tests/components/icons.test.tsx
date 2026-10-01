// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  BackArrowIcon,
  ICON_PATHS,
  BookIcon,
  CheckIcon,
  ChevronIcon,
  ClockIcon,
  CloseIcon,
  CloudIcon,
  CrossIcon,
  ForwardArrowIcon,
  HeartIcon,
  type IconProps,
  MoonIcon,
  PlaneIcon,
  ReplayIcon,
  RouteIcon,
  StarIcon,
  SunIcon,
} from "@/components/icons";

afterEach(cleanup);

// name, component, default width, default height, viewBox
const ICONS: ReadonlyArray<[string, ComponentType<IconProps>, number, number, string]> = [
  ["CloseIcon", CloseIcon, 16, 16, "0 0 16 16"],
  ["CrossIcon", CrossIcon, 16, 16, "0 0 16 16"],
  ["CheckIcon", CheckIcon, 18, 18, "0 0 18 18"],
  ["BackArrowIcon", BackArrowIcon, 18, 16, "0 0 18 16"],
  ["ForwardArrowIcon", ForwardArrowIcon, 40, 16, "0 0 40 16"],
  ["ChevronIcon", ChevronIcon, 16, 16, "0 0 16 16"],
  ["PlaneIcon", PlaneIcon, 24, 24, "-12 -12 24 24"],
  ["CloudIcon", CloudIcon, 22, 16, "0 0 22 16"],
  ["BookIcon", BookIcon, 18, 18, "0 0 18 18"],
  ["ReplayIcon", ReplayIcon, 18, 18, "0 0 18 18"],
  ["RouteIcon", RouteIcon, 20, 14, "0 0 20 14"],
  ["ClockIcon", ClockIcon, 22, 22, "0 0 22 22"],
  ["StarIcon", StarIcon, 18, 18, "0 0 18 18"],
  ["HeartIcon", HeartIcon, 20, 20, "-11 0 22 22"],
  ["MoonIcon", MoonIcon, 18, 18, "0 0 18 18"],
  ["SunIcon", SunIcon, 18, 18, "0 0 18 18"],
];

function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("no svg rendered");
  return svg;
}

describe.each(ICONS)("%s", (_name, Icon, width, height, viewBox) => {
  it("is hidden from screen readers by default", () => {
    const svg = svgOf(render(<Icon />).container);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
    expect(svg.getAttribute("focusable")).toBe("false");
  });

  it("has the size of the approved screens by default", () => {
    const svg = svgOf(render(<Icon />).container);
    expect(svg.getAttribute("width")).toBe(String(width));
    expect(svg.getAttribute("height")).toBe(String(height));
    expect(svg.getAttribute("viewBox")).toBe(viewBox);
  });

  it("scales to the size it is given and keeps its proportions", () => {
    const svg = svgOf(render(<Icon size={width * 2} />).container);
    expect(svg.getAttribute("width")).toBe(String(width * 2));
    expect(svg.getAttribute("height")).toBe(String(height * 2));
  });

  it("becomes a named image when it is given a label", () => {
    const svg = svgOf(render(<Icon label="Example" />).container);
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Example");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
  });
});

describe("icon variants", () => {
  it("draws the X of Close and of False with the path of the mockups, at strokes 2.4 and 3", () => {
    const close = render(<CloseIcon />).container.querySelector("path");
    const cross = render(<CrossIcon />).container.querySelector("path");
    expect(close?.getAttribute("d")).toBe("M3 3l10 10M13 3L3 13");
    expect(close?.getAttribute("stroke-width")).toBe("2.4");
    expect(cross?.getAttribute("d")).toBe("M3 3l10 10M13 3L3 13");
    expect(cross?.getAttribute("stroke-width")).toBe("3");
  });

  it("draws the Back pill arrow as an 18 square at stroke 2.2", () => {
    const svg = svgOf(render(<BackArrowIcon variant="pill" />).container);
    expect(svg.getAttribute("viewBox")).toBe("0 0 18 18");
    expect(svg.getAttribute("height")).toBe("18");
    expect(svg.querySelector("path")?.getAttribute("stroke-width")).toBe("2.2");
  });

  it("draws the down chevron of Why as a 12 square at stroke 1.8", () => {
    const svg = svgOf(render(<ChevronIcon direction="down" />).container);
    expect(svg.getAttribute("viewBox")).toBe("0 0 12 12");
    expect(svg.getAttribute("width")).toBe("12");
    expect(svg.querySelector("path")?.getAttribute("d")).toBe("M2 4l4 4 4-4");
  });

  it("draws a lost heart as an outline with a slash, a full heart as one filled shape", () => {
    const full = render(<HeartIcon />).container.querySelectorAll("path");
    const lost = render(<HeartIcon lost />).container.querySelectorAll("path");
    expect(full).toHaveLength(1);
    expect(full[0]?.getAttribute("fill")).toBe("currentColor");
    expect(lost).toHaveLength(2);
    expect(lost[0]?.getAttribute("fill")).toBe("none");
    expect(lost[1]?.getAttribute("d")).toBe("M-8 18L8 3");
  });

  it("draws the theme switch's moon and sun as line icons in currentColor, at stroke 2", () => {
    const moon = svgOf(render(<MoonIcon />).container);
    expect(moon.querySelector("path")?.getAttribute("d")).toBe(ICON_PATHS.moon);
    const sun = svgOf(render(<SunIcon />).container);
    const disc = sun.querySelector("circle");
    expect([disc?.getAttribute("cx"), disc?.getAttribute("cy"), disc?.getAttribute("r")]).toEqual(["9", "9", "3.3"]);
    expect(sun.querySelector("path")?.getAttribute("d")).toBe(ICON_PATHS.sunRays);
    for (const shape of [...moon.querySelectorAll("path"), ...sun.querySelectorAll("circle, path")]) {
      expect(shape.getAttribute("fill")).toBe("none");
      expect(shape.getAttribute("stroke")).toBe("currentColor");
      expect(shape.getAttribute("stroke-width")).toBe("2");
      expect(shape.getAttribute("stroke-linecap")).toBe("round");
    }
  });

  it("colours the plane with the accent and on-accent tokens, not with raw colours", () => {
    const svg = svgOf(render(<PlaneIcon />).container);
    expect(svg.querySelector("circle")?.getAttribute("class")).toBe("fill-(--color-accent)");
    expect(svg.querySelector("path")?.getAttribute("class")).toBe("stroke-(--color-on-accent)");
  });
});
