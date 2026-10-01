import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // "@/x" is the repository root, the same mapping as "paths" in tsconfig.json.
      // A regex so that scoped packages such as "@testing-library/react" are left alone.
      { find: /^@\//, replacement: root },
      // next/font/google only works inside the Next.js compiler.
      { find: /^next\/font\/google$/, replacement: `${root}tests/stubs/next-font-google.ts` },
    ],
  },
  test: {
    // Node by default. A test that needs a DOM starts with `// @vitest-environment jsdom`.
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
