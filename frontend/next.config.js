const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Custom SW source (adds Web Push handling on top of the default asset
  // caching) — see worker/index.js. Runtime caching rules for /api/tokens
  // and /api/stats live inside that file (via workbox-routing) rather than
  // here, since InjectManifest mode (triggered by swSrc) doesn't support
  // the `runtimeCaching` option that GenerateSW mode uses.
  swSrc: "worker/index.js",
  fallbacks: {
    document: "/offline",
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

module.exports = withPWA(nextConfig);
