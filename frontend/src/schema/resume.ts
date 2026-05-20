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

/**
 * LinkSchema — header.links[] entries.
 *
 * Why both fields accept the empty string?
 *   When the user clicks "+ Add link" we push an empty `{ label: '', url: '' }`
 *   row into the field array. If the schema required a valid URL immediately,
 *   the just-added row would be in an error state before the user could type.
 *   Allowing `''` keeps the editing experience clean; the *final* check that
 *   no half-filled links escape (e.g., label set but url empty) is a job for
 *   a later "validate before export" pass — not for per-field validation
 *   during editing.
 *
 * Why no `.default('')` despite the field being "optional-ish"?
 *   `.default()` makes the schema *input* type optional while leaving the
 *   *output* type required — that asymmetry breaks zodResolver's TS
 *   generics (RHF infers input type for field tracking, output type for
 *   submission). Our factories (seedResume.ts) always emit every field, so
 *   defaults carry no weight in practice. The empty-string allowance comes
 *   from the union, not from a default.
 */
const LinkSchema = z.object({
  label: z.string().max(40),
  url: z.union([z.string().url('Must be a valid URL'), z.literal('')]),
});
export type Link = z.infer<typeof LinkSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Section item schemas
// ─────────────────────────────────────────────────────────────────────────────

export const ExperienceItemSchema = z.object({
  id: z.string().uuid(),
  company: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  location: z.string().max(120),
  start: YearMonthSchema,
  end: EndYearMonth,
  /**
   * Bullets stored as an array of strings, not a single newline-joined string.
   * Why? React Hook Form's useFieldArray works on arrays. Storing newlines
   * would push bullet-parsing logic into every render.
   */
  bullets: z.array(z.string().min(1).max(500)).max(20),
});
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;

export const EducationItemSchema = z.object({
  id: z.string().uuid(),
  school: z.string().min(1).max(160),
  degree: z.string().min(1).max(160),
  field: z.string().max(160),
  start: YearMonthSchema,
  end: EndYearMonth,
  gpa: z.string().max(20).optional(),
});
export type EducationItem = z.infer<typeof EducationItemSchema>;

export const SkillsItemSchema = z.object({
  id: z.string().uuid(),
  group: z.string().min(1).max(60), // e.g. "Languages", "Frameworks"
  items: z.array(z.string().min(1).max(60)).max(40),
});
export type SkillsItem = z.infer<typeof SkillsItemSchema>;

export const ProjectItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  summary: z.string().max(400),
  link: z.union([z.string().url(), z.literal('')]).optional(),
  bullets: z.array(z.string().min(1).max(500)).max(20),
});
export type ProjectItem = z.infer<typeof ProjectItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Header (singleton — at most one per resume)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * No `.default()` calls here — see the same note on LinkSchema. Factories
 * always emit every field, so the editing form never has to fill them in.
 * `min(1)` is omitted on fields we want the user to be able to leave blank
 * during editing (headline, phone, location); a separate "ready to export?"
 * validator can tighten this later.
 */
export const HeaderSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1, 'Required').max(160),
  headline: z.string().max(200),
  email: z.union([z.string().email('Invalid email'), z.literal('')]),
  phone: z.string().max(40),
  location: z.string().max(160),
  links: z.array(LinkSchema).max(10),
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
    items: z.array(ExperienceItemSchema),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal('education'),
    items: z.array(EducationItemSchema),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal('skills'),
    items: z.array(SkillsItemSchema),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal('projects'),
    items: z.array(ProjectItemSchema),
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
  sections: z.array(SectionSchema),
});
export type Resume = z.infer<typeof ResumeSchema>;
