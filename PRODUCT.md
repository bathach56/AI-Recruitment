# RecruitAI product context

## Platform
Web, Vietnamese interface; desktop recruitment work with tablet/mobile access.

## Users and task
Recruiters define job requirements, compare actual CVs and review evidence. Candidates prepare and submit their CV; they do not author job requirements or run matching. Candidate submission remains unavailable until the application API exists. AI supports human review.

## Existing implementation
ASP.NET Core 10 Razor Pages, mirrored static HTML, Bootstrap 5.3, Bootstrap Icons, plain JavaScript. Python matching is called through existing ASP.NET endpoints. Text and PDF/DOCX inputs; recruiter uploads up to 10 files sequentially. TF-IDF, Sentence-BERT and Hybrid; missing scores remain null.

## Constraints
Preserve backend, APIs, matching algorithms, storage and authentication behavior. No fabricated candidates, statistics or results. Account, job/application management and historical persistence have no working business API yet; communicate availability honestly. No new UI framework. Redesign decisions delegated by the user in the supplied brief.

## Success
A recognizable recruitment interface, readable evidence, useful error/empty/loading states, keyboard access and responsive layouts, verified in a browser. Backend correctness and AI quality are separate from UI tests.
