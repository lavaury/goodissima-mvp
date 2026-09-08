export const ORGANIZE_PAGE_SIZE = 20;
export function organizePage(value: unknown): number {
  const page = typeof value === "string" && /^\d{1,6}$/.test(value) ? Number(value) : value;
  return typeof page === "number" && Number.isSafeInteger(page) && page >= 0 && page <= 100000 ? page : 0;
}
export function organizeWindow(page: number = 0) {
  return { skip: organizePage(page) * ORGANIZE_PAGE_SIZE, take: ORGANIZE_PAGE_SIZE + 1 };
}
export function organizeResults<T>(rows: T[]) {
  return { items: rows.slice(0, ORGANIZE_PAGE_SIZE), hasMore: rows.length > ORGANIZE_PAGE_SIZE };
}
