import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // reactCompiler: true, // disabled — causes silent hang on startup with webpack
  output: "standalone", // Enable standalone output for Docker/Cloud Run
  // Never trace prior Electron outputs into `.next/standalone` — a nested
  // `dist/**/*.app` breaks macOS `codesign` when that tree is bundled under
  // `Resources/server/` inside the real Electron app.
  outputFileTracingExcludes: {
    "*": ["./dist/**/*", "./electron/build/**/*"],
  },
};

export default nextConfig;
