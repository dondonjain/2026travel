# Travel Portal CMS — CP2 Visit State Schema Contract

**Checkpoint:** CMS CP2 — Visit State Schema Impact Analysis & Minimal Migration
**Prerequisite:** CMS UI CP1 has been implemented and passed Product Owner manual acceptance.
**Mission:** Make the approved CMS Visit state model persistable without changing existing product behavior, Cruise behavior, or public privacy boundaries.

---

# 1. Context

CMS UI CP1 has established and Product Owner has accepted the responsive interaction model:

> Trip → Day → Visit → Detail → Confirm → Preview

CP1 currently represents Visit states at the UI / fixture layer.

CP2 exists to make those approved product states representable in the actual database.

This checkpoint is **not** a CMS feature-expansion task.

---

# 2. Authoritative Documents

Read before changing anything:

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

Also inspect all existing Supabase migrations, views, RPCs, import scripts, tests, and frontend adapters that reference Visit publication state.

Do not infer semantics from column names alone.

Trace actual reads and writes.

---

# 3. Approved Product State Model

The Product Owner has already approved three independent state dimensions.

## Trip lifecycle

```text
Draft
Published
```

## Visit review state

```text
Pending
Confirmed
```

## Visit visibility

```text
Public
Private
```

These dimensions must remain independent.

The system must be able to represent at minimum:

```text
Pending + Public
Pending + Private
Confirmed + Public
Confirmed + Private
```

Do not ask the Product Owner to reconfirm this model.

---

# 4. Known Current Gap

Previous repository analysis found:

- `app.trips.publication_status` exists and represents Trip publication lifecycle.
- `app.visits` does not have an independent Visit review/confirmation field.
- `app.visits` does not have a clean independent Public/Private visibility field.
- existing Visit `publication_status` has historically participated in public-read filtering.

Therefore:

> `SCHEMA_DELTA_REQUIRED`

However, the exact role and safe deprecation path of existing `app.visits.publication_status` must be established from repository evidence before migration.

---

# 5. Phase A — Impact Analysis

Before writing a migration, trace every meaningful dependency on:

```text
app.visits.publication_status
```

At minimum inspect:

- Supabase migrations
- `api_public.*`
- `api_cms.*`
- RPCs
- RLS / policies
- import scripts
- fixture importers
- frontend adapters
- Cruise data loaders
- tests
- development scripts
- documentation that describes its semantics

Produce an impact table:

| Dependency | Read / Write | Current semantics | Would new review_status affect it? | Would new visibility affect it? | Action needed now? |
|---|---|---|---|---|---|

---

# 6. Required Semantic Questions

Answer from repository evidence:

## A. Trip lifecycle

Confirm whether:

```text
app.trips.publication_status
```

should remain unchanged.

Expected product direction:

> Yes. Trip Draft / Published remains a Trip-level lifecycle.

Do not modify it unless repository evidence reveals a blocking contradiction.

---

## B. Visit review

Determine whether any existing field already legitimately represents:

```text
Pending / Confirmed
```

Expected current answer is no, but verify.

---

## C. Visit visibility

Determine whether any existing Visit field already legitimately represents:

```text
Public / Private
```

Do not simply rename or reinterpret `publication_status` because its name looks related.

Trace its real use.

---

## D. Legacy Visit publication_status

Classify existing:

```text
app.visits.publication_status
```

as one of:

- still-required independent concept;
- legacy compatibility field;
- safely deprecatable later;
- removable only in a future migration;
- ambiguous → `PRODUCT_DECISION_REQUIRED`.

Do not drop the column in CP2.

---

# 7. Target Schema for CP2

Unless Phase A finds a genuine product/domain contradiction, the intended minimum target is:

```text
app.visits.review_status
  pending | confirmed

app.visits.visibility
  public | private
```

Recommended semantics:

### review_status

```text
text NOT NULL
DEFAULT 'pending'
CHECK (review_status IN ('pending', 'confirmed'))
```

### visibility

```text
text NOT NULL
DEFAULT 'public'
CHECK (visibility IN ('public', 'private'))
```

Column naming may follow existing repository conventions if an equivalent clear naming convention already exists.

Do not introduce generalized workflow/status frameworks.

Do not introduce new tables merely to hold these two states.

---

# 8. Legacy Data Migration Rule

Existing production/fixture behavior must not silently change.

If existing rows require backfill, derive a compatibility mapping from **actual current behavior**, not from desired future semantics.

For example, if repository evidence confirms:

```text
Visit publication_status = published
```

currently means that the Visit is exposed through the public contract, then it is reasonable to backfill those rows as:

```text
visibility = public
```

Rows not currently publicly exposed may be backfilled as:

```text
visibility = private
```

only if this preserves existing exposure behavior.

Important:

> This is a one-time compatibility backfill. It does NOT redefine `publication_status` as the new visibility model.

Document the mapping explicitly.

For `review_status`, do not mark historical rows Confirmed merely because they are Published unless there is trustworthy evidence that a human confirmation decision actually occurred.

Default to:

```text
pending
```

unless repository evidence justifies a safer compatibility state.

---

# 9. Do Not Change Public Behavior Yet

CP2 is a schema/state persistence checkpoint.

Do not yet redesign:

- `api_public.*`
- Draft Preview
- Preview RPC
- Cruise runtime
- public filtering behavior

Existing public users must continue seeing the same published content after migration.

If adding `visibility` requires changing public views merely to preserve current behavior, make the smallest compatibility update possible and document it.

Do not expand public access.

---

# 10. Confirmation Contract Support

The schema must support future CMS behavior:

```text
Pending
→ explicit user Confirm
→ Confirmed
```

and:

```text
Confirmed
→ structural edit
→ Pending
```

Structural edits include at minimum:

- Place
- location
- Visit start/end
- visibility

CP2 does not need to implement the complete CMS editing workflow if it is not yet connected to persistence.

But the schema and any trusted write helpers introduced in CP2 must not make this future contract impossible.

---

# 11. Privacy Requirements

Do not:

- expose raw GPS publicly;
- expose private timestamps publicly;
- weaken RLS;
- make Draft Trips publicly readable;
- make Private Visits publicly readable;
- modify authentication boundaries to simplify implementation.

Run existing privacy/security regression tests after migration.

---

# 12. Migration Requirements

If Phase A finds no blocking Product Decision:

Create the smallest forward-only migration required to support the approved Visit state model.

Migration must be:

- deterministic;
- idempotence-safe according to project migration conventions;
- compatible with existing hosted Supabase schema conventions;
- reversible by Git/migration correction rather than ad hoc production mutation;
- covered by executable verification.

Do not rewrite historical migration files.

Add a new migration.

---

# 13. Tests Required

At minimum verify:

## Schema

- `review_status` exists.
- valid values: `pending`, `confirmed`.
- invalid values rejected.
- default behaves as specified.

- `visibility` exists.
- valid values: `public`, `private`.
- invalid values rejected.
- default behaves as specified.

## State independence

Prove the database can represent:

```text
Pending + Public
Pending + Private
Confirmed + Public
Confirmed + Private
```

without using Trip lifecycle state.

## Existing behavior

Verify:

- existing public fixture still renders/readable as before;
- Private-compatible migrated rows do not accidentally become public;
- Trip publication behavior unchanged;
- existing Cruise regression remains green.

## Security

Run relevant:

- RLS tests;
- public-contract tests;
- privacy/security matrix;
- existing Supabase regression tests.

---

# 14. UI Compatibility Check

CP1 was already Product Accepted.

CP2 must not redesign CP1.

After migration, verify that the accepted UI concepts still map cleanly to persisted state:

```text
Pending / Confirmed
Public / Private
```

Do not change:

- Day → Visit → Detail interaction model;
- Confirm UX;
- responsive behavior;
- Preview UX.

Any UI wiring beyond what is necessary to prove state compatibility is out of scope.

---

# 15. Out of Scope

Do not implement in CP2:

- Timeline JSON ingestion;
- reconstruction pipeline;
- Candidate Visit creation service;
- Place Search;
- Daily Review backend integration;
- authenticated Draft Preview RPC;
- Publish workflow;
- Media;
- Highlight;
- social import;
- AI authoring;
- Cruise redesign;
- Movement database entity;
- broad schema cleanup.

Do not remove legacy columns solely because they appear redundant.

---

# 16. Stop Conditions

Stop and return:

`PRODUCT_DECISION_REQUIRED`

if evidence shows that:

- `publication_status` represents a still-valid fourth product dimension;
- introducing independent visibility would break a required product behavior;
- existing public contract cannot be preserved without a broader architectural change;
- migration requires changing privacy semantics;
- a new domain entity/table appears necessary;
- existing documentation contains irreconcilable product semantics.

When stopping, provide:

1. exact evidence;
2. why the approved model cannot be implemented safely;
3. 2–3 smallest options;
4. consequence of each.

Do not invent a workaround.

---

# 17. Required Deliverables

Return:

## 1. Current State Impact Analysis

All reads/writes/dependencies of:

```text
app.visits.publication_status
```

## 2. Semantic Conclusion

State clearly:

- Trip lifecycle representation;
- Visit review representation;
- Visit visibility representation;
- future role of legacy Visit publication_status.

## 3. Migration

If safe, list:

- migration filename;
- columns added;
- constraints;
- defaults;
- backfill behavior.

## 4. Compatibility Changes

Any minimal views/tests/adapters changed solely to preserve existing behavior.

## 5. Verification Evidence

Include:

- migration execution result;
- schema assertions;
- four-state independence test;
- privacy/security tests;
- existing regression results;
- build/typecheck if affected.

## 6. Files Changed

List all modified files.

## 7. Known Deferred Work

Explicitly separate CP2-complete state from later work such as:

- ingestion;
- persistence wiring;
- Preview RPC;
- Publish.

---

# 18. Completion Status

If impact analysis and minimal migration are safely completed and verified, end with:

`READY_FOR_PRODUCT_OWNER_CMS_SCHEMA_CP2_REVIEW`

If a genuine product/domain decision blocks implementation:

`PRODUCT_DECISION_REQUIRED`

If repository evidence is insufficient:

`BLOCKED_BY_MISSING_EVIDENCE`

Do not declare CMS VS1 complete.