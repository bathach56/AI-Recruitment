# AGENTS.md — AI Recruitment Project

**Mandatory onboarding rule:** Anyone working on this project, including new contributors and anyone using an AI assistant to make changes, must always read this `AGENTS.md` and any applicable nested `AGENTS.md` files before starting work; the AI assistant must read and follow these instructions before inspecting or modifying the project.

<!-- CODEGRAPH_START -->
## CodeGraph

When `.codegraph/` exists at the project root, use CodeGraph before text searches or file reads to understand or locate code:
- Use `codegraph_explore` when the MCP tool is available.
- Otherwise run `codegraph explore "<symbol names or question>"` from the project root (use `codegraph.cmd` in PowerShell if needed).
- Run `codegraph status` to check the index and `codegraph sync` to refresh it after changes when needed.
- If CodeGraph is unavailable or does not cover the relevant files, fall back to `rg` and direct file inspection; do not treat missing graph results as proof that code does not exist.

If `.codegraph/` does not exist, skip CodeGraph; do not create an index without the user's authorization.
<!-- CODEGRAPH_END -->

## 1. Project

This repository is a 2-person, 3-month academic software engineering project:

**AI Recruitment — CV & Job Description Matching**

Core goal:
- Build a recruitment web application.
- Analyze CVs against Job Descriptions.
- Compare NLP approaches experimentally.
- Provide matching score, matched skills, missing skills, and relevant experience.
- AI supports recruiters; it must not be presented as an automatic hiring decision.

Research methods:
1. TF-IDF + Cosine Similarity — baseline.
2. Sentence-BERT + Cosine Similarity — semantic similarity.
3. Hybrid Model — semantic similarity + skill matching + experience matching.

Research metrics:
- Precision
- Recall
- F1-score
- Cosine Similarity
- Processing Time

**Never invent research results.** All reported results must come from actual experiments.

---

## 2. Core Rules

### Inspect before editing

Before changing code:
1. Read applicable `AGENTS.md` files.
2. Inspect relevant files and nearby dependencies/callers.
3. Check current repository state.
4. Follow existing project patterns.
5. Make the smallest change that solves the task.

Do not guess file paths, APIs, models, database structure, or library behavior when they can be inspected.

### Preserve working code

Do NOT:
- Rewrite the project for a small task.
- Refactor unrelated code.
- Delete working code without a clear reason.
- Change architecture without approval.
- Replace frameworks or major libraries just because another option is preferred.

Prefer:
> inspect → minimal change → verify.

### Stay in scope

Implement what the task requires.

Do not silently add:
- unrelated features,
- new frameworks,
- unnecessary packages,
- database redesigns,
- large refactors,
- speculative abstractions.

If a major architectural change is genuinely required, explain why before making it.

### Never fabricate

Never fabricate:
- file paths,
- API endpoints,
- database fields,
- library functions,
- test results,
- benchmark numbers,
- Precision/Recall/F1 results,
- model performance,
- successful execution.

If something is unknown, inspect it, run it, or state that it is unknown.

---

## 3. Architecture

Expected architecture:

```text
Frontend
    ↓ REST API
ASP.NET Core Web API
    ├── SQL Server
    └── Python AI Service
            ↓
        NLP / ML Models
```

Responsibilities:

### Frontend
- UI and user interaction.
- Candidate/recruiter dashboards.
- Job search and job management.
- CV upload.
- Matching result display.

### ASP.NET Core Web API
- Authentication and authorization.
- Business logic.
- Users, candidates, recruiters, companies.
- CVs, jobs, applications.
- Matching result storage.
- API communication with frontend and AI service.

### SQL Server
- Persistent application data.
- Users/roles.
- Candidates/recruiters.
- CV metadata.
- Jobs.
- Applications.
- Matching results.
- Skills and relationships.

### Python AI Service
- Document text extraction.
- Text preprocessing.
- TF-IDF.
- Sentence-BERT.
- Skill matching.
- Experience matching.
- Hybrid matching.
- Research/evaluation pipeline.

Do not convert the project to microservices, Node.js backend, MongoDB, FastAPI, React, Docker/Kubernetes, or another major architecture unless explicitly requested.

---

## 4. Expected Project Structure

```text
AI-Recruitment/
├── frontend/
├── backend/
├── ai-service/
├── dataset/
├── research/
├── docs/
├── AGENTS.md
└── README.md
```

If the actual repository differs, inspect it and follow the actual structure instead of blindly creating folders.

Do not reorganize the repository unless the task requires it.

---

## 5. Technology Rules

Preferred stack:

### Backend
- C#
- ASP.NET Core Web API
- Entity Framework Core

### Database
- Microsoft SQL Server

### Frontend
- HTML
- CSS
- JavaScript
- Bootstrap

### AI/NLP
- Python
- Scikit-learn
- Sentence Transformers
- PyTorch / Hugging Face when required

### Document processing
- PyMuPDF for PDF.
- python-docx for DOCX.

### Research
- Pandas
- NumPy
- Matplotlib
- Jupyter Notebook / Google Colab when appropriate.

Do not add a dependency if the current project already has a suitable solution.

---

## 6. Backend Rules

Keep business logic out of controllers when the existing project separates services/business logic.

Use:
- clear DTOs,
- validation,
- appropriate HTTP status codes,
- clear service boundaries,
- existing project conventions.

Do not:
- expose secrets,
- return stack traces to clients,
- trust role information sent by the frontend,
- store plaintext passwords,
- hard-code JWT secrets/API keys.

Authentication and authorization must be enforced by the backend.

Expected roles:
- Admin
- Recruiter
- Candidate

Do not create additional roles unless requested.

---

## 7. Database Rules

Use SQL Server.

Before modifying schema:
1. Inspect existing entities and relationships.
2. Check whether requested data already exists.
3. Make the smallest schema change necessary.
4. Use EF Core migrations when the project uses migrations.

Never run destructive operations such as:
- `DROP DATABASE`
- `DROP TABLE`
- mass deletion of development data

unless explicitly requested and confirmed.

Do not redesign the entire database for a local feature.

---

## 8. AI/NLP Rules

### TF-IDF

Use as the baseline:

```text
CV → TF-IDF vector
JD → TF-IDF vector
→ Cosine Similarity
```

### Sentence-BERT

Use for semantic similarity:

```text
CV → Sentence-BERT embedding
JD → Sentence-BERT embedding
→ Cosine Similarity
```

### Hybrid

Expected components:

```text
Semantic Similarity
+ Skill Matching
+ Experience Matching
→ Hybrid result
```

Do not claim that Hybrid is the best method before experiments.

If weights are introduced:
- document the initial assumption,
- keep them configurable when practical,
- evaluate them experimentally,
- do not present assumed weights as proven results.

---

## 9. Research Rules

Research must be reproducible.

For each experiment record:
- dataset/version,
- preprocessing,
- model/method,
- parameters,
- evaluation method,
- results,
- processing time.

Compare methods fairly.

Do not compare models using unrelated datasets and then claim one model is better.

Keep experiment code, result tables, charts, and evaluation scripts organized under `research/` and related data under `dataset/`.

**Never manually invent result numbers to fill a report or slide.**

---

## 10. Matching Score vs Evaluation Metrics

Keep these concepts separate:

**Matching Score**
- Measures how suitable one CV appears for one JD.

**Precision / Recall / F1-score**
- Evaluate model predictions against ground-truth labels.

**Cosine Similarity**
- Measures vector similarity; it is not automatically the same thing as model accuracy.

Never describe a matching score such as `82%` as "82% accuracy" unless the evaluation methodology actually supports that statement.

---

## 11. File Upload & Document Processing

Supported CV formats may include:
- PDF
- DOCX

Validate:
- file type,
- file size,
- filename/path handling,
- parsing failures.

Do not trust user-controlled filenames for filesystem paths.

Do not execute uploaded files.

If extraction fails:
- return a meaningful error,
- log enough information for debugging,
- do not silently produce an empty or fake CV.

---

## 12. API Rules

Use clear REST conventions.

Examples:

```text
GET    /api/jobs
POST   /api/jobs
GET    /api/jobs/{id}
PUT    /api/jobs/{id}
DELETE /api/jobs/{id}

POST   /api/cvs/upload
POST   /api/matching/analyze
GET    /api/matching/{id}
```

Before creating a new endpoint:
- check whether an existing endpoint already provides the required behavior.

Do not create duplicate endpoints without a reason.

Validate input and return appropriate status codes.

---

## 13. Error Handling

Never silently swallow errors.

Avoid:

```csharp
try
{
    ...
}
catch (Exception)
{
    // ignore
}
```

When a failure occurs:
1. Identify the root cause.
2. Fix it if it is within scope.
3. Verify the fix.
4. Report remaining issues honestly.

Do not change an error into a fake success response merely to make the UI look successful.

---

## 14. Testing & Verification

After changes, run the narrowest relevant checks first.

Use the actual commands defined by the repository when they exist.

Typical checks:

```text
Backend:
- dotnet build
- relevant tests
- relevant API checks

AI:
- Python syntax/import check
- relevant experiment/test
- sample inference

Frontend:
- build/check if available
- relevant UI/API flow
```

Do not claim a test passed unless it was actually run.

If a check cannot be run:
- say which check was skipped,
- explain why,
- identify what remains unverified.

After significant changes, inspect the final diff for:
- unrelated changes,
- accidental deletions,
- secrets,
- debug code,
- generated files,
- unexpected API/schema changes.

---

## 15. Git Rules

Preferred workflow:

```text
main
└── develop
    ├── feature/backend-...
    ├── feature/frontend-...
    ├── feature/ai-...
    └── fix/...
```

Do not:
- force push,
- reset away another member's work,
- rewrite another member's commits,
- delete another member's branch,
- modify unrelated files.

Before committing, inspect:

```text
git status
git diff
```

Do not commit:
- `.env`
- API keys
- passwords
- private keys
- local secrets
- unnecessary build artifacts

Do not create commits unless the task explicitly asks for a commit.

---

## 16. Team Safety

This is a 2-person student project.

If code belonging to another member is unrelated to the current task:
- leave it alone.

If you discover a problem outside the current task:
- report it briefly,
- do not perform a drive-by refactor.

Avoid merge conflicts by keeping changes focused and localized.

---

## 17. Scope & Feature Priority

Priority:

```text
1. Core functionality
2. AI/NLP research
3. Evaluation
4. Integration
5. Testing
6. Performance/stability
7. UI polish
8. Extra features
```

Do not add extra features while a core feature is broken.

Preferred optional features:

1. Candidate Ranking
2. Skill Gap Analysis
3. Explainable Matching
4. Recruiter Dashboard
5. Multi-candidate comparison

Only implement optional features after the core system is stable.

---

## 18. Task Workflow

For small tasks:

```text
Understand
→ Inspect
→ Implement
→ Verify
```

For larger tasks:

```text
1. Understand
2. Inspect
3. Identify affected files
4. Make a short plan
5. Implement the smallest viable change
6. Run relevant verification
7. Review diff
8. Report result
```

If the request is ambiguous and different interpretations would materially change the implementation, ask one focused question.

If the task is clear, do not waste time asking unnecessary questions.

---

## 19. Minimal-Change Rule

Prefer:

```text
small, local, reversible change
```

over:

```text
large refactor
```

Do not rewrite an entire file if a small patch is sufficient.

Do not modify unrelated formatting.

Do not reformat the whole project because one function changed.

Do not introduce an abstraction used only once unless there is a concrete reason.

---

## 20. Dependency Rules

Before adding a package:

1. Check existing dependencies.
2. Check whether functionality already exists.
3. Prefer existing project libraries.
4. Add a new dependency only when it provides meaningful value.

When adding one:
- explain why it is needed,
- use a compatible stable version,
- update the appropriate dependency file.

Do not install packages just to solve a trivial problem.

---

## 21. Communication Rules

Be concise and factual.

Before a non-trivial change:
- briefly state what will be changed.

After the change, report:

```text
Changed:
- ...

Verification:
- ...

Result:
- ...

Remaining:
- ...
```

Do not claim success without evidence.

Do not write a long explanation when a short one is enough.

---

## 22. Definition of Done

A task is done only when:

- Requested behavior is implemented.
- Existing unrelated behavior is preserved.
- Relevant checks were run.
- No known critical error remains from the change.
- No secrets were introduced.
- No unrelated files were modified.
- Research results, if any, are based on real experiments.
- The final state is clearly reported.

"Code was written" is not enough to call a task done.

---

## 23. Final Priority

When rules conflict, prefer:

```text
Correctness
↓
Security
↓
Existing project architecture
↓
Minimal change
↓
Testability
↓
Performance
↓
Code elegance
```

The agent is an implementation assistant, not the project owner.

Do not independently decide to:
- redesign the architecture,
- replace major technologies,
- redesign the database,
- change the research methodology,
- add major dependencies,
- change the project's scope.

Ask for confirmation when such a decision is required.
