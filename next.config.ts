import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next dev would otherwise write AGENTS.md and CLAUDE.md into the repository root.
  agentRules: false,
  // Pin the workspace root to this folder. Without it Next walks up the directory tree and
  // picks any lockfile it finds in a parent folder as the root.
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
