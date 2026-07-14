/**
 * Document service: upload persistence + the parse → extract → store pipeline.
 *
 * Upload stores the file bytes and a Document row (status UPLOADED).
 * Processing parses it, runs the right AI extraction (employee vs. role),
 * validates+repairs, stores the structured results, and moves the document to
 * PROCESSED or NEEDS_REVIEW.
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Document, DocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDocument } from "@/server/parsing/documentParser";
import { extractEmployeeSkills, extractRoleRequirements } from "@/server/ai/skillExtraction";
import { storeEmployeeSkills, storeRoleRequirements } from "@/server/gaps/gapAnalysis";
import { isConfigured } from "@/server/ai/aiClient";

const UPLOAD_DIR = process.env.UPLOAD_DIR?.trim() || path.join(process.cwd(), "uploads");

const EMPLOYEE_DOC_TYPES: DocumentType[] = [
  "DAILY_REPORT",
  "CPD_RECORD",
  "MANAGER_EVALUATION",
  "SKILL_MATRIX",
];
const ROLE_DOC_TYPES: DocumentType[] = ["ROLE_REQUIREMENT", "JOB_DESCRIPTION"];

export interface SaveUploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType?: string;
  type: DocumentType;
  userId?: string;
  roleTitle?: string;
}

export async function saveUpload(input: SaveUploadInput): Promise<Document> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = input.originalName.replace(/[^\w.\-]+/g, "_");
  const storagePath = path.join(UPLOAD_DIR, `${randomUUID()}-${safeName}`);
  await fs.writeFile(storagePath, input.buffer);

  return prisma.document.create({
    data: {
      type: input.type,
      originalName: input.originalName,
      mimeType: input.mimeType,
      storagePath,
      userId: input.userId,
      roleTitle: input.roleTitle,
      status: "UPLOADED",
    },
  });
}

export interface ProcessOptions {
  userId?: string;
  roleTitle?: string;
  departmentId?: string;
  extractOnly?: boolean; // parse + store text only, skip AI
}

export interface ProcessResult {
  documentId: string;
  status: Document["status"];
  type: DocumentType;
  extraction?: unknown;
  stored?: number;
  roleProfileId?: string;
  targetUserId?: string;
  message?: string;
}

async function markStatus(
  id: string,
  status: Document["status"],
  data: Prisma.DocumentUncheckedUpdateInput = {}
) {
  return prisma.document.update({ where: { id }, data: { status, ...data } });
}

export async function processDocument(documentId: string, opts: ProcessOptions = {}): Promise<ProcessResult> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found.");
  if (!doc.storagePath) throw new Error("Document has no stored file to process.");

  await markStatus(doc.id, "PROCESSING");

  // 1. Parse
  let parsedText: string;
  try {
    const buffer = await fs.readFile(doc.storagePath);
    const parsed = await parseDocument(buffer, doc.originalName, doc.mimeType ?? undefined);
    parsedText = parsed.text;
    await prisma.document.update({ where: { id: doc.id }, data: { parsedText } });
  } catch (err) {
    await markStatus(doc.id, "FAILED", { errorMessage: `Parse failed: ${(err as Error).message}` });
    return { documentId: doc.id, status: "FAILED", type: doc.type, message: (err as Error).message };
  }

  if (opts.extractOnly) {
    await markStatus(doc.id, "PROCESSED");
    return { documentId: doc.id, status: "PROCESSED", type: doc.type, message: "Parsed only (extractOnly)." };
  }

  const useAI = isConfigured();

  // 2/3. Extract → validate (+repair) → store
  if (EMPLOYEE_DOC_TYPES.includes(doc.type)) {
    const outcome = await extractEmployeeSkills(doc.type, parsedText);
    if (!outcome.ok) {
      await markStatus(doc.id, "NEEDS_REVIEW", { errorMessage: outcome.reason });
      return { documentId: doc.id, status: "NEEDS_REVIEW", type: doc.type, message: outcome.reason };
    }

    // Resolve which employee this belongs to.
    const targetUserId = await resolveEmployee(opts.userId ?? doc.userId, outcome.data.employeeName);
    if (!targetUserId) {
      await markStatus(doc.id, "NEEDS_REVIEW", {
        extraction: outcome.data as Prisma.InputJsonValue,
        errorMessage: `Could not resolve employee${outcome.data.employeeName ? ` "${outcome.data.employeeName}"` : ""}. Re-process with a userId.`,
      });
      return {
        documentId: doc.id,
        status: "NEEDS_REVIEW",
        type: doc.type,
        extraction: outcome.data,
        message: "Employee could not be resolved.",
      };
    }

    const { stored } = await storeEmployeeSkills(targetUserId, outcome.data.detectedSkills, { useAI });
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: "PROCESSED",
        extraction: outcome.data as Prisma.InputJsonValue,
        userId: targetUserId,
        errorMessage: null,
      },
    });
    return { documentId: doc.id, status: "PROCESSED", type: doc.type, extraction: outcome.data, stored, targetUserId };
  }

  if (ROLE_DOC_TYPES.includes(doc.type)) {
    const outcome = await extractRoleRequirements(doc.type, parsedText);
    if (!outcome.ok) {
      await markStatus(doc.id, "NEEDS_REVIEW", { errorMessage: outcome.reason });
      return { documentId: doc.id, status: "NEEDS_REVIEW", type: doc.type, message: outcome.reason };
    }
    const roleTitle = opts.roleTitle ?? doc.roleTitle ?? outcome.data.roleTitle;
    const { roleProfileId, stored } = await storeRoleRequirements(roleTitle, outcome.data.requiredSkills, {
      departmentId: opts.departmentId,
      useAI,
    });
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: "PROCESSED",
        extraction: outcome.data as Prisma.InputJsonValue,
        roleTitle,
        errorMessage: null,
      },
    });
    return { documentId: doc.id, status: "PROCESSED", type: doc.type, extraction: outcome.data, stored, roleProfileId };
  }

  await markStatus(doc.id, "NEEDS_REVIEW", { errorMessage: `Unsupported document type: ${doc.type}` });
  return { documentId: doc.id, status: "NEEDS_REVIEW", type: doc.type, message: "Unsupported document type." };
}

/** Resolve the target employee by explicit id first, then by extracted name. */
async function resolveEmployee(userId?: string | null, name?: string | null): Promise<string | null> {
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (u) return u.id;
  }
  if (name?.trim()) {
    const byName = await prisma.user.findFirst({
      where: { fullName: { equals: name.trim(), mode: "insensitive" } },
    });
    if (byName) return byName.id;
  }
  return null;
}
