# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Niti Mitra (repo/package name `sih26091-business-advisory`) — an AI business advisor for rural
Indian micro-entrepreneurs. Expo/React Native client that talks to Gemini directly and stores
history in Firebase; a Python Cloud Function pipeline also exists in `functions/` but the app no
longer calls it.

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
- No test runner is configured.
- EAS (`eas.json`): `eas build --profile development | preview | production`.
- `firebase deploy --only firestore:rules` — `firestore.rules` is only enforced once deployed.

**Setup**: copy `.env.example` → `.env` and set `EXPO_PUBLIC_GEMINI_API_KEY` (optionally
`EXPO_PUBLIC_GEMINI_CHAT_MODEL` / `EXPO_PUBLIC_GEMINI_REASONING_MODEL`). `.env` is gitignored but
*not* in `.easignore`, so EAS uploads it. `EXPO_PUBLIC_*` values are inlined into the JS bundle —
the key is extractable from the app; production should proxy Gemini through a backend.

## Architecture

### Layout: `app/` is routes only

expo-router turns **every** file under `app/` into a route, so non-screen code lives in `src/`
(`services/`, `context/`, `i18n/`, `components/`, `hooks/`, `types/`, `utils/`, `constants/`).
Don't add helpers under `app/`.

### Navigation & onboarding

`app/_layout.tsx` wraps a root `Stack` (screen `animation: "none"` — the UI is deliberately
motion-free) in `I18nProvider` → `SettingsProvider` → `AuthProvider` → `ChatProvider`. The
onboarding gate lives in `app/(tabs)/_layout.tsx`: it `<Redirect>`s to `/language` until a language
has been chosen, to `/auth` until a user is signed in, and to `/preferences` while
`user.preferences === null` (never answered); only then does it render the four tabs (Home,
Evaluate, History, Settings). `app/auth.tsx` redirects to the tabs once `user` is set.
`app/session/[id].tsx` is the History detail screen; `app/profile.tsx` edits the name;
`app/preferences.tsx` is the questionnaire (onboarding and edit mode — edit mode starts with a
language step that switches the UI live). Route files export expo-router's
`ErrorBoundary` (`src/components/ErrorFallback.tsx`) so render errors show a retry screen rather
than a blank one.

### i18n (`src/i18n/`)

`I18nContext` holds the UI language (persisted in AsyncStorage) and exposes `t(key, params)`.
`translations/en.ts` defines the keys; every other language file is typed `Translations`, so a
missing key is a compile error. Adding a language = a row in `languages.ts` + a translation file +
an entry in `translations/index.ts`. Gemini is told to answer in the same language, so AI output
follows the UI language automatically. Text computed in code (risk flags, scheme reasons) is
stored as translation keys, not strings, so it re-renders in whatever language is current.

### Preferences (`src/services/preferences.ts`)

Ten single-choice questions (gender, age, location, occupation, experience, traditional trade,
social category, income, savings, existing EMI), stored as `/users/{uid}.preferences` — option ids,
or `other:<typed text>`. `describeProfile()` turns them into English lines injected into every
Gemini prompt ("never ask about these again"); `deriveFacts()` maps buckets to numbers
(income/EMI midpoints, category, trade) that `draftIdea` uses to fill scheme-relevant gaps.
`AuthContext.updateProfile({ fullName?, preferences? })` persists and updates `user` in place.

### Evaluate flow

`src/context/ChatContext.tsx` owns the conversation and its stage:
`chatting` →(Evaluate)→ `drafted` →(Proceed)→ `evaluated`; "Refine" goes `drafted` → `chatting`.
It sits above the tabs so the chat survives tab switches, and writes every change to Firestore.
Async steps compare against `sessionRef` so a late Gemini reply can't land in a different session.

The chat is **question-driven, not free-form**: every advisor turn is JSON
`{ message, question: { text, options[{label, description}] } | null, readyToEvaluate, facts }`,
rendered as a card of tappable options; the composer (type or mic) is always the "other" answer.
The first question is static and translated (`buildIntroMessage`) and is stored as message 0 once
answered. `ChatMessage.question` / `readyToEvaluate` persist with the session.

`src/services/AdvisorService.ts` implements the Gemini calls:
- `getChatReply` — collects 8 facts (product, place, price, sales, unitCost, fixedCosts,
  startupMoney, funding). **Readiness is decided in code**: the model must quote the user's words
  for each fact in `facts` (null if unsaid); if it claims ready with gaps it is re-asked once
  naming them. Typed replies are replayed as `(Answering: "<question>") …` so off-topic answers
  don't count. `focus` forces questions about specific gaps — "Refine in chat" passes what the
  draft was missing.
- `draftIdea` — JSON-mode extraction of the transcript into an `IdeaDraft` (null for unknowns).
- `evaluateIdea` ("Proceed") — computes numbers with `src/services/financials.ts`
  (EMI, DSCR, break-even, payback, risk level, flags, PM-Vishwakarma/PM-DAKSH/NSFDC matching),
  then has Gemini write the score/verdict/strengths/risks/next steps around those fixed numbers.
  The LLM never does the arithmetic.
- `transcribeAudio` — speech-to-text (below).

`src/services/gemini.ts` is a plain REST client (`x-goog-api-key` header, 45 s timeout, one retry
on 429/5xx or a `fallbackModel` instead; malformed JSON is retried once). Both models default to
`gemini-3.5-flash-lite`: `gemini-3.5-flash` was timing out (>15 s) for this key — opt in via
`EXPO_PUBLIC_GEMINI_REASONING_MODEL`, and draft/report then cap it at 15 s and fall back.
`gemini-2.5-*` return 404 for this key. Indic output is token-heavy: keep `maxOutputTokens` high
(4096 for draft/report) or JSON gets truncated.

### Voice (`src/services/voice.ts`, `src/hooks/useVoiceInput.ts`)

Mic → `expo-av` recording (AAC `.m4a`) → base64 → Gemini transcription with
`mimeType: "audio/mp4"`; the transcript is put in the input box for review, not auto-sent.
Read-aloud uses `expo-speech` with the UI locale (per-message speaker button; auto-read when
Settings → "Read replies aloud", stored by `SettingsContext` in AsyncStorage). Both are native
modules: a build made before they were added won't have them — rebuild the APK.

**Keep `financials.ts` and `functions/main.py` in step**: the risk thresholds (DSCR < 1.0 high,
≤ 1.25 moderate) and scheme eligibility rules are duplicated from `financial_agent_node` /
`validator_node` / `_match_government_schemes`. The client version also adds the EMI of the
requested loan (12 % p.a., 3 years — `LOAN_INTEREST_RATE` / `LOAN_TENURE_YEARS`) to debt service.

### Persistence (`src/services/HistoryService.ts`)

One document per conversation at `/users/{uid}/sessions/{sessionId}` holding `messages`, `draft`,
`report`, `stage`, `language`, and epoch-ms `createdAt`/`updatedAt` (numbers, not
`serverTimestamp()`, so ordering works while writes are pending offline). History and Home read it
through `src/hooks/useSessions.ts` (`onSnapshot`, real-time, `orderBy updatedAt desc`).
Types are in `src/types/session.ts`.

`firestore.rules` grants each user read/write on `/users/{uid}/**` only. Deploy it — sessions are
unreadable under rules without a match for the subcollection.

### Auth & Firebase

- `AuthService` fakes phone+passcode auth on Firebase Email/Password: a 10-digit number becomes
  `<10digits>@sih26091.app` and the 6-digit passcode is the password. Failures are thrown as
  `AuthError` with a `reason` the auth screen maps to a translation key. Profiles are
  `/users/{uid}` with `fullName`/`phoneNumber`/`createdAt`/`preferences`; the phone number is
  the login identity and is not editable.
- `src/services/firebase.ts` uses `initializeAuth` with `getReactNativePersistence(AsyncStorage)`
  (otherwise RN auth is in-memory and users are logged out every launch) — that function exists
  only in firebase/auth's RN build, hence the cast — and `initializeFirestore` with
  `ignoreUndefinedProperties`. Both fall back to the getters on Fast Refresh re-runs. The Firebase
  web config is hardcoded there.

### Design system

`src/constants/theme.ts` — white + the logo's orange (`Colors.primary` #F8921F) as the single
accent, flat fills only (no gradients or coloured shadows). Orange **text** must use
`Colors.primaryText` (#B45309) — the brand orange is too faint as text on white; `primary` is for
fills, borders, spinners. Shared primitives (`Button`, `Card`, `ScreenHeader`, `EmptyState`,
`InlineError`, `FullScreenLoader`) are in `src/components/ui.tsx`; the logo is
`src/components/Logo.tsx`. App icon/adaptive icon/splash in `assets/images/` were generated from
`logo.avif`. Don't hardcode hex values in screens; use `Colors.textInverse` for white-on-orange.

### Not wired / legacy

- `src/services/BhashiniService.ts` (BHASHINI ASR/MT/TTS) is unused; credentials are placeholders.
- On-device inference was removed. `assets/models/qwen2-0.5b-instruct-q4_0.gguf` may still exist
  locally (gitignored, and now excluded in `.easignore`); nothing references it.
- Settings' notifications toggle and the help/privacy/terms rows are placeholders.

### Backend (`functions/main.py`, not called by the app)

Firebase Gen 2 callable `evaluate_business_idea` (`asia-south1`) running a LangGraph pipeline
`orchestrator → hyperlocal_scraper (Google Places / OSM) → financial_agent → validator`, needing
`GOOGLE_PLACES_API_KEY` and `GEMINI_API_KEY`. Its request/response contract is typed in
`src/types/evaluation.ts`. It persists to `/users/{userId}/ideas/{ideaId}` with camelCase top-level
keys but **snake_case nested maps**, which `docs/firestore-schema.md` documents as camelCase; that
doc also predates `/sessions`.
