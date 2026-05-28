type FeatureFlagName =
  | "FEATURE_AI"
  | "FEATURE_MATCHING"
  | "FEATURE_ANALYTICS"
  | "FEATURE_EXPERIMENTAL";

function readFeatureFlag(name: FeatureFlagName, defaultValue: boolean) {
  const value = process.env[name];
  if (value === undefined || value === "") return defaultValue;

  return value === "true";
}

export const featureFlags = {
  ai: readFeatureFlag("FEATURE_AI", true),
  matching: readFeatureFlag("FEATURE_MATCHING", true),
  analytics: readFeatureFlag("FEATURE_ANALYTICS", true),
  experimental: readFeatureFlag("FEATURE_EXPERIMENTAL", false),
};
