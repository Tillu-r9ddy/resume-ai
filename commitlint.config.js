/**
 * Commitlint configuration — enforces Conventional Commits format.
 *
 * WHY enforce a commit format?
 *   1. Recruiters scan your git log. Messy commits ("fix stuff", "asdf") look amateur.
 *   2. Tools like `semantic-release` and `standard-version` parse this format to auto-
 *      generate CHANGELOGs and bump SemVer.
 *   3. In senior interviews you'll be asked "how does your team manage commits?" —
 *      having a real answer ("Conventional Commits enforced via commitlint+husky") wins.
 *
 * Format:  <type>(<optional scope>): <subject>
 * Examples:
 *   feat(chat): add streaming response to AI assistant
 *   fix(auth): handle expired JWT on refresh
 *   chore(deps): bump react to 19.2.7
 *   docs(readme): explain state management decision tree
 *
 * Allowed types come from @commitlint/config-conventional:
 *   build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Subject must be ≤ 72 chars — git's display column limit.
    'subject-max-length': [2, 'always', 72],
    // Don't end the subject with a period — convention everywhere from Linux kernel onward.
    'subject-full-stop': [2, 'never', '.'],
    // Body lines wrap at 100 chars for readability in terminals.
    'body-max-line-length': [2, 'always', 100],
  },
};
