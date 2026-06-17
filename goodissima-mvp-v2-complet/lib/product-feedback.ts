import type { Prisma, ProductFeedbackStatus } from "@prisma/client";

export const productFeedbackTypes = ["Bug", "Suggestion", "UX", "Compréhension", "Autre"] as const;
export const productFeedbackStatuses = ["NEW", "IN_PROGRESS", "RESOLVED", "IGNORED"] as const;
export const feedbackAdminRoles = new Set(["ADMIN", "SUPER_ADMIN", "PRODUCT_OWNER"]);
export const feedbackScreenshotBucketName = "case-documents";
export const maxFeedbackScreenshots = 5;
export const maxFeedbackScreenshotSizeBytes = 10 * 1024 * 1024;
export const allowedFeedbackScreenshotMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
export const allowedFeedbackScreenshotExtensions = new Set(["png", "jpg", "jpeg", "webp"]);

export type ProductFeedbackType = (typeof productFeedbackTypes)[number];
export type ProductFeedbackStatusValue = (typeof productFeedbackStatuses)[number];

export type ProductFeedbackFilters = {
  type?: string | null;
  status?: string | null;
  search?: string | null;
};

export type ProductFeedbackCsvRow = {
  id: string;
  type: string;
  message: string;
  page: string | null;
  role: string | null;
  userId: string | null;
  caseId: string | null;
  templateId: string | null;
  environment: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  resolvedAt: Date | string | null;
  browserInfo?: unknown;
  attachments?: Array<unknown>;
};

export function canAccessFeedbackAdmin(role: string | null | undefined) {
  return feedbackAdminRoles.has((role ?? "").toUpperCase());
}

export function cleanFeedbackString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();
  if (!cleaned) return null;

  return cleaned.slice(0, maxLength);
}

export function sanitizeFeedbackFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export function getFeedbackFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isAllowedFeedbackScreenshot(file: File) {
  return (
    allowedFeedbackScreenshotMimeTypes.has(file.type) ||
    allowedFeedbackScreenshotExtensions.has(getFeedbackFileExtension(file.name))
  );
}

export function normalizeFeedbackType(value: unknown): ProductFeedbackType {
  return productFeedbackTypes.includes(value as ProductFeedbackType) ? (value as ProductFeedbackType) : "Autre";
}

export function normalizeFeedbackStatus(value: unknown, fallback: ProductFeedbackStatusValue = "NEW"): ProductFeedbackStatusValue {
  return productFeedbackStatuses.includes(value as ProductFeedbackStatusValue) ? (value as ProductFeedbackStatusValue) : fallback;
}

export function buildFeedbackWhere(filters: ProductFeedbackFilters): Prisma.ProductFeedbackWhereInput {
  const type = productFeedbackTypes.includes(filters.type as ProductFeedbackType) ? filters.type : null;
  const status = productFeedbackStatuses.includes(filters.status as ProductFeedbackStatusValue)
    ? (filters.status as ProductFeedbackStatus)
    : null;
  const search = cleanFeedbackString(filters.search, 160);

  return {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { message: { contains: search, mode: "insensitive" as const } },
            { page: { contains: search, mode: "insensitive" as const } },
            { adminNotes: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export function buildFeedbackStatusUpdate(status: ProductFeedbackStatusValue, adminNotes: string | null) {
  return {
    status,
    adminNotes,
    resolvedAt: status === "RESOLVED" ? new Date() : null,
  };
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function serializeBrowserInfo(value: unknown) {
  if (!value) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function buildProductFeedbackCsv(rows: ProductFeedbackCsvRow[]) {
  const header = [
    "id",
    "type",
    "status",
    "message",
    "page",
    "role",
    "userId",
    "caseId",
    "templateId",
    "environment",
    "browserInfo",
    "attachmentsCount",
    "adminNotes",
    "createdAt",
    "updatedAt",
    "resolvedAt",
  ];

  const lines = rows.map((row) =>
    [
      row.id,
      row.type,
      row.status,
      row.message,
      row.page,
      row.role,
      row.userId,
      row.caseId,
      row.templateId,
      row.environment,
      serializeBrowserInfo(row.browserInfo),
      row.attachments?.length ?? 0,
      row.adminNotes,
      row.createdAt,
      row.updatedAt,
      row.resolvedAt,
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.join(","), ...lines].join("\r\n");
}
