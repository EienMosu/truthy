import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next dev would otherwise write AGENTS.md and CLAUDE.md into the repository root.
  agentRules: false,
  // Pin the workspace root to this folder. Without it Next walks up the directory tree and
  // picks any lockfile it finds in a parent folder as the root.
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
  poweredByHeader: false,
  // The game is never embedded and never needs to send a full referrer to the sources it links to.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
