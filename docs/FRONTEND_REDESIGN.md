# Frontend redesign — 2026-11-03

## Scope and starting audit
Branch: tranphucthinh. ASP.NET Core 10 Razor Pages, plain JS, Bootstrap 5.3.3 and Bootstrap Icons 1.11.3. Razor and static HTML entry points coexist. No Tailwind or frontend build pipeline. There is no working candidate/job management backend, application history, authentication or SQL persistence in the inspected application.

Kept: actual matching API contract, shared partial, sequential up-to-10 recruiter uploads, text/PDF/DOCX inputs, parser explanation, JSON export, nullable scores, three model choices, theme preference and existing routes.

Replaced: page-specific inline CSS, purple gradients, decorative shadows, rounded card grids, score ring, duplicated theme values, generic hero composition and overdecorated account side panels. Legacy app.js and the legacy CV scoring service were left outside this redesign; active matching pages continue to use matching.js.

## Pages
| Page | Change |
|---|---|
| / and /index.html | Editorial landing with actual task entry points, document comparison process and method descriptions |
| /Candidate and /candidate-portal.html | Shared single-CV workspace, permanent field labels, clear JD/CV steps |
| /Recruiter and /recruiter-dashboard.html | Multi-file workspace with source evidence comparison |
| /Results | Same live comparison workspace; no fabricated historical lookup |
| /Admin and /admin-portal.html | Service status and factual capability list |
| /Login and /login.html | Availability-first account page; disabled form preview |
| /Register and /register.html | Matching identity, collapsed disabled preview, unavailable policy actions |

No management/profile/job routes were invented. Existing evidence and extracted document viewers remain the available way to inspect CV contents. Navigation stays a top-level header because there are no working management subsections to put in a sidebar.

## Components and design system
DESIGN.md records the implemented palette, type scale, tokens and component behavior. CSS is split into shared layout/components (theme.css) and semantic tokens (enterprise.css). Bootstrap remains the base. New shared evidence table replaces repeated skill cards; it shows all three states with text, not color alone. Desktop aligns requirements and excerpts; mobile exposes labels per row.

The result preserves context and export after edits and clearly marks it stale. A new analysis replaces it. Required fields have linked messages and aria-invalid, error alerts receive focus, and the JD continuation validates before moving forward. The account previews remain disabled and cannot simulate authentication.

## Sources and actual usage
- UI UX Pro Max was not installed in the session skill directory. Read the official repository skill and ran its Python design-system search, then the explicit product query `recruitment hiring` and UX query `error summary validation`. The product match recommended Flat Design / Minimalism & Swiss. Adopted accessibility, hierarchy and task guidance; rejected mismatched generic font/color output. Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Impeccable was not installed in the session skill directory. Read the official skill plus new-work, craft-floor, critique, polish and document references. Ran context using a workspace cache, concept-seed, and the detector. User delegated visual decisions and authorized two independent subagents for critique. Source: https://github.com/pbakaus/impeccable
- Used the installed frontend-design skill for one coherent Swiss identity and factual content discipline. No claim of global installation is made for either external skill.

## Critique → refine → polish → recheck
Assessment A independently read source and eight rendered screenshots; Assessment B independently ran the mechanical detector. Parent combined their findings afterward.

Fixed: premature analyze action in JD step, minimum type sizes, missing initial Hybrid explanation, destruction of previous results on edits, and disabled account forms dominating the page. Account previews now collapse; unavailable policy links are blocked. The mobile menu capture issue was a test timing issue during Bootstrap transition; checks now wait for transition completion.

Initial detector: 15 warnings, 0 errors. Final detector: 14 warnings, 0 errors; tiny-text resolved. Remaining 8 cramped-padding warnings misread explicit padding-left/padding-block; 6 marquee warnings refer to the request-only indeterminate strip, hidden when idle and disabled under reduced motion. These are documented false positives, not a claim of perfect design.

## Validation
- Final .NET build in a separate test output directory: 0 warnings, 0 errors. Earlier builds retried copies while a preview process held the DLL.
- Existing frontend contract suite: 7/7 passed. Syntax checks for matching.js, theme.js and account.js passed. git diff --check passed.
- Actual ASP.NET browser routes: 13/13 HTTP 200, including Razor and static entry points.
- Responsive: 375px, 768px, 1024px on five page types, plus desktop 1440px. No horizontal overflow in 15 narrower matrix cases or desktop routes. Mobile evidence results also fit.
- 16 browser scenarios passed: blank JD focus, invalid-years feedback, real upstream-unavailable UI, safe evidence text, retained stale result, mobile result width, mobile navigation, dark mode, null score, true zero, unsupported/empty/oversize files, two sequential existing development-CV uploads with controlled responses, collapsed account preview and disabled form. No uncaught page exceptions.
- Viewed rendered screenshots of landing, workspace, results, account and system surfaces. Screenshots containing scores use controlled test fixtures only; production code contains no injected fixtures.
- Token contrast: muted text on white 5.90:1, on neutral 5.51:1, primary button 10.69:1, dark muted text 8.77:1, dark primary button 8.58:1. These are checks of the named token pairs, not every browser state.

### Limits
Python dependencies/model cache are not installed in the cloned repository. True inference and research quality were not validated; the real unavailable-service path and controlled UI response states were tested. Authentication, candidate/job CRUD, applications and persisted history still require backend work. The sandbox logs a DataProtection key-store access warning during ASP.NET startup, while tested routes return 200; backend configuration was not changed to hide it. Bootstrap/font/icon CDNs remain runtime dependencies.

Questions skipped: implementation and polish decisions were delegated by the user; critique did not identify a further required product decision.

## Files
- webAI/Pages: Index, Candidate, Recruiter, Results, Admin, Login, Register and Shared/_Layout (.cshtml only).
- webAI/wwwroot: index.html, candidate-portal.html, recruiter-dashboard.html, admin-portal.html, login.html, register.html.
- webAI/wwwroot/css: theme.css, enterprise.css.
- webAI/wwwroot/js: matching.js, theme.js.
- webAI/wwwroot/partials/matching-workspace.html.
- PRODUCT.md, DESIGN.md, docs/FRONTEND_API.md, docs/FRONTEND_REDESIGN.md and the Impeccable surface brief.

No controller, C# service, AI core, entity, database schema, dependency or authentication implementation changed. No commit or push performed.
