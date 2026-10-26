import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker image runs the traced standalone server; local `next start` keeps the default output.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
