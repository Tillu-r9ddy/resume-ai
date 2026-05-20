/**
 * seedResume — a sample resume so the editor has something to show on first
 * run, plus per-section factory helpers used by the slice's addSection reducer.
 *
 * Keep this file pure (no Redux imports, no React imports). It's just data
 * generation — that makes it trivially unit-testable and safe to reuse from
 * tests, storybooks, or seed scripts later.
 */
import {
  newId,
  type EducationItem,
  type ExperienceItem,
  type Header,
  type ProjectItem,
  type Resume,
  type Section,
  type SectionType,
  type SkillsItem,
} from '../schema/resume';

// ─────────────────────────────────────────────────────────────────────────────
// Per-type item factories
// ─────────────────────────────────────────────────────────────────────────────
// Why factories instead of inline literals at every call site?
//   • One place that owns "what does an empty Experience item look like?"
//   • Centralises crypto.randomUUID() so we never forget an id field
//   • Easy to evolve when a new required field is added to the schema

export const makeHeader = (): Header => ({
  id: newId(),
  fullName: '',
  headline: '',
  email: '',
  phone: '',
  location: '',
  links: [],
});

export const makeExperienceItem = (): ExperienceItem => ({
  id: newId(),
  company: '',
  title: '',
  location: '',
  start: '2024-01',
  end: null,
  bullets: [],
});

export const makeEducationItem = (): EducationItem => ({
  id: newId(),
  school: '',
  degree: '',
  field: '',
  start: '2020-09',
  end: '2024-06',
});

export const makeSkillsItem = (): SkillsItem => ({
  id: newId(),
  group: '',
  items: [],
});

export const makeProjectItem = (): ProjectItem => ({
  id: newId(),
  name: '',
  summary: '',
  bullets: [],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section factory — one switch over SectionType so the slice never has to
// know the per-type details. Exhaustiveness check guards future additions:
// adding a new SectionType without updating this switch becomes a TS error.
// ─────────────────────────────────────────────────────────────────────────────

export function makeSection(type: SectionType): Section {
  switch (type) {
    case 'header':
      return { id: newId(), type: 'header', data: makeHeader() };
    case 'experience':
      return { id: newId(), type: 'experience', items: [makeExperienceItem()] };
    case 'education':
      return { id: newId(), type: 'education', items: [makeEducationItem()] };
    case 'skills':
      return { id: newId(), type: 'skills', items: [makeSkillsItem()] };
    case 'projects':
      return { id: newId(), type: 'projects', items: [makeProjectItem()] };
    default: {
      // Exhaustiveness: if SectionType grows, this line stops compiling.
      const _exhaustive: never = type;
      throw new Error(`Unhandled section type: ${String(_exhaustive)}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The seed — a believable starter resume
// ─────────────────────────────────────────────────────────────────────────────

export function seedResume(): Resume {
  return {
    id: newId(),
    title: 'My Resume',
    sections: [
      {
        id: newId(),
        type: 'header',
        data: {
          id: newId(),
          fullName: 'Ada Lovelace',
          headline: 'Mathematician · First Computer Programmer',
          email: 'ada@example.com',
          phone: '+44 20 7946 0958',
          location: 'London, UK',
          links: [
            { label: 'GitHub', url: 'https://github.com/ada' },
            { label: 'Site', url: 'https://example.com' },
          ],
        },
      },
      {
        id: newId(),
        type: 'experience',
        items: [
          {
            id: newId(),
            company: 'Analytical Engine Ltd',
            title: 'Lead Programmer',
            location: 'London, UK',
            start: '1842-01',
            end: null,
            bullets: [
              'Wrote the first algorithm intended to be processed by a machine.',
              'Translated Menabrea’s memoir and added extensive original notes.',
            ],
          },
        ],
      },
      {
        id: newId(),
        type: 'skills',
        items: [
          { id: newId(), group: 'Languages', items: ['English', 'French', 'Latin'] },
          { id: newId(), group: 'Tools', items: ['Difference Engine', 'Punch cards'] },
        ],
      },
    ],
  };
}
