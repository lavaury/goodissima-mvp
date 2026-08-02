export type GovernedMemoryHttpErrorCode = "INVALID_REQUEST" | "UNAUTHENTICATED" | "NOT_FOUND" | "INCONSISTENT_MEMORY_GRAPH" | "INTERNAL_ERROR";

export type GovernedMemoryHttpSuccess<T> = {
  ok: true;
  data: T;
  meta: { requestId: string; generatedAt: string };
};

export type GovernedMemoryHttpFailure = {
  ok: false;
  error: { code: GovernedMemoryHttpErrorCode; message: string };
  meta: { requestId: string };
};
