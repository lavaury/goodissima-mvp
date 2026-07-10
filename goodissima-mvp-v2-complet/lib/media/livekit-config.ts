import "server-only";

export type LiveKitConfigStatus = {
  configured: boolean;
  url: "present" | "missing";
  apiKey: "present" | "missing";
  apiSecret: "present" | "missing";
};

export function maskLiveKitSecret(value: string | undefined | null) {
  if (!value) return "missing";
  return `${value.slice(0, 2)}${"*".repeat(Math.max(6, value.length - 2))}`;
}

export function getLiveKitConfigStatus(): LiveKitConfigStatus {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  return {
    configured: Boolean(url && apiKey && apiSecret),
    url: url ? "present" : "missing",
    apiKey: apiKey ? "present" : "missing",
    apiSecret: apiSecret ? "present" : "missing",
  };
}

export function getLiveKitConfig() {
  const livekitUrl = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!livekitUrl || !apiKey || !apiSecret) {
    throw new Error("Le service de communication LiveKit n'est pas configure.");
  }
  return { livekitUrl, apiKey, apiSecret };
}
