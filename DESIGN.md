---
name: RecruitAI
description: Recruitment review through explicit CV evidence.
colors:
  primary: "#002fa7"
  primary-hover: "#002783"
  surface: "#ffffff"
  neutral: "#f7f7f8"
  text: "#202124"
  muted: "#62646c"
  border: "#dedfe3"
  success: "#216543"
  warning: "#805300"
  danger: "#af2532"
typography:
  body:
    fontFamily: "Be Vietnam Pro, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  display:
    fontFamily: "Be Vietnam Pro, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(3rem, 5.2vw, 5rem)"
    fontWeight: 500
    lineHeight: 1.13
    letterSpacing: "-0.04em"
rounded:
  control: "4px"
  panel: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
---

# RecruitAI design system

## Overview
Swiss editorial identity for recruitment: clear typography, alignment and hairline rules. The product's signature is a requirement → CV evidence → status comparison. Product facts and backend constraints are in PRODUCT.md.

## Colors
Cobalt identifies actions and selected navigation. White and neutral gray keep documents legible during desktop review. Green means a skill is mentioned, amber means review is required, gray means no evidence was found. Labels always accompany status colors. None of these states is an automatic hiring decision.

Light is the default for office document review; a saved dark preference is preserved. Dark surfaces are #16171b and #202126, text #f2f2f4, muted #b4b5bd, borders #3b3d46, accent #9fb9ff and accent text #abc2ff. Success #91d4ac, warning #edc27e and danger #ffacb4. Exact tokens live in webAI/wwwroot/css/enterprise.css.

## Typography
Be Vietnam Pro supports Vietnamese names, labels and dense evidence. One family, weights 400–700. Display is capped at 5rem; workspace page titles use 1.8–2.35rem, sections 1.1–1.5rem. Evidence table is .875rem; metadata never below .75rem. Numeric scores use tabular figures. Technical source excerpts alone use monospace.

## Layout
1320px maximum content width. Desktop workspace has 42% input and 58% evidence, with 32px gutter; below 1200px it stacks. The evidence table becomes labelled rows below 480px. Header collapses below 992px. Mobile uses 16px outer margins. Landing, workspace, account and system surfaces have distinct compositions. Retain top navigation: the current product has no working management subsections that justify a sidebar.

## Elevation & Depth
Hairline borders define document regions. No decorative shadows, blur, glow or gradients. Sections use dividers rather than nested cards.

## Shapes
Square panels, 4px controls and 2px compact status labels. No score rings. The intersection mark connects two source documents without AI sparkle imagery.

## Components
- Buttons: minimum 44px height, explicit hover, focus and disabled states.
- Forms: permanent labels, two JD/CV steps, required feedback linked with aria-describedby; analysis action belongs to the CV step.
- Result: filename, model, computation state and component scores, followed by the open evidence table and expandable detail/source text. Preserve null and zero distinctly.
- Stale result: editing input retains prior evidence/download with a visible stale notice. A new analysis replaces it. No persistence across navigation.
- Account: unavailable notice and working analysis link first, disabled form preview disclosed on demand.
- Loading: indeterminate strip only while a request is active, text progress for sequential files. No fabricated percentage.
- Empty: explains which inputs are needed and what the user will receive.
- Error: visible alert with recovery instructions and keyboard focus. No fallback score.
- Navigation: current page indicator, mobile menu, skip link and appearance toggle.

## Do's and Don'ts
Use actual API data. Keep evidence as textContent. Show unavailable functionality honestly. Do not invent candidates, statistics, rankings, proficiency or research metrics. Reuse the shared workspace and theme. Keep Razor/static entry points in sync. Do not alter algorithms, endpoints, authentication or storage for visual reasons.
