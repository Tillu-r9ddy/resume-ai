# Phase 6b — Resume Schema + CRUD (Pydantic mirror, in-memory repo, dependency-injected router)

> Goal: stand up `/api/resumes` as a working CRUD surface that round-trips the exact JSON shape the frontend already produces. Schema parity with the Zod model is the single most important deliverable — everything else (storage, auth, migrations) can change without breaking the wire format.

## What we built and WHY

### 1. `app/schemas/resume.py` — Pydantic mirror of `frontend/src/schema/resume.ts`

The frontend already owns the canonical resume shape via Zod. Phase 6b's first move was to express the **same** contract on the server in Pydantic v2. Both sides validate independently — a malformed body fails fast on either end, with a structured error. If we ever do code-generate one side from the other, we'll have two implementations to diff against; today we hand-maintain the mirror and rely on tests to catch drift.

Choices worth flagging:

- **`extra="forbid"` on every model.** Unknown fields are a 422, not silently accepted. Catches typos like `experiance` before they corrupt persisted records.
- **`populate_by_name=True` + `Field(alias="fullName")`.** Pydantic snake_case internally; the wire format stays the camelCase the Zod schema produces (`fullName`, not `full_name`). One model, two names — Python idiom on the inside, JS idiom on the wire.
- **Discriminated union via `Annotated[Section, Field(discriminator="type")]`.** Pydantic v2's idiomatic way to mirror Zod's `discriminatedUnion`. Section parsing is O(1) — the dispatcher reads `type` first and only validates the matching branch. Without the discriminator, Pydantic would try every variant and pick the first that fits; you'd get useless error messages like "no variant matched".
- **Split `ResumeBase` / `Resume` / `ResumeCreate` / `ResumeUpdate`.** Read shape vs write shape. The server assigns `id`, `created_at`, `updated_at` — clients never send them. Splitting the models means the OpenAPI schema is accurate (Swagger shows `POST /api/resumes` taking `ResumeCreate`, not the read shape with timestamps mysteriously optional).
- **`make_resume_id()` helper.** A one-line function exists so tests can monkeypatch deterministic ids. Inline `uuid4()` would force every test to mock the entire `uuid` module.

### 2. `app/repositories/resumes.py` — in-memory CRUD with a stable seam

The repository is a class around a `dict[str, Resume]`. No SQL, no async, no Alembic. The point isn't the storage; it's the **shape** — every other module talks to `ResumeRepository`, never to the dict directly. The day we swap in SQLAlchemy or Mongo, this one file changes and nothing else does.

```python
class ResumeRepository:
    def list(self) -> list[Resume]: ...           # newest first
    def get(self, id: str) -> Resume: ...         # raises ResumeNotFoundError
    def create(self, body: ResumeCreate) -> Resume: ...
    def update(self, id: str, body: ResumeUpdate) -> Resume: ...
    def delete(self, id: str) -> None: ...
```

Two non-obvious details:

- **`_utcnow_iso()` keeps microseconds.** First pass stripped them with `.replace(microsecond=0)` because seconds-precision timestamps look cleaner in tooltips. That broke `test_list_returns_newest_first` — two creates in the same second produced identical `updated_at`, and the sort was no longer stable. Microseconds aren't there for the UI; they're there to make timestamp-ordered queries deterministic.
- **`ResumeNotFoundError` is a domain exception, not `HTTPException`.** The router translates it to a 404. The repo doesn't know about HTTP; if we ever called it from a CLI or a background job, the domain error would still be the right thing to raise.

### 3. `app/routers/resumes.py` — DI-friendly router

```python
ResumeRepoDep = Annotated[ResumeRepository, Depends(get_resume_repository)]

@router.post("", status_code=201)
def create_resume(body: ResumeCreate, repo: ResumeRepoDep) -> Resume: ...
```

Why a `get_resume_repository` dependency for a process-singleton?

- **Test override is one line.** `app.dependency_overrides[get_resume_repository] = lambda: per_test_repo`. Without the indirection, tests would have to mutate a module-global or patch the import — both of which leak state between tests.
- **`Annotated[T, Depends(...)]` is the FastAPI 0.95+ idiom.** Equivalent to the older `repo: ResumeRepository = Depends(get_resume_repository)` signature, but the type appears once instead of twice and IDE go-to-definition resolves cleanly.

Status codes:

- `201 Created` on POST — server assigned an id; client should read `Location` (we don't set it yet, but the convention slot is reserved).
- `204 No Content` on DELETE — body would be wasted bytes for the only relevant signal: "it's gone".
- `404 Not Found` on missing id — explicit, not 200-with-null. A 200 means "I successfully found nothing", which is a contradiction.
- `422 Unprocessable Entity` on schema violations — Pydantic + FastAPI handle this automatically.

### 4. `tests/conftest.py` — per-test repo fixture

```python
@pytest.fixture
def repository() -> ResumeRepository:
    return ResumeRepository()  # fresh every test

@pytest.fixture
def app(repository: ResumeRepository) -> FastAPI:
    app = create_app()
    app.dependency_overrides[get_resume_repository] = lambda: repository
    return app
```

Why a fresh repo per test? Without it, test order would matter — `test_create_then_list` would see records from `test_delete_returns_204`. The override is what makes that hygiene cheap.

### 5. The test surface (15 tests across two files)

- **`tests/test_resumes.py`** — 10 CRUD tests. The non-obvious ones:
  - `test_list_returns_newest_first` — the sort-stability bug above. Test does three back-to-back creates and asserts the list is reverse-chronological.
  - `test_update_replaces_and_bumps_updated_at` — PUT is full-replace semantics (matches the autosave hook's "send the whole doc" model). The test also asserts `updated_at` strictly increases.
  - `test_post_with_unknown_field_returns_422` — the `extra="forbid"` contract.
  - `test_create_with_full_document_including_sections` — exercises the discriminated union end-to-end so we know the section dispatcher is wired.
- **`tests/test_resume_schema.py`** — 5 unit tests that hit the Pydantic models directly (no HTTP). Catches drift in the schema itself without needing a running app.

## Acceptance criteria

- ✅ `POST /api/resumes` accepts a Zod-shaped payload and returns it with `id` + timestamps.
- ✅ Wire format keeps camelCase fields (`fullName`, not `full_name`).
- ✅ Discriminated union round-trips through `header`, `experience`, `education`, `skills`, `projects` sections.
- ✅ Unknown top-level fields → 422.
- ✅ Missing id on GET/PUT/DELETE → 404.
- ✅ `list()` is reverse-chronological even for same-second inserts.
- ✅ 15/15 tests pass; ruff is clean.

## What we deliberately did NOT do

- **SQL or migrations.** The repository seam exists precisely so we _can_ defer this. Phase 6b is about getting the contract right; the storage will follow when the read patterns are settled.
- **Pagination on `list()`.** A single user with N resumes is small. When that's no longer true (multi-user, audit history), we add `?limit=&cursor=`.
- **Optimistic concurrency.** PUT clobbers whatever was on the server. The frontend's debounced autosave + AbortController on supersede makes a last-write-wins race essentially impossible for the current single-user model.
- **Auth / multi-tenancy.** Phase 6c+. Today the repo is global and unscoped.
- **Soft delete.** DELETE actually deletes. A soft-delete column adds joins to every read for a feature no test asks for yet.

## Interview questions Phase 6b prepares you to answer

> **Q:** Why mirror the Zod schema in Pydantic by hand instead of code-generating one side?
> **A:** Because the cost of two ~150-line schemas is far less than the cost of a code-gen pipeline (build step, lockstep deploys, debugging the generator when it produces something subtly wrong). Tests on both sides catch drift, and the WHY-comments live with the code in each language. Code-gen makes sense at 10x the schema size or when 3+ services need to share types.

> **Q:** Why `extra="forbid"` instead of `extra="allow"`?
> **A:** Defensive validation at the boundary. Allowing extra fields means a typo'd client (or an old frontend hitting a new backend) silently writes data nobody reads. Forbidding makes the schema the spec — the wire format is exactly what the model declares. The cost is that schema migrations need both sides to update in lockstep; the benefit is no class of "we accepted garbage for six months" incidents.

> **Q:** Why a repository abstraction over an in-memory dict?
> **A:** It's the seam where storage decisions live. Every other module imports `ResumeRepository`, not a SQLAlchemy session or a dict. When we add Postgres, only this file changes — routers, tests, and (in 6d) the frontend's autosave hook all keep working. The cost is one indirection layer; the benefit is that "what's our storage strategy?" becomes a refactor instead of a rewrite.

> **Q:** Why microseconds in `updated_at`?
> **A:** Same-second writes need to sort deterministically. Stripping microseconds for prettier UI broke the "newest first" test the first time three creates fired in under a second. Timestamps on a server aren't a UI concern — they're a primary ordering key.

> **Q:** Why a `get_resume_repository` dependency for a process-global object?
> **A:** Tests. The indirection lets `app.dependency_overrides[get_resume_repository] = lambda: per_test_repo` give each test its own instance — without that, test order would matter and you'd be debugging cascading state pollution. FastAPI's DI shape costs almost nothing to set up and pays for itself the first time the test suite grows past trivial.

## What's next: Phase 6c — streaming chat

- `POST /api/chat` returns an SSE stream of `{type:"token"}` frames.
- `ChatProvider` ABC with `EchoProvider` (default, no install) and `OllamaProvider` (opt-in).
- Wire format chosen to be parseable from `fetch` + `pipeThrough(TextDecoderStream)`.
