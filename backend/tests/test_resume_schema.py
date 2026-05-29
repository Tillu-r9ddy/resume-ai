"""Schema-level unit tests.

WHY separate from router tests?
    A failure here points directly at the schema; a failure in test_resumes
    points at the router. Co-locating them would mean a regression in one
    causes false-positive failures in the other, which slows diagnosis.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.resume import (
    EducationItem,
    ExperienceItem,
    Header,
    ResumeCreate,
)


def test_experience_requires_year_month_format() -> None:
    with pytest.raises(ValidationError):
        ExperienceItem(
            id=uuid4(),
            company="x",
            title="y",
            location="",
            start="2024",  # missing -MM
            end=None,
            bullets=[],
        )


def test_education_end_can_be_null() -> None:
    item = EducationItem(
        id=uuid4(),
        school="x",
        degree="y",
        field="",
        start="2020-09",
        end=None,
    )
    assert item.end is None


def test_header_allows_empty_email() -> None:
    """Empty string mid-edit is intentional — see schema docstring."""
    header = Header(
        id=uuid4(),
        fullName="Ada",
        headline="",
        email="",
        phone="",
        location="",
        links=[],
    )
    assert header.email == ""


def test_header_rejects_obviously_bad_email() -> None:
    with pytest.raises(ValidationError):
        Header(
            id=uuid4(),
            fullName="Ada",
            headline="",
            email="not-an-email",
            phone="",
            location="",
            links=[],
        )


def test_resume_create_forbids_unknown_fields() -> None:
    """extra='forbid' is what catches frontend/server schema drift early."""
    with pytest.raises(ValidationError):
        ResumeCreate.model_validate({"title": "ok", "sections": [], "rogue": 1})
