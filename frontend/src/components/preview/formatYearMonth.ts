/**
 * Tiny formatter for YYYY-MM date strings → human-readable "Mon YYYY".
 * Used by Experience and Education previews so date rendering is consistent.
 *
 * Why a separate file? Because formatting is cross-cutting: PDF generation
 * in Phase 7 will need the same logic, and tests in Phase 8 want it
 * importable in isolation.
 */
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatYearMonth(value: string | null): string {
  if (value === null) return 'Present';
  // YearMonth schema guarantees `\d{4}-\d{2}` but we defend lightly.
  const [year, month] = value.split('-');
  const monthIdx = month ? Number(month) - 1 : -1;
  if (!year || monthIdx < 0 || monthIdx > 11) return value;
  return `${MONTH_NAMES[monthIdx]} ${year}`;
}

export function formatYearMonthRange(start: string, end: string | null): string {
  return `${formatYearMonth(start)} — ${formatYearMonth(end)}`;
}
