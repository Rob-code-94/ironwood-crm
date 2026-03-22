import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // reactCompiler: true, // disabled — causes silent hang on startup with webpack
  output: "standalone", // Enable standalone output for Docker/Cloud Run
};

export default nextConfig;
