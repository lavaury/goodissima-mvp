import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { governedMemoryResponseHeaders } from "./cache-policy";
import type { GovernedMemoryHttpFailure, GovernedMemoryHttpSuccess } from "./contracts";
import { mapGovernedMemoryHttpError } from "./error-mapper";

export async function governedMemoryHttpResponse<T>(operation: () => Promise<T>) {
  noStore();
  const requestId = crypto.randomUUID();
  try {
    const data = await operation();
    const payload: GovernedMemoryHttpSuccess<T> = { ok: true, data, meta: { requestId, generatedAt: new Date().toISOString() } };
    return NextResponse.json(payload, { status: 200, headers: governedMemoryResponseHeaders });
  } catch (error) {
    const mapped = mapGovernedMemoryHttpError(error);
    const payload: GovernedMemoryHttpFailure = { ok: false, error: { code: mapped.code, message: mapped.message }, meta: { requestId } };
    return NextResponse.json(payload, { status: mapped.status, headers: governedMemoryResponseHeaders });
  }
}
