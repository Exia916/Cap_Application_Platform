import path from "path";
import { randomUUID } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  type GetObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_MAX_UPLOAD_MB = 100;
const DEFAULT_PRESIGNED_TTL_SECONDS = 60 * 60 * 24; // 24h

const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".msi",
  ".bat",
  ".cmd",
  ".ps1",
  ".vbs",
  ".js",
  ".jse",
  ".scr",
  ".com",
  ".pif",
  ".jar",
  ".sh",
  ".reg",
  ".hta",
  ".apk",
  ".app",
  ".deb",
  ".pkg",
  ".dmg",
  ".iso",
]);

const INLINE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "text/plain",
  "text/csv",
]);

function requiredEnv(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function safeEntityPart(value: string): string {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function encodeCopySource(bucket: string, key: string): string {
  const encodedKey = String(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${encodeURIComponent(bucket)}/${encodedKey}`;
}

export function getBucketName(): string {
  return requiredEnv("S3_ATTACHMENTS_BUCKET");
}

export function getBucketRegion(): string {
  return requiredEnv("AWS_REGION");
}

export function getAttachmentsPrefix(): string {
  return String(process.env.S3_ATTACHMENTS_PREFIX ?? "design-workflow")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

export function getMaxUploadBytes(): number {
  const mb = parsePositiveInt(process.env.ATTACHMENTS_MAX_UPLOAD_MB, DEFAULT_MAX_UPLOAD_MB);
  return mb * 1024 * 1024;
}

export function getPresignedUrlTtlSeconds(): number {
  return parsePositiveInt(
    process.env.S3_PRESIGNED_URL_TTL_SECONDS,
    DEFAULT_PRESIGNED_TTL_SECONDS
  );
}

let s3ClientSingleton: S3Client | null = null;

export function getS3Client(): S3Client {
  if (s3ClientSingleton) return s3ClientSingleton;

  s3ClientSingleton = new S3Client({
    region: getBucketRegion(),
    credentials: {
      accessKeyId: requiredEnv("AWS_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("AWS_SECRET_ACCESS_KEY"),
    },
  });

  return s3ClientSingleton;
}

export function cleanFileName(name: string): string {
  const base = path.basename(String(name || "").trim() || "file");
  const cleaned = base.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : "file";
}

export function getExtension(name: string): string {
  return path.extname(name || "").toLowerCase();
}

export function assertAllowedFileName(name: string) {
  const ext = getExtension(name);
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    throw new Error(`File type not allowed: ${ext}`);
  }
}

export function assertAllowedMimeType(_mimeType: string | null | undefined) {
  return;
}

export function canInlineMimeType(mimeType: string | null | undefined): boolean {
  const mt = String(mimeType || "").trim().toLowerCase();
  return INLINE_MIME_TYPES.has(mt);
}

export function buildObjectKey(args: {
  entityType: string;
  entityId: string;
  storedFileName: string;
}): string {
  const prefix = getAttachmentsPrefix();
  const safeType = safeEntityPart(args.entityType);
  const safeId = safeEntityPart(args.entityId);

  if (!safeType) throw new Error("Invalid entityType");
  if (!safeId) throw new Error("Invalid entityId");

  const parts = [prefix, safeType, safeId, args.storedFileName].filter(Boolean);
  return parts.join("/");
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
    throw new Error("File is empty.");
  }

  const maxBytes = getMaxUploadBytes();
  if (args.bytes.length > maxBytes) {
    throw new Error(`File exceeds max size of ${Math.floor(maxBytes / (1024 * 1024))} MB.`);
  }

  const ext = getExtension(originalFileName);
  const storedFileName = `${Date.now()}-${randomUUID()}${ext}`;
  const objectKey = buildObjectKey({
    entityType: args.entityType,
    entityId: args.entityId,
    storedFileName,
  });

  const put = await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey,
      Body: args.bytes,
      ContentType: String(args.mimeType || "").trim() || undefined,
      Metadata: {
        entity_type: safeEntityPart(args.entityType),
        entity_id: safeEntityPart(args.entityId),
        original_file_name: originalFileName,
      },
    })
  );

  return {
    originalFileName,
    storedFileName,
    storedRelativePath: objectKey,
    objectKey,
    bucketName: getBucketName(),
    objectVersionId: put.VersionId ?? null,
    fileSizeBytes: args.bytes.length,
  };
}

export async function copyStoredFileToEntity(args: {
  sourceBucketName?: string | null;
  sourceObjectKey: string;
  entityType: string;
  entityId: string;
  originalFileName: string;
  mimeType?: string | null;
}) {
  const originalFileName = cleanFileName(args.originalFileName);
  assertAllowedFileName(originalFileName);
  assertAllowedMimeType(args.mimeType);

  const sourceBucket = String(args.sourceBucketName || "").trim() || getBucketName();
  const sourceObjectKey = String(args.sourceObjectKey || "").trim();

  if (!sourceObjectKey) {
    throw new Error("Source object key is required.");
  }

  const ext = getExtension(originalFileName);
  const storedFileName = `${Date.now()}-${randomUUID()}${ext}`;
  const objectKey = buildObjectKey({
    entityType: args.entityType,
    entityId: args.entityId,
    storedFileName,
  });

  const copy = await getS3Client().send(
    new CopyObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey,
      CopySource: encodeCopySource(sourceBucket, sourceObjectKey),
      ContentType: String(args.mimeType || "").trim() || undefined,
      MetadataDirective: "REPLACE",
      Metadata: {
        entity_type: safeEntityPart(args.entityType),
        entity_id: safeEntityPart(args.entityId),
        original_file_name: originalFileName,
      },
    })
  );

  return {
    originalFileName,
    storedFileName,
    storedRelativePath: objectKey,
    objectKey,
    bucketName: getBucketName(),
    objectVersionId: copy.VersionId ?? null,
    fileSizeBytes: null as number | null,
  };
}

export async function getPresignedReadUrl(args: {
  bucketName?: string | null;
  objectKey: string;
  originalFileName: string;
  mimeType?: string | null;
  disposition?: "inline" | "attachment";
  expiresInSeconds?: number;
}) {
  const bucket = String(args.bucketName || "").trim() || getBucketName();
  const disposition = args.disposition ?? "inline";
  const filename = cleanFileName(args.originalFileName);
  const contentDisposition = `${disposition}; filename="${filename}"`;

  const input: GetObjectCommandInput = {
    Bucket: bucket,
    Key: args.objectKey,
    ResponseContentDisposition: contentDisposition,
  };

  if (String(args.mimeType || "").trim()) {
    input.ResponseContentType = String(args.mimeType).trim();
  }

  return getSignedUrl(getS3Client(), new GetObjectCommand(input), {
    expiresIn: args.expiresInSeconds ?? getPresignedUrlTtlSeconds(),
  });
}

export async function deleteStoredFile(_relativePath: string): Promise<void> {
  // Phase 1 uses soft delete only. Keep physical S3 objects for audit/recovery.
}

export async function getStoredAbsolutePath(_relativePath: string): Promise<string> {
  throw new Error("Local filesystem access is not used for attachments stored in S3.");
}
