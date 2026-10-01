import { describe, expect, it } from "vitest";
import * as viaAlias from "@/src/meta";
import * as viaRelative from "../src/meta";

describe("test setup", () => {
  it("resolves the @/ alias to the repository root", () => {
    expect(viaAlias).toBe(viaRelative);
  });

  it("reads the app name through the alias", () => {
    expect(viaAlias.APP_NAME).toBe("Truthy");
  });

  it("runs in the node environment unless a file opts into jsdom", () => {
    expect(typeof document).toBe("undefined");
  });
});
