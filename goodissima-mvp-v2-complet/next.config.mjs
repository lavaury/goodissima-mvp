const privatePageSources = [
  "/admin/:path*",
  "/administration/:path*",
  "/analytics/:path*",
  "/annuaire/:path*",
  "/boussole/:path*",
  "/cases/:path*",
  "/dashboard/:path*",
  "/demo/:path*",
  "/experience/:path*",
  "/gouvernance/:path*",
  "/identity/:path*",
  "/ia-valeur",
  "/links/:path*",
  "/opportunities/:path*",
  "/parcours",
  "/relations/:path*",
  "/settings/:path*",
  "/templates/:path*",
  "/test-email/:path*",
  "/trust/:path*",
  "/workspaces/:path*",
  "/secure/:path*",
  "/l/:path*",
  "/login",
  "/signup",
  "/private-access",
  "/reset-password",
  "/update-password",
];

const privateRobotsHeader = {
  key: "X-Robots-Tag",
  value: "noindex, nofollow, noarchive",
};

const nextConfig = {
  async headers() {
    return privatePageSources.map((source) => ({
      source,
      headers: [privateRobotsHeader],
    }));
  },
};
export default nextConfig;
