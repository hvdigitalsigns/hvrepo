/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

let supabaseHost = "";
try {
  supabaseHost = new URL(supabaseUrl).host;
} catch {
  supabaseHost = "";
}

const nextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/**",
          },
        ]
      : [],
  },
  eslint: {
    // Avoid local ESLint version/config churn; we still run TypeScript during build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

