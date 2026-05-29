"""CRUD tests for /api/resumes.

These exercise the happy path plus the failure modes the router translates
into HTTP status codes — anything more exotic belongs in a repository unit
test, not here.
"""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient


def _make_payload(title: str = "My Resume") -> dict:
    """A minimal valid POST body.

    Why minimal? The empty `sections` list keeps each test focused on what
    it's actually asserting (CRUD plumbing). Schema-level tests go in
    test_resume_schema.py so a router test failing means a router bug, not
    a schema-validation bug.
    """
    return {"title": title, "sections": []}


def test_list_resumes_empty(client: TestClient) -> None:
    response = client.get("/api/resumes")

    assert response.status_code == 200
    assert response.json() == []


def test_create_and_get_resume(client: TestClient) -> None:
    create_response = client.post("/api/resumes", json=_make_payload("First"))

    assert create_response.status_code == 201
    body = create_response.json()
    assert body["title"] == "First"
    assert body["sections"] == []
    # Server-assigned fields — we don't pin the value, only that they exist.
    assert body["id"]
    assert body["created_at"]
    assert body["updated_at"] == body["created_at"]

    get_response = client.get(f"/api/resumes/{body['id']}")
    assert get_response.status_code == 200
    assert get_response.json() == body


def test_list_returns_newest_first(client: TestClient) -> None:
    first = client.post("/api/resumes", json=_make_payload("Older")).json()
    second = client.post("/api/resumes", json=_make_payload("Newer")).json()

    listed = client.get("/api/resumes").json()
    assert [r["id"] for r in listed] == [second["id"], first["id"]]


def test_update_replaces_and_bumps_updated_at(client: TestClient) -> None:
    created = client.post("/api/resumes", json=_make_payload("Before")).json()

    updated = client.put(
        f"/api/resumes/{created['id']}",
        json=_make_payload("After"),
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["title"] == "After"
    assert body["id"] == created["id"]
    assert body["created_at"] == created["created_at"]
    # updated_at is timestamp-precision (seconds) so equality is plausible
    # if the test runs fast — we only assert it didn't go backwards.
    assert body["updated_at"] >= created["updated_at"]


def test_delete_removes_resume(client: TestClient) -> None:
    created = client.post("/api/resumes", json=_make_payload()).json()

    delete = client.delete(f"/api/resumes/{created['id']}")
    assert delete.status_code == 204
    assert delete.content == b""

    follow_up = client.get(f"/api/resumes/{created['id']}")
    assert follow_up.status_code == 404


def test_get_missing_returns_404(client: TestClient) -> None:
    response = client.get(f"/api/resumes/{uuid4()}")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_update_missing_returns_404(client: TestClient) -> None:
    response = client.put(f"/api/resumes/{uuid4()}", json=_make_payload())
    assert response.status_code == 404


def test_delete_missing_returns_404(client: TestClient) -> None:
    response = client.delete(f"/api/resumes/{uuid4()}")
    assert response.status_code == 404


def test_invalid_payload_rejected(client: TestClient) -> None:
    """`extra="forbid"` should reject unknown fields — that's how we catch
    frontend-server schema drift at the request boundary."""
    response = client.post(
        "/api/resumes",
        json={"title": "ok", "sections": [], "garbage_field": True},
    )
    assert response.status_code == 422


def test_create_with_full_document(client: TestClient) -> None:
    """Smoke test the full discriminated-union path — if the section schema
    ever loses a member or renames `type`, this fails loudly."""
    payload = {
        "title": "Full",
        "sections": [
            {
                "id": str(uuid4()),
                "type": "header",
                "data": {
                    "id": str(uuid4()),
                    "fullName": "Ada Lovelace",
                    "headline": "Programmer",
                    "email": "ada@example.com",
                    "phone": "",
                    "location": "London",
                    "links": [],
                },
            },
            {
                "id": str(uuid4()),
                "type": "experience",
                "items": [
                    {
                        "id": str(uuid4()),
                        "company": "Analytical Engine",
                        "title": "Lead Programmer",
                        "location": "London",
                        "start": "1842-01",
                        "end": None,
                        "bullets": ["Wrote the first algorithm."],
                    }
                ],
            },
        ],
    }

    response = client.post("/api/resumes", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert len(body["sections"]) == 2
    assert body["sections"][0]["type"] == "header"
    assert body["sections"][1]["type"] == "experience"
