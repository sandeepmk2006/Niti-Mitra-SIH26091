# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Niti Mitra — a multilingual AI business-advisory assistant for rural and semi-urban
micro-entrepreneurs. From three inputs (business category, location, margin capital) it produces a
hyper-local feasibility report and a complete concessional-loan plan. Expo/React Native client that
talks to Gemini directly and stores data in Firebase; a Python Cloud Function pipeline also exists
in `functions/` but the app does not call it.

## Commands

All commands run from the repo root.

- `npm start` / `npm run dev` (`--dev-client`) — Metro dev server. After editing `.env`, restart
  with `npx expo start -c` so the new values are inlined.
- `npm run android` / `npm run ios`, `npm run prebuild`
- `npm run lint` — `expo lint`
- `npx tsc --noEmit` — type-check. Typed routes (`app.json` `experiments.typedRoutes`) come from
  `.expo/types/router.d.ts`, which only the dev server regenerates: after adding/renaming a route,
  run `npx expo start` once or tsc will reject the new hrefs.
- `npx expo export --platform android --output-dir <tmp>` — bundles without a device; the quickest
  way to catch Metro resolution errors.
- No test runner. Pure services (`schemeCalculator`, `geo`, `FeasibilityService`, `AdvisorService`)
  have no React Native imports and can be exercised from Node with `npx tsx` + `.env` loaded;
  anything importing `expo-*` (voice, reportPdf) cannot.
- EAS (`eas.json`): `eas build --profile development | preview | production`. Native modules
  (expo-av, expo-speech, expo-location, expo-print, expo-sharing) need a fresh build.
- `firebase deploy --only firestore:rules` — `firestore.rules` is only enforced once deployed.

**Setup**: copy `.env.example` → `.env` and set `EXPO_PUBLIC_GEMINI_API_KEY`. `.env` is gitignored
but *not* in `.easignore`, so EAS uploads it. `EXPO_PUBLIC_*` values are inlined into the bundle —
the key is extractable; production should proxy Gemini through a backend.

## Architecture

### Layout: `app/` is routes only

expo-router turns every file under `app/` into a route, so non-screen code lives in `src/`
(`services/`, `context/`, `i18n/`, `components/`, `hooks/`, `types/`, `utils/`, `constants/`).

### Navigation & onboarding

Root `Stack` (`animation: "none"` — the UI is deliberately motion-free) inside `I18nProvider` →
`SettingsProvider` → `AuthProvider` → `ChatProvider`. `app/(tabs)/_layout.tsx` is the onboarding
gate: redirects to `/language` → `/auth` → `/preferences` (while `user.preferences === null`), then
shows five tabs: **Home, New study, Calculator, Advisor, History**. Stack screens: `study/[id]`
(report), `session/[id]` (conversation), `settings` (from the Home gear), `profile`, `preferences`.
Route files export `ErrorBoundary` from `src/components/ErrorFallback.tsx`.

### Module 2 — `src/services/schemeCalculator.ts` (deterministic, offline)

- Project cost = margin ÷ 10%; loan = 90%, capped per scheme. Project is sized as
  `min(margin/0.1, margin + maxLoan, scheme max)`, so the user's contribution never exceeds their
  margin (e.g. ₹14,000 → ₹1.39 lakh project, ₹1.25 lakh loan, note `capApplied`). Above ₹50 lakh
  the surplus margin is reported (`aboveMax`).
- Micro Finance (≤ ₹1.40 lakh): max loan ₹1.25 lakh, 6.5%, 36 months incl. 3-month moratorium.
  Term Loan (₹1.40–50 lakh): max ₹45 lakh, 8%, 84 months incl. 6-month moratorium.
- Repayment model: simple interest over the moratorium is added to the loan, then equal quarterly
  instalments (11 / 26 quarters). `buildSchedule` returns the full quarterly table.
- `computeOperations` — coverage = 3 × monthly surplus ÷ quarterly instalment; risk (<1 high,
  ≤1.25 moderate) and the 0–100 viability score are computed here, never by the LLM.

Used by the Calculator tab, Home's quick check, and the report's Finance tab
(`src/components/FinancePlanView.tsx`).

### Module 1 — `src/services/FeasibilityService.ts`

`runStudy(input, ctx, onStep)`: geocode (Nominatim) or GPS → `fetchLocalData` (Overpass: villages
within 5/10 km, same-category businesses within 5 km; mirrors raced in parallel, 15 s cap) →
financial plan → two parallel Gemini JSON calls: *market* (reach, channels, opportunities,
competition, pricing) and *strategy* (SWOT, threats, next steps, monthly unit economics + asset
list). Map steps are best-effort; the study completes without them. Code then computes operations
and scales the asset list so assets + working capital = project cost exactly. Categories and their
OSM tags: `src/services/categories.ts`. Report UI: `src/components/MarketReportView.tsx`,
`app/study/[id].tsx`; PDF: `src/services/reportPdf.ts` (expo-print + expo-sharing).

### Advisor — `src/services/AdvisorService.ts`, `src/context/ChatContext.tsx`

Q&A in the user's language. Every reply is JSON `{ message, question | null }`; the question's
options render as tappable cards (the composer — text or voice — is the "other" answer). The
system prompt carries the scheme rules, the user's saved preferences, and — when opened from a
report ("Discuss") — `summarizeStudy()` of that study, so answers use the real numbers.

### Persistence (`src/services/HistoryService.ts`)

`/users/{uid}` (profile incl. `preferences`), `/users/{uid}/studies/{id}` (input, plan with
schedule, local data, report, operations, costBreakdown), `/users/{uid}/sessions/{id}` (messages,
optional `studyId`/`studyTitle`). Epoch-ms timestamps (sort correctly while offline). Live lists
via `src/hooks/useSessions.ts` (`useStudies`, `useSessions`). `firestore.rules`: each user can
read/write only `/users/{uid}/**` — deploy it.

### Preferences, i18n, voice, auth

- Preferences (`src/services/preferences.ts`): 10 onboarding questions; `describeProfile()` goes
  into every Gemini prompt; the social category picks the national corporation shown under
  "Where to apply" (`agencyKey` in `src/utils/study.ts`).
- i18n (`src/i18n/`): 6 languages; `translations/en.ts` defines keys and the others are typed
  against it (missing key = compile error). `translate.ts` is dependency-free for services.
- Voice (`src/services/voice.ts`): expo-av recording → Gemini transcription (`audio/mp4`);
  read-aloud via expo-speech.
- Auth: phone + 6-digit passcode mapped onto Firebase Email/Password (`<10digits>@sih26091.app` —
  changing this domain would lock out existing accounts). `firebase.ts` uses RN persistence.

### Gemini (`src/services/gemini.ts`)

REST client, `x-goog-api-key`. Default model `gemini-3.5-flash-lite` for everything
(`gemini-2.5-*` return 404 for this key; `gemini-3.5-flash` was frequently timing out). Latency
varies a lot (2 s → 35 s for the same request); study calls allow 90 s. Indic output is
token-heavy — keep `maxOutputTokens` generous or JSON gets truncated (malformed JSON is retried
once).

### Design system

`src/constants/theme.ts` — white + the logo's orange (`Colors.primary` #F8921F), flat fills, no
gradients. Orange **text** uses `Colors.primaryText` (#B45309). Primitives: `src/components/ui.tsx`,
`sections.tsx` (Section, Tile, KeyValue, Bullets, Note), `badges.tsx`, `MoneyInput.tsx`, `Logo.tsx`.

### Legacy / not wired

- `src/services/BhashiniService.ts` is unused (placeholder credentials).
- `functions/main.py` (LangGraph Cloud Function) and `src/types/evaluation.ts` describe the old
  server pipeline; the app does not call it. `docs/firestore-schema.md` predates studies/sessions.
- Settings' notifications toggle and help/privacy/terms rows are placeholders.
