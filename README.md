# chat-eevy — v1

Chat-native rebuild of the eevy assessment. Module-graph architecture,
but every user-facing journey is now **strictly unidirectional and
fully independent of every other journey**: a straight line from
questions to one result screen, then straight back to the main menu
— no branching redirects, no back buttons, no links between flows,
anywhere. Only the **Browse ("Show all EVs")** flow still ends at an
`eevy` button; every other flow (budget-only, Top 3, Loan/EMI,
Insurance) drops straight back to the main menu after its email gate,
with no "That's everything..." text and no button in between.

## Run locally

```bash
npm install
cp .env.example .env   # set VITE_WORKER_BASE_URL to your deployed
                        # assessment-v3-worker.js URL (e.g. https://eevy.in)
npm run dev
```

## Flow

Every journey ends by going back to the main menu (the 5
welcome-screen options) — for budget-only, Top 3, Loan/EMI, and
Insurance this happens straight after the email gate, with no text
and no button in between; Browse is the one exception, still ending
at an `eevy` button. Nothing else is offered at that point — no
suggested next module, no "start over" chip. It does *not* reset the
session — name, email, and `selected_vehicle_id` persist, so a second
journey (e.g. Loan/EMI right after finding a car) skips whatever's
already answered.

**"Find a car for my budget"** — standalone, one screen, no
selection required:
```
welcome → budget + city → name (first time only)
        → full budget-filtered list (browse only, nothing to tick)
        → "Back To Eevy" → "Shall I email you the list?" (first time only)
        → Send / Not now → straight back to the main menu
          (no "That's everything..." text, no 'eevy' button — this
          flow's ending is deliberately different from every other one)
```

**"Find the best EV for me"** — its own separate journey; does not
converge with the flow above:
```
welcome → budget + city → name (first time only)
        → Results, VERTICAL LIST, multi-select (exactly 5, or all if pool ≤5)
        → personalize Qs → Results, CAROUSEL, single-select Top 3
          (full specs shown inline, top match pre-selected)
        → "Back To Eevy" → "Shall I email you your top 3?" (first time only)
        → Send / Not now → straight back to the main menu
          (no "That's everything..." text, no 'eevy' button)
```

**Loan/EMI** and **Insurance** — both now price against an actual
vehicle, so both share the same car-selection gate. No forced
redirect through find-a-car and back — a genuine choice instead, and
the moment a car is confirmed, it drops straight back into whichever
calculator was actually asked for (no extra confirmation prompt):
```
enter Loan/EMI or Insurance
  → already have selected_vehicle_id? → skip straight to that module's own questions
  → otherwise → "How do you want to do that?"
      "I know which one"        → quick-pick chips (brand + model)
      "Find my Top 3 first"     → full find-best-EV flow (budget → tick 5
                                   → personalize → Top 3) — picking a car
                                   there continues straight back in
      "Let's browse"            → full browse flow (make → model → Detail)
                                   — picking a car there continues straight back in
  → (Loan/EMI) payment_mode question → full-screen calculator:
      full_cash  → on-road price card only (no EMI, no loan tiles)
      loan       → down payment + tenure + rate + income sliders,
                   live EMI preview → Continue
      not_sure   → income-only slider (20%/5yr/8.5% defaults) → Continue
    → on-road (+ EMI) estimate cards + live loan partner tiles
      (fetched from /api/partners/loans, tap a tile for details + Select)
    → "Continue" → "Shall I email you this EMI estimate?" (first time only)
  → (Insurance) first car / NCB / coverage-preference questions →
    full-screen premium breakdown (IDV, NCB discount, Zero-Dep loading,
    GST, total) + live insurance partner tiles
      (fetched from /api/partners/insurance, tap a tile for details + Select)
    → "Continue" → "Shall I email you these insurance options?" (first time only)
  → Send / Not now → straight back to the main menu
    (no "That's everything..." text, no 'eevy' button)
```

**Show all EVs** — pure browsing, not a graph module:
```
Show all EVs → make chips → model list for that make
             → full-screen Detail (specs, "Select this one" — no Back button)
             → name/email gates → eevy
```

Reloading the page resumes mid-conversation — session state persists to
`localStorage`, and the app reconstructs exactly which question you were
on from the last message in the restored history.

## What's real vs stubbed

**Real / wired:**
- Module graph, chat thread, bridging copy — as before.
- **"Find a car for my budget"** (`ev-budget-list` module): budget/city
  → the full budget-filtered pool shown as a plain list, no ticking, no
  forced continuation — terminal on this one screen.
- **"Find the best EV for me"** (`ev-budget` → `ev-personalize`):
  budget-match (vertical list, must select exactly 5, or all of them if
  the pool is ≤5) → personalize → Top 3 (carousel, single-select, full
  specs shown inline per card — see `src/modules/vehicleSpecs.js`).
  Scored **client-side** (`src/modules/scoring.js`, mirrors the worker's
  weighted formula exactly) from just the 5 picked, since
  `/api/v3/recommend` can't restrict scoring to a chosen subset. This
  flow no longer shares an entry point with "Find a car for my budget"
  — the two welcome chips now start two independent modules.
- **Car-selection gate** (`ensureVehicleSelected` in `ChatThread.jsx`) —
  shared by both Loan/EMI and Insurance now (both price against a real
  vehicle). Checks for an existing `selected_vehicle_id`; if there
  isn't one, offers a genuine choice — quick-pick (deduped brand+model
  chips, cheapest variant per model as the representative id), the
  full Top 3 flow, or the full browse flow. `pendingCarSelectionRef`
  holds the "resume whichever calculator was actually asked for"
  callback: the moment a car is confirmed through any of the three
  paths, it fires immediately instead of that path's own ending — Top
  3/browse's own email gate and menu-return never trigger mid-detour.
- **Loan/EMI calculator** (`AffordabilityScreen.jsx`, math in
  `src/modules/finance.js`, delivered via `deliverAffordabilityReward`
  → `onShowFinance` in `ChatThread.jsx`) — a full-screen overlay (not a
  chat bubble), ported from the original assessment's `getExShowroom()`
  / `updateAffordabilitySliders()` / `buildFinanceEstimates()`.
  Branches on `payment_mode`: `full_cash` gets an on-road price card
  only; `loan` gets the full down payment/tenure/rate/income sliders
  with a live EMI preview; `not_sure` gets an income-only version of
  the same slider with the same 20%/5yr/8.5% defaults as the original.
  On-road price prefers the selected vehicle's `price_min`, falling
  back to the budget-band midpoint if there's somehow still no
  selection.
- **Insurance premium calculator** (`InsuranceScreen.jsx`, math in
  `src/modules/finance.js`, delivered via `deliverInsuranceReward`) —
  also a full-screen overlay now. Ported from
  `buildInsuranceEstimates()`: IDV from on-road price, NCB discount,
  Zero-Dep loading, GST, rendered as a real estimate card instead of
  the old "not wired up" stub.
- **Live loan/insurance partner tiles** (`PartnerTiles.jsx`, embedded in
  both full-screen calculators) — fetches `/api/partners/loans` or
  `/api/partners/insurance` via the same `get()`/`unwrap()` plumbing as
  every other worker call (ported from
  `renderLoanTiles()`/`renderInsuranceTiles()`, which used a separate
  hardcoded-URL fetch in the old app — this version doesn't). Same
  "no live data → hide the section, no dummy fallback" behavior.
  Tapping a tile opens a detail popup (logo, description, feature list,
  Select button) — ported from `openPartnerPopup()`. Selecting is held
  in the screen's own state and only persisted (`selected_loan_partner`
  / `selected_insurance_partner` via the existing `saveAssessment`) once
  Continue is tapped — best-effort, same as other client-only fields
  (see the API-contract flag below).
- **Full-screen calculator plumbing** (`App.jsx`) — a `finance` screen
  alongside `results`/`detail`, driven by a single `financePayload`
  (`{ kind: 'affordability' | 'insurance', ...calculator data, onFinish }`).
  `ChatThread.jsx` calls `onShowFinance(payload)`; `App.jsx` renders
  `AffordabilityScreen` or `InsuranceScreen` based on `kind`, and wraps
  `onFinish` so tapping Continue switches back to the chat screen
  before resuming whatever `ChatThread` wanted to do next — same
  pattern as `onShowResults`/`handleContinue`.
- **Journey endings** — `afterReward(moduleId, nextFn)` takes an optional
  override for what happens after the email gate. Budget-only,
  ev-personalize (Top 3), Loan/EMI, and Insurance all pass
  `() => showWelcome(nameRef.current)` — straight back to the main menu,
  no text, no button. Only Browse still uses the default
  (`finishJourney`, unchanged): "That's everything for this one." then
  a single `eevy` button. Each flow's ending is independent — none of
  them link into another, **except** the deliberate Loan/EMI-and-Insurance
  ⇄ Top3/Browse detour above, which is a two-way hop by design, not a
  regression of that rule.
- Name capture gate before the first reward of any kind; email gate
  right after (any journey's) first real deliverable — both implemented
  as callback refs (`pendingPostNameActionRef` / `postEmailActionRef`),
  not moduleId branching, so any flow (including non-module ones like
  browse) can hook into them cleanly.
- Full-screen Results (`ResultsView.jsx`, multi-, single-, and
  no-selection modes) + Detail (only reachable via the browse flow now
  — no Back button). Selecting a vehicle saves `selected_vehicle_id`
  via the existing `/api/v3/save` allowlist.
- Explicit `saveAssessment` call right before every reward screen, on top
  of the existing per-answer saves.
- Session persistence via `localStorage` (`src/state/persistence.js`).

**Stubbed / simplified — flagged, not guessed at silently:**
- **`saveLead()` in `src/api/worker.js`** — name/email capture calls a
  `/api/lead` endpoint whose actual contract I don't have. Share that
  worker's source when ready to test this path.
- **`/api/partners/loans` and `/api/partners/insurance` — same
  unconfirmed-contract caveat as `/api/lead`.** I ported the fetch/shape
  handling verbatim from index.html (expects `{ result: [...] }` with
  fields like `bank_name`/`company_name`, `logo_url`, `min_interest_rate`,
  `top_2_features`, `feature_list`, `featured`, `feature_start/end`,
  `list_start/end`, `is_active`) since that's the only reference I have
  — but I haven't seen these two workers' actual source, so treat the
  field names as a best guess until you confirm them. Likewise
  `selected_loan_partner`/`selected_insurance_partner` are sent to
  `saveAssessment` on spec even though I don't know if they're on the
  `/api/v3/save` allowlist — harmless if not (silently ignored per the
  existing allowlist behavior), but not confirmed persisted either.
- **No way to back out of the Detail screen without selecting** — flagged
  explicitly when this was built: if someone opens a car's detail via
  "Show all EVs" and doesn't want it, there's no way back to the model
  list except picking it. Built this way deliberately per "no back
  buttons, no exceptions" — worth revisiting if it causes real friction.
- Charging/showroom modules are defined in the graph but currently
  unreachable — they had no dedicated main-menu entry before, and the
  generic suggestion mechanism that used to surface them
  (`getNextSuggestions` in `router.js`) is no longer called anywhere.
  The function itself is still there, just unused.
- A full session reset (`resetConversation()` in `ChatThread.jsx`, was
  the old "Start over" chip) still exists in code but isn't wired to any
  button currently — the `eevy` button is a soft return-to-menu, not a
  data wipe. Wire it up if a persistent reset control (e.g. a header
  button) is wanted.
- `src/components/widgets/SliderBubble.jsx` (the old fixed-₹12L-principal
  EMI slider) is no longer used anywhere — `AffordabilitySliders.jsx`
  replaced it entirely for the `affordability` module. Left in place
  rather than deleted; safe to remove.
- "I already own an EV" intent — intentionally left out this pass.
- The ranking used for "Find a car for my budget" (currently: the full
  budget-filtered pool, unranked/unfiltered further) is a deliberate
  placeholder — flagged for a separate discussion, not decided yet.

## Architecture notes

- `src/modules/graph.js` — module definitions, question schemas.
  **`ev-budget` and `ev-budget-list` are two separate modules now**,
  not one shared entry point — `ev-budget` still feeds
  `ev-personalize`/Top 3, `ev-budget-list` is a standalone terminal
  screen. Add a freetext field to an option via
  `freetextField: 'some_answer_key'` so typed text isn't silently
  discarded (see the `city_freetext` example).
- `src/copy/variants.js` — acknowledgement/bridging templates. Reads from
  a synchronous answers ref (see below), not React state directly.
- **Stale-closure discipline**: `ChatThread.jsx` uses `answersRef` /
  `completedModulesRef` / `nameRef` / `leadCapturedRef` as the source of
  truth for anything read *within* a single answer-handling chain
  (answer → save → next prompt/reward). `dispatch()`'d context state only
  updates on the next render, which is one step too late for a chain of
  synchronous logic reacting to what was "just" answered. Any new logic
  added here should read from these refs, not `state.X` directly.
- `src/modules/scoring.js` — client-side mirror of the worker's scoring
  formula. Keep this in sync if the worker's weights ever change. Only
  used by the `ev-personalize` (Top 3) flow, not `ev-budget-list`.
- **`enterModule(moduleId)`** in `ChatThread.jsx` is still the single
  entry point for "user wants to go do X" — it now intercepts both
  `affordability` and `insurance` for the car-selection gate (see
  above). Any new place that lets the user jump to a module should
  call this, not `startModule` directly.
- **Name/email gate callbacks**: `pendingPostNameActionRef` and
  `postEmailActionRef` hold a callback to run once the user answers,
  rather than branching on `moduleId`. Any new non-module flow (like
  browse) should hook in the same way rather than re-deriving "what to
  do next" from `activeModuleId`.
- `src/state/persistence.js` — localStorage read/write for session
  resume. Message ids are timestamp+random (not a simple counter)
  specifically so they don't collide with a restored history after a
  reload.
- App screen stack (`src/App.jsx`): `chat` | `results` | `detail` |
  `finance`. `ChatThread` stays mounted at all times (hidden via CSS
  `display:none`, not unmounted) so its internal refs survive switching
  screens.
