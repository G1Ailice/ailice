import type { NextConfig } from "next";
import type { PWAConfig } from "next-pwa"; // Import the PWAConfig type
import withPWA from "next-pwa";

const pwaConfig: PWAConfig = {
  dest: "public",
  disable: process.env.NODE_ENV === "development", // Enable PWA only in production
};

const nextConfig: NextConfig = {
  // other Next.js config options can go here
};

export default withPWA({
  ...nextConfig,
  ...pwaConfig, // Spread the PWA config here
});
