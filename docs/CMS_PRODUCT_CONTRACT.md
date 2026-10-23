# Travel Portal CMS Product Contract

**Status:** Product baseline for CMS VS1
**Purpose:** Define approved product behavior and domain semantics for the Travel Portal CMS.
**Audience:** Product Owner, Antigravity, Codex, reviewers, future implementation agents.

> This document describes **what the CMS must do and what product behavior has already been decided**.
> It is not an implementation guide. If code, schema, or architecture conflicts with this contract, do not silently reinterpret the product requirement.

---

## 1. Product Intent

Travel Portal is not a generic itinerary planner, attraction database, or CRUD travel journal.

The product starts from a real problem:

- real travel happens as continuous **time × space × experience**;
- photos, videos, social posts, location history, text, and other records are fragmented;
- existing social platforms do not naturally show an entire trip in geographic context;
- viewers often need to search individual attraction names manually to understand where the trip happened.

The current product focus is:

> **Reconstruct a real trip on a map, associate the trip with its actual visits and records, and let the user or audience understand the journey as a coherent spatial narrative.**

For CMS VS1, the core authoring philosophy is:

> **System reconstructs first; user trims and confirms.**

The CMS must not force the user to manually rebuild a trip that can already be inferred from source evidence.

---

## 2. Primary VS1 Goal

The first CMS vertical slice ends when the user can:

1. Create a Trip.
2. Enter the Trip date range.
3. Import a real Google Maps / Timeline JSON.
4. Reconstruct a usable trajectory.
5. Reconstruct Candidate Visits.
6. Review Visits by day.
7. Correct the minimum necessary Place / time / visibility information.
8. Confirm Visits.
9. Reach a **First Cruise Preview**.

The first meaningful product value is therefore:

> **Time-to-first-Cruise Preview**, not time-to-Publish.

---

## 3. VS1 Scope Boundary

### In scope

- Trip creation.
- Trip date range.
- Google Maps / Timeline JSON import.
- Trajectory reconstruction.
- Candidate Visit reconstruction.
- Daily Visit review.
- Required-issue navigation.
- Place correction.
- Add missing Visit.
- Time/order correction.
- Public / Private visibility.
- Pending / Confirmed review state.
- First Cruise Preview.
- CMS ↔ Preview round-trip.

### Explicitly out of scope for VS1

- Media upload.
- Media library.
- Social import.
- Instagram / Facebook / YouTube aggregation.
- Visit Highlight.
- Media Highlight.
- Travel-story / long-form writing.
- AI authoring.
- Full Publish workflow.
- Version history / rollback UI.
- Multi-user collaboration.
- Vehicle avatar switching.
- Advanced walking / rail map matching.
- Perfect trajectory smoothing.
- Completion percentages or completeness scores.
- Place Master CRUD dashboard.
- Database Movement entity.
- ItineraryItem entity.

### Stop rule

> **Any new design question that does not block Create Trip → First Cruise Preview is Deferred.**

---

## 4. Approved Domain Model

```text
Trip
├── Visit
│   └── Place
└── Trajectory
```

### Trip

A real travel journey covering a defined date range.

### Visit

One actual occurrence of visiting a location during a Trip.

A Visit is **event-like and trip-specific**.

### Place

A reusable real-world location identity.

The same Place can be referenced by multiple Visits.

### Trajectory

The trusted spatial path of the Trip.

### Movement

Movement is a **runtime/application narrative construct** used by Cruise playback.

It is **not** a CMS/database domain entity in VS1.

Do not add `Movement` or `ItineraryItem` as database/domain entities without explicit Product Owner approval.

---

## 5. Same-Place Revisit Rule

If the user visits the same real-world Place multiple times:

- preserve each actual occurrence as a separate Visit;
- reuse the same Place identity when appropriate.

Correct conceptual example:

```text
Place: 岡山車站
├── Visit A — 8/14 arrival
└── Visit B — 8/15 departure
```

Do **not** merge repeated real visits merely because PlaceID or coordinates match.

---

## 6. Trip Creation

### Required input

- Trip start date.
- Trip end date.

### Trip name

The user should not need to invent a Trip name before starting.

The system may auto-generate a name using:

> **year + month/season + primary city**

Examples:

- `2026 秋・岡山`
- `2026 8月・大阪`

The name remains editable.

### Region / city

City or region is descriptive and assistive only.

It must **not** hard-constrain Place recognition.

---

## 7. Source Import

### Initial VS1 source

Google Maps / Timeline JSON.

### Import principles

- Only the selected Trip date range is analyzed.
- Raw source evidence remains trusted/private.
- Visit edits must not mutate raw GPS/source evidence.
- Re-import / replacement must remain conceptually possible.
- Future re-import should preserve prior human decisions where possible.
- Contradictory evidence must be surfaced for user confirmation rather than silently arbitrated.

### Source metadata preservation

When present, preserve useful evidence such as:

- timestamps;
- coordinates;
- Google Place IDs;
- hierarchy information;
- source confidence/candidate data;
- transportation/activity hints such as `walking`, `in_train`, `flying`.

Preserving metadata does not imply that VS1 must display vehicle-specific Cruise behavior.

---

## 8. Candidate Visit Reconstruction

Candidate Visits are system-generated.

The default model is:

> **The Trip is reconstructed first. The user trims, corrects, and confirms it.**

### Approved rules

- Candidate Visits are included by default.
- Obvious very short stops around 3 minutes or less may be filtered as likely noise.
- Duration alone is not sufficient to define a meaningful Visit.
- Hotels, airports, and stations are valid Visits.
- Same Place revisits remain separate Visits.
- Nested / overlapping / same-second source records must not be flattened blindly.
- Ambiguities may be flagged for review rather than automatically resolved.
- Place matching should minimize the need for users to inspect raw coordinates.

### Merge suggestion

If two Candidate Visits are:

- adjacent in time;
- spatially close;
- and the movement between them is consistent with walking;

the system may suggest a merge.

Merge is a suggestion only.

The user may keep both Visits without resolving the suggestion.

If merged, the resulting Visit title must be explicitly chosen.

---

## 9. Daily Review Workflow

Visits are grouped by **date/day**.

The approved review rhythm is:

1. Scan the whole day.
2. Handle anomalies first.
3. Confirm the remaining normal Visits one by one.

### Anomaly priority

1. Time / order.
2. Place.
3. Merge suggestion.

A Visit that looks normal is **not auto-confirmed**.

---

## 10. Visit Basic Information

A Visit review surface must support the user understanding at least:

- Visit title.
- Place.
- inferred/manual start time.
- inferred/manual end time.
- visibility.
- review state.
- structural/anomaly state.

Evidence is **collapsed by default**.

The user should only inspect source evidence when the inferred result looks suspicious.

---

## 11. Time Semantics

The product should not manufacture false precision.

### Machine-inferred Visit time

Display at approximately **10-minute granularity** in CMS.

Example:

`14:20 – 15:50`

Underlying trusted data may preserve greater precision.

### Manually added Visit

Minute-level precision is allowed because transport/reservation cases may genuinely require it.

### Time correction

If order looks wrong, the user corrects **Visit start/end**, not raw GPS timestamps.

A structural time edit returns a Confirmed Visit to Pending.

---

## 12. Place Correction

If the inferred Place looks wrong:

1. Show nearby likely candidates.
2. Provide Place Search as fallback.

The user should not need to:

- reason from raw GPS coordinates;
- manually type latitude/longitude;
- edit raw trajectory.

Evidence such as distance/source reasoning remains hidden unless requested.

---

## 13. Add Missing Visit

If a real Visit was missed:

> Search Place on map → Add Visit directly.

A newly added Visit:

- starts as Pending;
- may use minute-level manually entered time;
- does not modify raw trajectory evidence.

Visit split is not required in VS1.

---

## 14. Product State Model

The product requires three independent state dimensions.

### Trip lifecycle

```text
Draft
Published
```

### Visit review

```text
Pending
Confirmed
```

### Visit visibility

```text
Public
Private
```

These concepts must not be collapsed.

Valid combinations include:

- Pending + Public
- Pending + Private
- Confirmed + Public
- Confirmed + Private

### Current schema warning

Current repository evidence has shown that:

- Trip publication lifecycle exists;
- Visit review status does not yet have an independent field;
- Visit visibility does not yet have a clean independent field.

A schema delta is therefore expected before full CMS integration.

Do not reinterpret existing `publication_status` semantics without an explicit migration/impact decision.

---

## 15. Visit Confirmation Contract

A Visit is never automatically Confirmed.

Minimum intended confirmation conditions:

- valid location reference;
- confirmed Place;
- title exists;
- visibility has been reviewed by the user;
- no unresolved structural conflict;
- explicit user confirmation.

### Confirmation invalidation

A structural edit returns:

`Confirmed → Pending`

Structural edits include at least:

- Place;
- location;
- start/end time;
- visibility.

---

## 16. Visibility

Default value may be:

> Public

But the user must visibly encounter/review the setting before confirmation.

### Private Visit

A Private Visit:

- remains part of the Trip;
- remains editable;
- is not deleted;
- is excluded from reader-facing Cruise.

“Went there” and “will publish it” are separate concepts.

---

## 17. Required vs Optional

CMS must visibly distinguish:

### Required issues

Examples:

- unconfirmed Visit;
- uncertain Place;
- unresolved time/order conflict;
- unusable trajectory.

Required issues should be prominent and navigable.

### Optional enrichment

Examples:

- travel experience description;
- Media;
- selected/promoted Media;
- Visit Highlight;
- Media Highlight;
- narrative title beyond default Place name.

Optional enrichment must not block First Cruise Preview.

### Explicitly rejected UI

Do not use:

- completion percentages;
- “Trip 63% complete”;
- generic completeness scores.

---

## 18. Preview Contract

Preview is an **editing tool**, not merely final QA.

The user may move repeatedly between:

> CMS ↔ Preview

### First Preview minimum

- at least 1 Confirmed + Public Visit;
- usable trajectory.

### Excluded from Preview

- Pending Visits.
- Private Visits.

### Not required for Preview

- Media.
- Description.
- Highlight.
- final Publish eligibility.

### Preview perspective

Preview must show the **reader-facing Cruise experience**.

Do not create a separate debug-style CMS overlay as the primary preview.

---

## 19. Draft Preview Architecture Direction

Approved product direction:

> Draft Preview uses an authenticated CMS-only preview path.

Preferred future architecture:

> dedicated authenticated Preview RPC / read model

It should return only privacy-safe Preview data needed by the existing Cruise runtime.

Do not:

- relax `api_public.*` to expose Draft data;
- temporarily mark a Draft Trip as Published;
- expose raw private GPS/timestamps to public frontend.

---

## 20. Existing Cruise Baseline to Preserve

CMS work must not casually reopen the accepted/near-accepted Cruise architecture.

Protected behavior includes:

- Visit-to-trajectory monotonic segmentation;
- stable camera follow bands;
- Visit arrival focus;
- narrative dwell buckets;
- day navigation decoupling;
- privacy-safe public read boundary.

Movement remains a runtime construct.

---

## 21. Current Reconstruction Evidence

The offline reconstruction probe has already demonstrated that raw Timeline input can be transformed into a plausible Candidate Visit skeleton and machine-readable anomaly output.

However:

> **Probe execution success is not the same as Product Owner reconstruction-quality acceptance.**

Any claim such as 100% Visit Recall / Precision must be validated against independently reviewed Product Owner ground truth before being treated as product truth.

---

## 22. Product Success Criterion

The CMS is succeeding when the user feels:

> **“The system reconstructed my trip, and I am mostly trimming and confirming it.”**

It is failing when the user feels:

> **“I still have to rebuild my trip manually.”**

This criterion should guide future reconstruction and usability decisions.
