import path from "path";
import { mkdir, writeFile, unlink, stat } from "fs/promises";
import { randomUUID } from "crypto";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".txt",
  ".csv",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const INLINE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
]);

export function getUploadRoot(): string {
  return process.env.FILE_UPLOAD_ROOT?.trim()
    ? process.env.FILE_UPLOAD_ROOT.trim()
    : path.join(process.cwd(), "uploads");
}

export function cleanFileName(name: string): string {
  const base = path.basename(String(name || "").trim() || "file");
  const cleaned = base.replace(/[^a-zA-Z0-9._ -]/g, "_");
  return cleaned.length ? cleaned : "file";
}

export function getExtension(name: string): string {
  return path.extname(name || "").toLowerCase();
}

export function assertAllowedFileName(name: string) {
  const ext = getExtension(name);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type not allowed: ${ext || "unknown"}`);
  }
}

export function assertAllowedMimeType(mimeType: string | null | undefined) {
  const mt = String(mimeType || "").trim().toLowerCase();
  if (!mt) return; // allow blank from browser/OS if extension is valid
  if (!ALLOWED_MIME_TYPES.has(mt)) {
    throw new Error(`MIME type not allowed: ${mt}`);
  }
}

export function canInlineMimeType(mimeType: string | null | undefined): boolean {
  const mt = String(mimeType || "").trim().toLowerCase();
  return INLINE_MIME_TYPES.has(mt);
}

export function buildEntityFolder(entityType: string, entityId: string): string {
  const safeType = String(entityType || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeId = String(entityId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");

  if (!safeType) throw new Error("Invalid entityType");
  if (!safeId) throw new Error("Invalid entityId");

  return path.join(safeType, safeId);
}

export async function saveUploadedFile(args: {
  entityType: string;
  entityId: string;
  originalFileName: string;
  mimeType?: string | null;
  bytes: Buffer;
}) {
  const originalFileName = cleanFileName(args.originalFileName);

  assertAllowedFileName(originalFileName);
  assertAllowedMimeType(args.mimeType);

  if (!args.bytes.length) {
    throw new Error("File is empty");
  }
  if (args.bytes.length > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds max size of ${MAX_UPLOAD_BYTES} bytes`);
  }

  const ext = getExtension(originalFileName);
  const storedFileName = `${Date.now()}-${randomUUID()}${ext}`;

  const folder = buildEntityFolder(args.entityType, args.entityId);
  const relativePath = path.join(folder, storedFileName);
  const absolutePath = path.join(getUploadRoot(), relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, args.bytes);

  return {
    originalFileName,
    storedFileName,
    storedRelativePath: relativePath,
    absolutePath,
    fileSizeBytes: args.bytes.length,
  };
}

export async function deleteStoredFile(relativePath: string): Promise<void> {
  try {
    const absolutePath = path.join(getUploadRoot(), relativePath);
    await unlink(absolutePath);
  } catch {
    // ignore missing file
  }
}

export async function getStoredAbsolutePath(relativePath: string): Promise<string> {
  const safeRelative = String(relativePath || "").trim();
  if (!safeRelative) throw new Error("Invalid file path");

  const absolutePath = path.join(getUploadRoot(), safeRelative);
  await stat(absolutePath);
  return absolutePath;
}