/**
 * resume.ts — the resume document's schema (Zod) and inferred TypeScript types.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why Zod?
 * ─────────────────────────────────────────────────────────────────────────────
 *   Zod gives us THREE things from one declaration:
 *     1. A runtime parser  (validate untrusted input — e.g. JSON loaded from
 *        localStorage that may be from a previous schema version)
 *     2. A TypeScript type (via z.infer<>)
 *     3. A spec to wire to React Hook Form in Phase 4b via zodResolver
 *
 *   Alternatives we considered:
 *     • Yup        — older, less TS-friendly, validators less composable
 *     • Joi        — Node-shaped API, not built for TS-first
 *     • io-ts      — beautiful but unfamiliar to most React devs (fp-ts world)
 *     • Effect.Schema — powerful but adds an entire ecosystem
 *     • Zod        — de-facto standard in 2026 React/Next/RHF/tRPC tooling
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why a discriminated union over Section?
 * ─────────────────────────────────────────────────────────────────────────────
 *   A polymorphic "Section with optional fields" forces every consumer to
 *   defensive-check fields:    if ('items' in section) { ... }
 *   A discriminated union on `type` lets TS narrow automatically:
 *       if (section.type === 'experience') section.items  // typed!
 *   Zod's z.discriminatedUnion produces precise error messages too — instead of
 *   "Section invalid" you get "experience.items[0].company required".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Read order:
 *   1. Primitive helpers           (`YearMonth`, link/url checks)
 *   2. Per-section item schemas    (Experience, Education, Skills, Project)
 *   3. Header (the singleton)      (data, not items)
 *   4. Discriminated Section union
 *   5. Resume (the document root)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable identity. Browsers + Node 19+ ship crypto.randomUUID; Vite's dev server
 * runs on localhost so the secure-context requirement is met. Tests that don't
 * use jsdom 24+ will need a polyfill (cross-that-bridge in Phase 8).
 */
export const newId = (): string => crypto.randomUUID();

/**
 * YearMonth — a "YYYY-MM" string. Resumes rarely need day-level precision and
 * date pickers feel heavy. The regex enforces a real month (01–12).
 *
 * Storing as a string keeps the JSON portable (vs Date objects, which don't
 * survive JSON.stringify/parse round-trips without custom reviver functions).
 */
export const YearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/u, 'Must be YYYY-MM');
export type YearMonth = z.infer<typeof YearMonthSchema>;

/**
 * `null` = "Present" — the canonical sentinel for a currently-held role or
 * in-progress education. Avoids a magic string ("present", "current", etc.)
 * that would need locale-specific UI handling.
 */
const EndYearMonth = YearMonthSchema.nullable();

const LinkSchema = z.object({
  label: z.string().min(1).max(40),
  url: z.string().url('Must be a valid URL'),
});
export type Link = z.infer<typeof LinkSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Section item schemas
// ─────────────────────────────────────────────────────────────────────────────

export const ExperienceItemSchema = z.object({
  id: z.string().uuid(),
  company: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  location: z.string().max(120).default(''),
  start: YearMonthSchema,
  end: EndYearMonth,
  /**
   * Bullets stored as an array of strings, not a single newline-joined string.
   * Why? React Hook Form's useFieldArray works on arrays. Storing newlines
   * would push bullet-parsing logic into every render.
   */
  bullets: z.array(z.string().min(1).max(500)).max(20).default([]),
});
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;

export const EducationItemSchema = z.object({
  id: z.string().uuid(),
  school: z.string().min(1).max(160),
  degree: z.string().min(1).max(160),
  field: z.string().max(160).default(''),
  start: YearMonthSchema,
  end: EndYearMonth,
  gpa: z.string().max(20).optional(),
});
export type EducationItem = z.infer<typeof EducationItemSchema>;

export const SkillsItemSchema = z.object({
  id: z.string().uuid(),
  group: z.string().min(1).max(60), // e.g. "Languages", "Frameworks"
  items: z.array(z.string().min(1).max(60)).max(40).default([]),
});
export type SkillsItem = z.infer<typeof SkillsItemSchema>;

export const ProjectItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  summary: z.string().max(400).default(''),
  link: z.string().url().optional(),
  bullets: z.array(z.string().min(1).max(500)).max(20).default([]),
});
export type ProjectItem = z.infer<typeof ProjectItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Header (singleton — at most one per resume)
// ─────────────────────────────────────────────────────────────────────────────

export const HeaderSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1).max(160),
  headline: z.string().max(200).default(''),
  email: z.string().email().or(z.literal('')).default(''),
  phone: z.string().max(40).default(''),
  location: z.string().max(160).default(''),
  links: z.array(LinkSchema).max(10).default([]),
});
export type Header = z.infer<typeof HeaderSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Section — discriminated union on `type`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SectionType — kept as a const tuple so it's both a runtime list (we iterate
 * it to build the "Add section" menu) AND a TS union (via typeof).
 */
export const SECTION_TYPES = ['header', 'experience', 'education', 'skills', 'projects'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SectionSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().uuid(),
    type: z.literal('header'),
    /** Header is a SINGLETON — one record, not an array of items. */
    data: HeaderSchema,
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal('experience'),
    items: z.array(ExperienceItemSchema).default([]),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal('education'),
    items: z.array(EducationItemSchema).default([]),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal('skills'),
    items: z.array(SkillsItemSchema).default([]),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal('projects'),
    items: z.array(ProjectItemSchema).default([]),
  }),
]);
export type Section = z.infer<typeof SectionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Resume (document root)
// ─────────────────────────────────────────────────────────────────────────────

export const ResumeSchema = z.object({
  id: z.string().uuid(),
  /** Title shown in the UI / file-name when exported. Not the candidate's name. */
  title: z.string().min(1).max(120),
  /**
   * Sections array. Order = render order. Reordering is just splicing this
   * array — that's why we don't keep a separate `sectionOrder` field.
   */
  sections: z.array(SectionSchema).default([]),
});
export type Resume = z.infer<typeof ResumeSchema>;
