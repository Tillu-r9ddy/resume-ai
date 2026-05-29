"""Resume document schemas — the Python mirror of frontend/src/schema/resume.ts.

WHY mirror the Zod schema in Pydantic instead of generating one from the other?
    Two parties validate the same payload — the browser (Zod) before it leaves
    and the server (Pydantic) when it arrives. Generation tools exist
    (json-schema-to-pydantic, etc.) but they add a build step and tend to
    smudge intent (e.g., losing the "either valid URL OR empty string" union).
    Two hand-written schemas, one shape, with this docstring as the contract
    note. If they drift, the OpenAPI schema published at /docs makes the
    diff obvious during code review.

WHY discriminated unions with `Field(discriminator="type")`?
    Same reason as Zod's z.discriminatedUnion: the server gets precise error
    messages ("experience.items[0].company: field required") instead of "no
    union member matched". Pydantic v2 also generates a cleaner OpenAPI
    schema with oneOf + discriminator instead of an opaque anyOf.

WHY split Read / Write models?
    On READ we always know the id (the server assigned it). On CREATE the
    client doesn't — it sends a body without `id` and gets one back. Using
    one model with `id: str | None` would leak that optionality into every
    caller. Two small models are clearer than one polymorphic one.
"""

from __future__ import annotations

import re
from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ── Primitives ───────────────────────────────────────────────────────────────

# Zod regex on the JS side: /^\d{4}-(0[1-9]|1[0-2])$/u — keep this in sync.
YEAR_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def _validate_year_month(value: str) -> str:
    if not YEAR_MONTH_RE.match(value):
        raise ValueError("Must be YYYY-MM")
    return value


# Annotated str so we get the constraint in OpenAPI + a custom validator. Plain
# `constr(pattern=...)` would work too but Annotated lets us share the same
# validation function in both required and nullable forms.
YearMonth = Annotated[str, Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]
OptionalYearMonth = YearMonth | None


class Link(BaseModel):
    """A header link — empty strings allowed during editing.

    Why allow empty strings even though the Zod side does the same?
        When the user clicks "+ Add link" the frontend pushes a blank row;
        rejecting it server-side would break autosave. Final "ready to
        publish?" validation is a separate concern (see issue tracker).
    """

    model_config = ConfigDict(extra="forbid")

    label: str = Field(max_length=40)
    url: str = Field(max_length=2000)

    @field_validator("url")
    @classmethod
    def _allow_empty_or_valid_url(cls, value: str) -> str:
        if value == "":
            return value
        # Cheap URL check — full RFC 3986 is overkill for this. The browser
        # produced this string and Zod already ran a stricter check; we just
        # need to reject obviously broken values so a typo at the API doesn't
        # silently flow through.
        if not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("Must be a valid URL or empty")
        return value


# ── Per-section item schemas ────────────────────────────────────────────────


class ExperienceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    company: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=120)
    location: str = Field(max_length=120)
    start: YearMonth
    end: OptionalYearMonth = None
    bullets: list[Annotated[str, Field(min_length=1, max_length=500)]] = Field(
        default_factory=list, max_length=20
    )


class EducationItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    school: str = Field(min_length=1, max_length=160)
    degree: str = Field(min_length=1, max_length=160)
    field: str = Field(max_length=160)
    start: YearMonth
    end: OptionalYearMonth = None
    gpa: str | None = Field(default=None, max_length=20)


class SkillsItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    group: str = Field(min_length=1, max_length=60)
    items: list[Annotated[str, Field(min_length=1, max_length=60)]] = Field(
        default_factory=list, max_length=40
    )


class ProjectItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    name: str = Field(min_length=1, max_length=120)
    summary: str = Field(max_length=400)
    link: str | None = Field(default=None, max_length=2000)
    bullets: list[Annotated[str, Field(min_length=1, max_length=500)]] = Field(
        default_factory=list, max_length=20
    )


# ── Header (singleton inside the sections array) ────────────────────────────


class Header(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    full_name: str = Field(alias="fullName", min_length=1, max_length=160)
    headline: str = Field(max_length=200)
    email: str = Field(max_length=320)
    phone: str = Field(max_length=40)
    location: str = Field(max_length=160)
    links: list[Link] = Field(default_factory=list, max_length=10)

    @field_validator("email")
    @classmethod
    def _allow_empty_or_email(cls, value: str) -> str:
        if value == "":
            return value
        # Single @ check is the same shape as Zod's email check (intentionally
        # loose — full RFC 5322 emails are absurd). Browser-side Zod does the
        # primary validation; server-side this is a sanity net.
        if "@" not in value or "." not in value.split("@", 1)[1]:
            raise ValueError("Invalid email")
        return value


# ── Discriminated section union ─────────────────────────────────────────────


class HeaderSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    type: Literal["header"]
    data: Header


class ExperienceSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    type: Literal["experience"]
    items: list[ExperienceItem] = Field(default_factory=list)


class EducationSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    type: Literal["education"]
    items: list[EducationItem] = Field(default_factory=list)


class SkillsSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    type: Literal["skills"]
    items: list[SkillsItem] = Field(default_factory=list)


class ProjectsSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    type: Literal["projects"]
    items: list[ProjectItem] = Field(default_factory=list)


# Pydantic v2 picks the right member by inspecting `type` first. Without
# `discriminator="type"` it would try each member in order and return a
# misleading "no member matched" error on a typo. With it, the error names
# the offending field directly.
Section = Annotated[
    HeaderSection | ExperienceSection | EducationSection | SkillsSection | ProjectsSection,
    Field(discriminator="type"),
]


# ── Document — Read vs Write ────────────────────────────────────────────────


class ResumeBase(BaseModel):
    """Fields the client controls. Inherits into both read and write models."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    title: str = Field(min_length=1, max_length=120)
    sections: list[Section] = Field(default_factory=list)


class Resume(ResumeBase):
    """A resume as the server returns it — always has an id and timestamps."""

    id: UUID
    # ISO-8601 strings, not datetime, because the frontend treats them as
    # opaque labels and doesn't need to re-serialise them. Skipping
    # datetime keeps the JSON shape boring and timezone-explicit.
    created_at: str
    updated_at: str


class ResumeCreate(ResumeBase):
    """POST body. The server assigns id + timestamps.

    Why accept full `sections` on create instead of an empty document?
        The frontend's "New resume" flow seeds a default document client-side
        (see seedResume.ts) so the first save can post the whole thing in one
        request. Forcing two requests (create empty + then patch sections)
        would double the roundtrip on a flow that's already net-fragile.
    """


class ResumeUpdate(ResumeBase):
    """PUT body — full replacement.

    Why full-replace instead of PATCH?
        The document is small (typically < 50 KB) and autosave already
        debounces. Full-replace removes a category of bugs (merge ordering,
        partial-section invariants) at the cost of a few bytes per save. PATCH
        becomes worth its weight when documents grow or collaboration arrives.
    """


def make_resume_id() -> UUID:
    """Indirection so tests can monkeypatch a deterministic id generator."""
    return uuid4()
