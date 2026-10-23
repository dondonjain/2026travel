# Travel Portal CMS — CP3 Reconstruction Ingestion Integration

**Checkpoint:** CMS CP3 — Reconstruction Ingestion Integration
**Prerequisites:**
- CMS UI CP1 implemented and passed Product Owner manual acceptance (`PRODUCT_ACCEPTED`).
- CMS Schema CP2 implemented and machine-verified (`MACHINE_VERIFIED`).

---

## 1. Mission

Integrate the already-validated offline reconstruction approach into the real CMS trusted write path.

The goal is:

> Google Timeline JSON → Draft Trip → reconstructed Places / Pending Visits / Trajectory

This checkpoint must make reconstructed trip data persist in the real system without changing approved product semantics or Cruise behavior.

Do not build new CMS UX in this checkpoint beyond the minimum wiring needed to prove persisted data can feed the already-accepted CP1 shell.

---

## 2. Ingestion Flow & Architecture

Target flow:

```text
Timeline JSON
→ parse source evidence
→ reconstruct trajectory
→ reconstruct Candidate Visits
→ resolve/reuse Place identities where supported
→ persist Draft Trip
→ persist Places
→ persist Pending Visits
→ persist trusted/private trajectory/source records
```

---

## 3. Reuse Validated Reconstruction Work

Reuse the existing Reconstruction Probe logic (`portal-web/scripts/probe/reconstruction-probe.mjs`) where appropriate.

Do not rewrite reconstruction from scratch unless repository constraints genuinely require it.

Preserve validated behaviors:
- Trip date-range filtering.
- Short-stop noise filtering (< 180 seconds / 3 minutes).
- Repeated real-world visits remain separate Candidate Visits.
- Repeated real-world Places can reuse Place identity.
- Nested / overlapping / same-second records are preserved or flagged rather than blindly flattened.
- Timeline transport/source metadata is preserved.
- Taiwan endpoint / out-of-trip anomaly does not silently become a normal Visit.
- Raw evidence remains distinct from derived reconstruction.

---

## 4. Trusted / Private Data Boundary

- Raw Timeline / GPS evidence must remain private/trusted.
- Do not expose raw timestamps or raw GPS through public frontend contracts.
- Visit edits must not mutate raw source evidence.
- Persist source provenance clearly enough that later reconstruction/re-import can be audited.

---

## 5. Trip Creation Behavior

- Start date and end date are required.
- Draft Trip is created with `publication_status = 'draft'`.
- Trip name is auto-generated using: `year + month/season + primary city` (editable later).
- Trip name must not block ingestion.
- Region metadata must not act as a hard Place-recognition boundary.

---

## 6. Visit Persistence

- Reconstructed Candidate Visits must enter CMS as `review_status = 'pending'`.
- Do not auto-confirm reconstructed Visits.
- Persist at minimum:
  - Trip relation (`trip_id`)
  - Place relation (`place_id`)
  - Title/default title
  - Inferred start/end timestamp
  - Location reference
  - Visibility (`visibility = 'public'`)
  - Review status (`review_status = 'pending'`)
  - Display ordering / date grouping information
  - Anomaly metadata or safe equivalent if supported

---

## 7. Place Behavior

- Same Place revisits must remain multiple Visits.
- Reuse one Place entity where source evidence can reliably establish shared identity (e.g. Google Place ID or spatial proximity with matching name/identity).
- Do not merge actual Visits.
- Distance alone without identity evidence must not force place deduplication.

---

## 8. Trajectory Behavior

- Persist usable trusted trajectory compatible with existing Cruise architecture.
- Do not add Movement database entities.
- Do not treat one full LineString as one permanent Movement entity.
- Do not expose raw/private trajectory publicly.
- Do not attempt perfect walking/train routing in this checkpoint.

---

## 9. Re-Import / Replacement Safety

- The product requires re-import/replacement to remain possible.
- Ingestion implementation must not structurally make future re-import impossible.
- Do not overwrite trusted source evidence in an unauditable way.

---

## 10. Scope Boundaries & Non-Scope

### Out of Scope for CP3:
- Redesigning accepted CP1 UI shell (`Trip → Day → Visit → Detail → Confirm → Preview`).
- Authenticated Draft Preview RPC (reserved for a later checkpoint).
- Exposing Draft Trips in `api_public.*`.
- Full Publish workflow.
- Media upload / Media library.
- Social import.
- AI authoring.
- Cruise playback redesign.

---

## 11. Required Executable Verification

Use a real/de-identified Golden Trip input (`portal-web/src/data/raw/Timeline.json`).

Verify at minimum:
1. **Import:** valid JSON succeeds, invalid JSON fails safely, only requested date range is used.
2. **Persisted Trip:** Draft Trip exists with correct date range.
3. **Visits:** Candidate Visits persisted as Pending, visibility defaults to public, short-stop noise filtered, repeated Place revisits remain separate Visits.
4. **Places:** Shared Place identity is reused where justified, Visit count and Place count are not forced 1:1.
5. **Trajectory:** Trusted trajectory exists, no obvious giant geographic jumps, source provenance preserved.
6. **Privacy:** Raw source records not accessible via public contract, Draft Trip not publicly exposed.
7. **Regression:** All existing 39 tests pass, TypeScript clean, secret scan PASS.

---

## 12. Stop Conditions

Stop and return `PRODUCT_DECISION_REQUIRED` if implementation requires:
- A new domain entity.
- Changing approved Trip / Visit / Place semantics.
- Exposing raw private data publicly.
- Changing `api_public.*` privacy behavior.
- Redesigning Cruise architecture.
- Changing CP1 interaction model.
- Redefining CP2 state semantics.

---

## 13. Completion State

When machine verification passes and evidence report is complete:
`READY_FOR_PRODUCT_OWNER_CMS_CP3_REVIEW`
