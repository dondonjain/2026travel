# Travel Portal CMS VS1 Verification Matrix

**Status:** Canonical VS1 acceptance and verification contract
**Purpose:** Define how CMS VS1 requirements are verified without confusing machine evidence with Product Owner acceptance.

---

## 1. Verification Philosophy

VS1 uses a three-gate model.

### Gate A — Machine Verified

Machine-executable verification proves deterministic behavior and technical constraints.

Passing Gate A allows only:

`READY_FOR_PRODUCT_OWNER_ACCEPTANCE`

It does **not** mean the product has been accepted.

### Gate B — Product Owner Acceptance

The Product Owner uses real trip data and evaluates:

- whether reconstruction is credible;
- whether the user is mostly trimming rather than rebuilding;
- whether review effort is reasonable;
- whether mobile/desktop interaction is understandable;
- whether First Cruise Preview feels like the user’s real trip.

Passing Gate B allows:

`PRODUCT_ACCEPTED`

### Gate C — Regression Baseline

After Product Owner acceptance:

- create a Git checkpoint;
- preserve Golden fixture/evidence;
- add regression protection;
- document accepted behavior.

---

## 2. Failure Classification

When an acceptance case fails, classify it before repairing.

### A. Regression / Bug

Expected deterministic behavior is already clear.

Agent may repair within approved architecture.

### B. Reconstruction Quality

Parsing, Visit reconstruction, Place matching, trajectory, or source interpretation is insufficient.

Diagnose using data/evidence before changing product semantics.

### C. Usability

Function technically works, but the workflow is difficult or confusing.

Requires UX adjustment and Product Owner review.

### D. Product Decision

Expected behavior, domain meaning, privacy, schema, or architecture is ambiguous.

Stop.

Do not autonomously redesign.

Return:

`PRODUCT_DECISION_REQUIRED`

---

## 3. Golden Trip

Use a real, de-identified Japanese trip as the Golden Trip.

Ideal characteristics:

- 5–7 days;
- airports;
- hotels;
- stations;
- attractions;
- restaurants;
- walking/transit/driving;
- same Place revisits;
- short-stop noise;
- ambiguous Place cases;
- at least one missed/misdetected boundary case.

### Ground Truth

Ground Truth should include:

- daily real Visit list;
- correct Place;
- approximate start/end;
- repeated-Place cases;
- exclusions;
- acceptable manual-correction cases.

Public/Private is editorial and should not be part of reconstruction Ground Truth.

---

## 4. Reconstruction Metrics

Record metrics without inventing hard KPI thresholds during the first baseline run.

Possible metrics:

- Visit Recall.
- Visit Precision.
- Place Top-1 Accuracy.
- Place Recoverability.
- Manual Repair Load:
  - added Visits;
  - false-positive removal/private decisions;
  - Place corrections;
  - time corrections.

Important:

> Matching total counts is not sufficient to claim 100% Recall / Precision.

Metrics should be based on Visit-level ground-truth matching.

---

# 5. Official Acceptance Criteria

## AC-01 — Create Trip

### Requirement

- start/end date required;
- creates Draft Trip;
- auto Trip name using year + month/season + primary city;
- name editable later;
- region does not hard-bind Place recognition.

### Verification

**Primary:** Automated

### Machine evidence

- validation rejects missing date range;
- Draft state created;
- auto-name generated;
- name remains editable;
- region metadata does not constrain Place matching code path.

---

## AC-02 — Google Maps / Timeline JSON Import

### Requirement

- parses valid supported JSON;
- invalid format does not crash the CMS;
- only selected Trip range is analyzed;
- raw/private source data is not exposed publicly;
- Visit edits do not mutate raw source evidence;
- replacement/re-import remains conceptually supported.

### Verification

**Primary:** Automated

### Machine evidence

- parser test fixtures;
- invalid-input tests;
- range-selection tests;
- source immutability checks;
- privacy/read-boundary tests.

---

## AC-03 — Trajectory Reconstruction

### Requirement

- reconstructs usable trajectory;
- correct Trip date range;
- no obvious uncontrolled geographic jumps;
- existing Cruise runtime can conceptually consume it;
- reconstruction failure does not make CMS inaccessible.

### Verification

**Primary:** Hybrid

### Machine evidence

- geometry validity;
- range coverage;
- large-jump detection;
- output contract;
- integration compatibility.

### Product Owner check

Trajectory should look trustworthy enough to recognize the trip.

---

## AC-04 — Candidate Visit Reconstruction

### Requirement

- system reconstructs Candidate Visits;
- obvious ≲3 minute noise may be filtered;
- duration is not the only semantic rule;
- hotel/airport/station can remain valid;
- same Place revisits remain separate Visits;
- candidates are pre-included.

### Verification

**Primary:** Hybrid

### Machine evidence

- reconstruction output;
- short-stop filtering;
- repeated-Place handling;
- source metadata preservation.

### Product Owner check

The resulting trip should be mostly **trimmed**, not rebuilt.

---

## AC-05 — Daily Review

### Requirement

- Visits grouped by date;
- user can scan a whole day;
- anomalies first;
- remaining Visits confirmed individually;
- anomaly priority:
  1. time/order;
  2. Place;
  3. merge suggestion.

### Verification

**Primary:** Automated + UX PO

### Machine evidence

- grouping;
- issue ordering;
- navigation behavior.

### Product Owner check

Daily review feels natural and does not force unnecessary work.

---

## AC-06 — Visit Basic Information

### Requirement

Visit Detail exposes:

- title;
- Place;
- start/end;
- Public/Private;
- Pending/Confirmed;
- anomaly/structural state.

Machine-inferred time is shown around 10-minute precision.

Evidence is collapsed by default.

### Verification

**Primary:** Automated + PO information-sufficiency review

---

## AC-07 — Place Correction

### Requirement

- nearby likely Place candidates first;
- Search fallback;
- raw coordinate reasoning is not required.

### Verification

**Primary:** Hybrid

### Product Owner check

Correction effort is low enough for normal travel review.

---

## AC-08 — Add Missing Visit

### Requirement

- search Place on map;
- add Visit directly;
- new Visit starts Pending;
- manual time may use minute precision;
- raw trajectory remains unchanged.

### Verification

**Primary:** Automated

---

## AC-09 — Time / Order

### Requirement

When travel order looks wrong:

1. check missing Visit;
2. check wrong Place;
3. only then adjust Visit time.

Time edits:

- change Visit start/end;
- do not alter raw GPS;
- structural edit returns Confirmed → Pending.

### Verification

**Primary:** Automated + PO

---

## AC-10 — Visibility

### Requirement

- default Public;
- visibility must be visible/reviewed before confirmation;
- Private Visit remains in Trip;
- Private Visit is excluded from reader-facing Cruise.

### Verification

**Primary:** Automated

---

## AC-11 — Confirmation

### Requirement

A Visit becomes Confirmed only when:

- location is valid;
- Place is confirmed;
- title exists;
- visibility has been reviewed;
- no unresolved structural conflict remains;
- user explicitly confirms.

Structural edit returns Confirmed → Pending.

### Verification

**Primary:** Automated

---

## AC-12 — Required Issues

### Requirement

- unresolved mandatory items are prominent;
- user can navigate to them;
- optional content does not block;
- no completeness percentage.

### Verification

**Primary:** Automated + PO

---

## AC-13 — First Cruise Preview

### Requirement

Minimum:

- usable trajectory;
- at least 1 Confirmed + Public Visit.

Rules:

- Pending excluded;
- Private excluded;
- no Media required;
- no description required;
- no Highlight required;
- Publish blockers do not block Preview.

### Verification

**Primary:** Automated + PO

### Product Owner check

The no-media first Cruise should still feel recognizably like the user’s trip.

---

## AC-14 — CMS ↔ Preview Round Trip

### Requirement

- enter Preview;
- return to CMS;
- no data loss;
- no state corruption;
- repeatable;
- same behavior on supported responsive layouts.

### Verification

**Primary:** Automated

---

## 6. Machine Gate

Before requesting Product Owner acceptance, verify at minimum:

- build/typecheck;
- parser/import tests;
- trajectory tests;
- Candidate Visit reconstruction tests;
- Visit state transitions;
- visibility rules;
- privacy boundary;
- Preview eligibility;
- CMS ↔ Preview round trip;
- relevant responsive interaction tests;
- Golden Trip reconstruction run.

Successful machine verification ends with:

`READY_FOR_PRODUCT_OWNER_ACCEPTANCE`

Never `PRODUCT_ACCEPTED`.

---

## 7. Product Owner Acceptance

Use real trip data.

Review:

- trajectory trustworthiness;
- Candidate Visits mostly represent real visits;
- user mainly trims rather than rebuilds;
- date → anomalies → confirm rhythm feels natural;
- Place correction is low effort;
- 10-minute time display is understandable;
- mobile flow is comfortable;
- desktop does not require relearning;
- time-to-first-Cruise occurs before user fatigue;
- First Cruise feels recognizably like the trip.

Product Owner may classify failures as:

- Bug;
- Reconstruction Quality;
- Usability;
- Product Decision.

---

## 8. Definition of Done

CMS VS1 is not Done until both are true:

1. Machine gate passes.
2. Product Owner accepts the real workflow.

After acceptance:

- create checkpoint;
- preserve accepted Golden evidence;
- lock regression behavior.

---

## 9. Current Reconstruction Probe Note

An offline probe has executed successfully and produced machine-readable Candidate Visits/anomaly evidence.

Treat this as:

> **Probe Execution Verified**

Do not automatically elevate it to:

> **Reconstruction Quality Accepted**

until Product Owner ground-truth review is complete.
