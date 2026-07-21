/**
 * Zod schemas: the contract for AI extraction output *and* incoming API
 * request bodies. AI responses are validated here; if they fail, the caller
 * retries once with a repair prompt and otherwise marks the doc NEEDS_REVIEW.
 */
import { z } from "zod";

// ── Shared enums ──────────────────────────────────────────────────────────────

export const levelNameSchema = z.enum(["None", "Basic", "Intermediate", "Advanced", "Expert"]);
export const importanceSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const documentTypeSchema = z.enum([
  "DAILY_REPORT",
  "CPD_RECORD",
  "ROLE_REQUIREMENT",
  "JOB_DESCRIPTION",
  "MANAGER_EVALUATION",
  "SKILL_MATRIX",
]);
export type DocumentTypeInput = z.infer<typeof documentTypeSchema>;

// ── AI: employee skill extraction ─────────────────────────────────────────────
// Used for daily reports, CPD records, manager evaluations, skill matrices.

export const detectedSkillSchema = z.object({
  skill: z.string().min(1),
  estimatedLevel: levelNameSchema,
  /** Only set when the document explicitly states a target/expected level for this skill. */
  targetLevel: levelNameSchema.nullable().default(null),
  evidence: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0.6),
});
export type DetectedSkill = z.infer<typeof detectedSkillSchema>;

export const employeeExtractionSchema = z.object({
  employeeName: z.string().nullable().default(null),
  sourceType: z.string().default("unknown"),
  detectedSkills: z.array(detectedSkillSchema).default([]),
});
export type EmployeeExtraction = z.infer<typeof employeeExtractionSchema>;

// ── AI: role / job-description extraction ─────────────────────────────────────

export const requiredSkillSchema = z.object({
  skill: z.string().min(1),
  requiredLevel: levelNameSchema,
  importance: importanceSchema.default("MEDIUM"),
  reason: z.string().default(""),
});
export type RequiredSkill = z.infer<typeof requiredSkillSchema>;

export const roleExtractionSchema = z.object({
  roleTitle: z.string().min(1),
  requiredSkills: z.array(requiredSkillSchema).default([]),
});
export type RoleExtraction = z.infer<typeof roleExtractionSchema>;

// ── AI: skill normalisation fallback ──────────────────────────────────────────

export const skillNormalizationSchema = z.object({
  canonical: z.string().min(1),
  isNew: z.boolean().default(true),
});

// ── Request bodies ────────────────────────────────────────────────────────────

export const processDocumentBodySchema = z
  .object({
    userId: z.string().optional(),
    roleTitle: z.string().optional(),
    departmentId: z.string().optional(),
    // Skip AI and store raw parse only (useful when no GEMINI_API_KEY).
    extractOnly: z.boolean().optional(),
  })
  .default({});

export const courseSkillInputSchema = z.object({
  skill: z.string().min(1),
  weight: z.number().positive().optional(),
});

export const courseImportItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  provider: z.string().optional(),
  source: z.enum(["coursera", "edx", "linkedin", "internal"]).optional(),
  externalUrl: z.string().url().optional().or(z.literal("")),
  externalId: z.string().optional(),
  level: z.string().optional(), // Beginner | Intermediate | Advanced
  durationHours: z.number().nonnegative().optional(),
  cpdHours: z.number().nonnegative().optional(),
  costType: z.string().optional(), // free | paid | subscription
  language: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  approved: z.boolean().optional(),
  preferredProvider: z.boolean().optional(),
  availableToOrg: z.boolean().optional(),
  category: z.string().optional(),
  skills: z.array(z.union([z.string(), courseSkillInputSchema])).default([]),
});
export type CourseImportItem = z.infer<typeof courseImportItemSchema>;

export const courseImportBodySchema = z.object({
  courses: z.array(courseImportItemSchema).min(1),
  approveAll: z.boolean().optional(),
  publish: z.boolean().optional(),
});

export const apifySyncBodySchema = z.object({
  datasetId: z.string().optional(),
  actorId: z.string().optional(),
  runId: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  approveAll: z.boolean().optional(),
  publish: z.boolean().optional(),
});

export const edxSyncBodySchema = z
  .object({
    query: z.string().optional(),
    limit: z.number().int().positive().max(200).optional(),
    approveAll: z.boolean().optional(),
    publish: z.boolean().optional(),
  })
  .default({});

export const generateRecommendationsBodySchema = z
  .object({
    limit: z.number().int().positive().max(20).optional(),
    explain: z.boolean().optional(), // force / skip AI explanation
    rerunGaps: z.boolean().optional(),
  })
  .default({});

// ── Recommendation chat ───────────────────────────────────────────────────────

export const chatAnswersSchema = z
  .object({
    timeCommitment: z.string().optional(),
    providers: z.array(z.string()).optional(),
    goal: z.string().optional(),
    difficulty: z.string().optional(),
  })
  .default({});

export const recommendationChatBodySchema = z
  .object({
    answers: chatAnswersSchema,
    limit: z.number().int().positive().max(6).optional(),
  })
  .default({});

/** Document types an employee may upload for themselves via the chat. */
export const employeeDocumentTypeSchema = z.enum(["SKILL_MATRIX", "CPD_RECORD", "DAILY_REPORT"]);
