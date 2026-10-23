# Travel Portal CMS UI Checkpoint 1

**Checkpoint:** CMS UI CP1 — Responsive Trip Review Shell
**Implementation agent:** Antigravity (preferred for this checkpoint)
**Purpose:** Validate a single responsive CMS review workflow before connecting the full reconstruction/backend pipeline.

---

## 1. Mission

Implement the first CMS UI shell for Travel Portal.

This checkpoint validates:

> **Trip → Day → Visit → Detail → Confirm → Preview**

on both mobile and desktop.

The goal is not to complete CMS VS1.

The goal is to prove that the same interaction model works across devices without requiring users to relearn the product.

---

## 2. Authoritative Documents

Read these before implementation:

- `AGENTS.md`
- `PRODUCT.md`
- `ARCHITECTURE.md`
- `MVP_BEHAVIORAL_BASELINE.md`
- `DECISIONS.md`
- `TESTING.md`
- `CURRENT_STATUS.md`
- `docs/CMS_PRODUCT_CONTRACT.md`
- `docs/CMS_RESPONSIVE_UX_CONTRACT.md`
- `docs/CMS_VS1_VERIFICATION_MATRIX.md`
- `docs/CMS_UI_CHECKPOINT_1.md`

If existing project files contradict this checkpoint, stop and report the exact contradiction.

Do not silently reinterpret approved product behavior.

---

## 3. Scope

Implement only the responsive CMS Trip Review Shell.

Fixture/mock state may be used.

### In scope

- `/cms` entry.
- Trip list or minimal Trip selection.
- Trip Workspace.
- Day navigation.
- Visit list.
- Visit Detail.
- Pending / Confirmed visual state.
- Public / Private control.
- Required Issue summary/navigation.
- contextual Map open/close.
- Confirm → next Pending.
- Undo confirmation.
- Preview eligibility state.
- Preview transition placeholder or safe existing link.

### Out of scope

Do not implement:

- Timeline JSON import pipeline.
- Candidate Visit reconstruction.
- Supabase write integration.
- schema migrations.
- authenticated Preview RPC.
- final Publish.
- Media.
- Highlight.
- travel-story authoring.
- social import.
- AI authoring.
- external Place provider integration.
- vehicle-mode UI.
- advanced route editing.
- completion scoring.
- Cruise behavior changes.

---

## 4. Shared Interaction Contract

All viewports use:

```text
Trip
→ Day
→ Visit
→ Visit Detail
→ Confirm
→ Preview
```

Desktop and mobile must share:

- terminology;
- state semantics;
- field order;
- Confirm behavior;
- Required Issue behavior;
- Preview eligibility.

Layout may differ.

Workflow may not.

---

## 5. Desktop Layout

Preferred structure:

```text
┌───────────────────────────────────────────────────────────────┐
│ Trip Header       Required Issues              Preview         │
├────────────┬──────────────────────┬────────────────────────────┤
│ Days       │ Visit List           │ Visit Detail               │
│            │                      │                            │
│ Day 1      │ Visit A              │ Title                      │
│ Day 2      │ Visit B              │ Place                      │
│ Day 3      │ Visit C              │ Time                       │
│ ...        │ ...                  │ Visibility                 │
│            │                      │ Issues                     │
│            │                      │ Evidence                   │
│            │                      │ Map                        │
│            │                      │ Confirm                    │
└────────────┴──────────────────────┴────────────────────────────┘
```

The product concept is **Visit Detail**.

Do not make “right panel” a domain concept.

---

## 6. Mobile Layout

Use progressive navigation:

```text
Trip
↓
Day
↓
Visit list
↓
Visit Detail
```

Visit Detail becomes a mobile full-screen view.

Do not compress the desktop three-column layout.

---

## 7. Visit Detail

Default information order:

1. title;
2. Place;
3. start/end;
4. visibility;
5. issues;
6. evidence entry;
7. map entry;
8. Confirm.

Evidence is collapsed by default.

---

## 8. Fixture State

Use realistic fixture data, for example:

- ~7 days;
- ~33 Visits;
- mix of Pending and Confirmed;
- several Required Issues;
- both Public and Private;
- at least one Confirmed + Private Visit;
- at least one Place issue;
- at least one time/order issue;
- at least one normal Pending Visit.

Fixture data must not create new domain rules.

---

## 9. Visit State

Represent the approved conceptual states:

### Review

- Pending
- Confirmed

### Visibility

- Public
- Private

Do not collapse these.

Do not alter database schema in CP1.

---

## 10. Confirm Behavior

Approved state transition:

```text
Pending
→ Confirm
→ Confirmed
→ next Pending Visit
```

Provide a short-lived Undo action.

Undo returns:

`Confirmed → Pending`

For CP1, if no Pending Visit remains in the current day, return naturally to the day state or the next available unresolved item.

Do not invent a bulk-confirm workflow.

---

## 11. Structural Editing Behavior

For UI-state simulation, edits to structural fields should invalidate confirmation.

Examples:

- Place;
- time;
- visibility.

Expected transition:

`Confirmed → Pending`

This should be represented in UI fixture behavior even before real persistence exists.

---

## 12. Visibility

Display:

- Public
- Private

Do not display internal schema names.

Default fixture value may be Public.

The user must visibly encounter/review visibility before confirmation.

---

## 13. Required Issues

Required Issues should appear at:

- Trip level;
- Day level;
- Visit level.

Selecting an issue navigates into the same Day → Visit → Detail workflow.

Do not create a separate issue dashboard.

Do not show completion percentages.

---

## 14. Contextual Map

Map is not permanently required.

Provide `View on map`.

### Desktop

Map may open in the Visit Detail area or contextual workspace.

### Mobile

Map should open full-screen.

For CP1:

- fixture nearby Place candidates are acceptable;
- external Place Search provider is not required.

Do not implement raw GPS editing.

---

## 15. Time Display

Machine-inferred fixture times should display at approximately 10-minute granularity.

Example:

`14:20 – 15:50`

Do not display second-level precision in the normal review UI.

---

## 16. Preview

Preview entry must be visible on desktop and mobile.

Eligibility contract:

> usable trajectory + at least 1 Confirmed + Public Visit

CP1 may simulate `usable trajectory` with fixture state.

### Eligible

Preview action is available.

### Ineligible

Explain the requirement clearly.

Example:

> Confirm at least one Public Visit to preview.

### Transition

Use the existing safe Cruise route if appropriate, or a non-destructive placeholder transition.

Do not implement Draft Preview backend integration in CP1.

Do not modify Cruise behavior.

---

## 17. Responsive Safety

Core workflow must not require:

- hover;
- drag-and-drop;
- keyboard shortcuts;
- right click;
- precise pointer interaction.

Desktop keyboard shortcuts may be added later only as enhancement.

---

## 18. Acceptance Scenario

Verify the same task on both desktop and mobile:

1. Open a Trip.
2. Open Day 3.
3. Find a Pending Visit.
4. Open Visit Detail.
5. Inspect title, Place, time, visibility.
6. Open contextual Map.
7. Return to Visit Detail.
8. Confirm the Visit.
9. Automatically advance to next Pending Visit.
10. Undo confirmation.
11. Navigate to another Required Issue.
12. Observe Preview eligibility.
13. Trigger Preview transition.

Success criterion:

> A user switching devices should recognize the same workflow immediately.

---

## 19. Required Verification Evidence

Provide reproducible evidence for:

- desktop viewport;
- mobile viewport;
- responsive transition;
- Pending → Confirmed;
- Confirmed → Undo → Pending;
- Confirm → next Pending;
- structural edit → Pending;
- Required Issue navigation;
- Public / Private rendering;
- Map open/close;
- Preview eligible/ineligible state;
- build/typecheck/tests.

Do not declare Product Acceptance.

---

## 20. Agent Stop Conditions

Stop and return `PRODUCT_DECISION_REQUIRED` if implementation requires:

- changing domain semantics;
- changing approved responsive hierarchy;
- schema migration;
- privacy/public-contract changes;
- Cruise behavior changes;
- a new domain entity;
- unresolved contradiction among authoritative documents.

Do not solve those by inventing a workaround.

---

## 21. Required Agent Report

Return:

1. Files changed.
2. UI architecture implemented.
3. Desktop behavior.
4. Mobile behavior.
5. Fixture/state approach.
6. State transitions implemented.
7. Tests/build executed.
8. Desktop verification evidence.
9. Mobile verification evidence.
10. Known limitations.
11. Product decisions encountered, if any.

End with exactly one:

`READY_FOR_PRODUCT_OWNER_CMS_UI_CP1_REVIEW`

or:

`PRODUCT_DECISION_REQUIRED`

---

## 22. Product Owner Review Focus

The Product Owner should judge:

- Does mobile feel like the primary product, not a shrunken desktop UI?
- Does desktop feel like a denser version of the same product?
- Is Day → Visit → Detail obvious on both?
- Is Confirm fast enough on mobile?
- Does next-Pending behavior reduce repetitive work?
- Are Required Issues easy to navigate without creating a second workflow?
- Is Map available when needed without dominating review?
- Does Preview feel like switching to reader mode?
- Does switching between devices require relearning?

CP1 passes only after Product Owner usability review.
