/**
 * HeaderPreview — read-only render of the resume header.
 *
 * Design goals:
 *   • Looks like the printed page (whitespace, type hierarchy) so the preview
 *     pane sets honest expectations for the eventual PDF (Phase 7).
 *   • Plain HTML, no editor chrome. The preview is what you'd export.
 *   • Resilient to missing data — every field uses a fallback string or
 *     conditional render so a half-filled header doesn't crash the layout.
 *
 * Why a separate component per section type (not one giant Preview)?
 *   Each section type has its own visual structure (Experience = role +
 *   dates + bullets; Skills = grouped pills). Splitting per type keeps each
 *   renderer focused and lets us test/style them independently.
 */
import type { Header } from '../../schema/resume';

interface HeaderPreviewProps {
  header: Header;
}

export function HeaderPreview({ header }: HeaderPreviewProps): React.JSX.Element {
  // Build the contact line as an array first so we can join with a separator
  // only when there's an actual value (no trailing "·" for missing fields).
  const contactPieces = [header.email, header.phone, header.location].filter(
    (s) => s.trim().length > 0,
  );

  return (
    <header className="border-b border-border pb-4">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {header.fullName || <span className="italic text-ink-muted">Your name</span>}
      </h1>
      {header.headline && <p className="mt-1 text-sm text-ink-muted">{header.headline}</p>}

      {contactPieces.length > 0 && (
        <p className="mt-2 text-xs text-ink-muted">{contactPieces.join(' · ')}</p>
      )}

      {header.links.length > 0 && (
        <p className="mt-1 text-xs">
          {header.links
            .filter((l) => l.url || l.label)
            .map((link, i, arr) => (
              <span key={`${link.label}-${link.url}-${i}`}>
                {link.url ? (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    {link.label || link.url}
                  </a>
                ) : (
                  <span className="text-ink-muted">{link.label}</span>
                )}
                {i < arr.length - 1 && <span className="text-ink-muted"> · </span>}
              </span>
            ))}
        </p>
      )}
    </header>
  );
}
