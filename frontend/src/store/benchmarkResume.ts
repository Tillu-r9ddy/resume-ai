/**
 * benchmarkResume — a deliberately large resume document for Phase 5 perf work.
 *
 * Why this exists:
 *   Profiling the seed resume (~3 sections, ~3 items) doesn't surface render-
 *   cost problems — everything is fast at that scale. To see whether a Preview
 *   re-render really is wasted work, we need a document with enough sections
 *   and items that each unnecessary re-render is *visible* in the React
 *   Profiler. This file produces one: 1 header + 15 experience + 6 education
 *   + 8 skills groups + 10 projects, with realistic bullet counts.
 *
 * It's not used in production code paths — only via the "Load benchmark
 * resume" dev button in SectionManager (gated on `import.meta.env.DEV`).
 * Stays out of the prod bundle because Vite tree-shakes the dev branch.
 *
 * Determinism:
 *   Item ids still use `newId()` so each load produces unique uuids — that's
 *   important because the schema requires unique ids and reducers key off
 *   them. Field values are static so memo() comparisons see stable shapes.
 */
import { newId, type Resume } from '../schema/resume';

const EXPERIENCE_BULLETS = [
  'Owned the migration from REST to gRPC, cutting p99 latency 38% across the catalog tier.',
  'Mentored two junior engineers through promotion; one is now my tech lead.',
  'Designed the rollout for a multi-region active-active deploy with zero downtime.',
  'Killed a six-month-old flaky-test infestation by introducing per-suite isolation.',
  'Wrote the team’s on-call runbook; pages dropped from 14/week to 3/week within two months.',
];

const PROJECT_BULLETS = [
  'Shipped the v1 in 5 weeks, including a custom collaboration layer over CRDTs.',
  'Earned 4.2k GitHub stars and grew the contributor base to 38 active maintainers.',
  'Benchmarked the renderer 6× faster than the reference implementation.',
];

const SKILLS_GROUPS: { group: string; items: string[] }[] = [
  { group: 'Languages', items: ['TypeScript', 'Python', 'Go', 'Rust', 'SQL'] },
  { group: 'Frontend', items: ['React', 'Next.js', 'Vite', 'Tailwind', 'Radix UI'] },
  { group: 'Backend', items: ['Node.js', 'FastAPI', 'Postgres', 'Redis', 'Kafka'] },
  { group: 'Infra', items: ['AWS', 'Terraform', 'Docker', 'Kubernetes', 'GitHub Actions'] },
  { group: 'Observability', items: ['Datadog', 'OpenTelemetry', 'Grafana', 'Prometheus'] },
  { group: 'Data', items: ['BigQuery', 'dbt', 'Airflow', 'Snowflake'] },
  { group: 'Testing', items: ['Vitest', 'Playwright', 'pytest', 'Testing Library'] },
  { group: 'Soft Skills', items: ['Mentoring', 'Public speaking', 'Technical writing'] },
];

const COMPANY_NAMES = [
  'Stripe',
  'Cloudflare',
  'Vercel',
  'Linear',
  'Notion',
  'Figma',
  'Datadog',
  'Shopify',
  'Anthropic',
  'Sentry',
  'PlanetScale',
  'Supabase',
  'GitHub',
  'GitLab',
  'Render',
];

const SCHOOLS = [
  { school: 'Carnegie Mellon University', degree: 'M.S.', field: 'Computer Science' },
  { school: 'University of Waterloo', degree: 'B.S.', field: 'Software Engineering' },
  { school: 'ETH Zürich', degree: 'M.S.', field: 'Distributed Systems' },
  { school: 'IIT Bombay', degree: 'B.Tech', field: 'Computer Science' },
  { school: 'University of Toronto', degree: 'B.S.', field: 'Mathematics' },
  { school: 'Stanford University', degree: 'Ph.D.', field: 'Programming Languages' },
];

const PROJECT_NAMES = [
  'planq',
  'glasshouse',
  'orbital',
  'pebble',
  'monolith-killer',
  'shadowsail',
  'inkwell',
  'driftwood',
  'sparkline',
  'lighthouse-cli',
];

export function benchmarkResume(): Resume {
  return {
    id: newId(),
    title: 'Phase 5 Benchmark Resume',
    sections: [
      {
        id: newId(),
        type: 'header',
        data: {
          id: newId(),
          fullName: 'Benchmark Candidate',
          headline: 'Staff Engineer · Distributed systems · Frontend platform',
          email: 'candidate@example.com',
          phone: '+1 (415) 555-0142',
          location: 'San Francisco, CA',
          links: [
            { label: 'GitHub', url: 'https://github.com/example' },
            { label: 'Site', url: 'https://example.com' },
            { label: 'LinkedIn', url: 'https://www.linkedin.com/in/example' },
          ],
        },
      },
      {
        id: newId(),
        type: 'experience',
        items: COMPANY_NAMES.map((company, i) => ({
          id: newId(),
          company,
          title: i % 3 === 0 ? 'Staff Engineer' : i % 2 === 0 ? 'Senior Engineer' : 'Engineer',
          location: i % 2 === 0 ? 'San Francisco, CA' : 'Remote',
          start: `20${10 + (i % 14)}-0${(i % 9) + 1}`,
          end: i === 0 ? null : `20${11 + (i % 13)}-0${((i + 3) % 9) + 1}`,
          bullets: EXPERIENCE_BULLETS.slice(0, 3 + (i % 3)),
        })),
      },
      {
        id: newId(),
        type: 'education',
        items: SCHOOLS.map((s, i) => ({
          id: newId(),
          school: s.school,
          degree: s.degree,
          field: s.field,
          start: `20${10 + i}-09`,
          end: `20${12 + i}-06`,
        })),
      },
      {
        id: newId(),
        type: 'skills',
        items: SKILLS_GROUPS.map((g) => ({
          id: newId(),
          group: g.group,
          items: g.items,
        })),
      },
      {
        id: newId(),
        type: 'projects',
        items: PROJECT_NAMES.map((name, i) => ({
          id: newId(),
          name,
          summary: `An open-source ${name} that does one thing very well.`,
          bullets: PROJECT_BULLETS.slice(0, 2 + (i % 2)),
        })),
      },
    ],
  };
}
