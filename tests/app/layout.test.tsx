import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout, { metadata } from "@/app/layout";

describe("root layout", () => {
  it("declares the page language as English for screen readers", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>child</p>
      </RootLayout>,
    );
    expect(html).toMatch(/^<html lang="en"/);
  });

  it("renders its children inside the body", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>child</p>
      </RootLayout>,
    );
    expect(html).toContain("<body><p>child</p></body>");
  });

  it("names the page Truthy with a one-line description", () => {
    expect(metadata.title).toBe("Truthy");
    expect(metadata.description).toBe("A true or false card game that teaches IT, one swipe at a time.");
  });
});
