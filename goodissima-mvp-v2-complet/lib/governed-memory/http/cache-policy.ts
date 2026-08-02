export const GOVERNED_MEMORY_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";

export const governedMemoryResponseHeaders = Object.freeze({
  "Cache-Control": GOVERNED_MEMORY_CACHE_CONTROL,
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
});
