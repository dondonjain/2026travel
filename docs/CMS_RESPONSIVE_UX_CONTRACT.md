# Travel Portal CMS Responsive UX Contract

**Status:** Approved responsive interaction baseline
**Primary terminal:** Mobile
**Secondary terminal:** Desktop / professional creator workflow

> Mobile and desktop are not separate products. They share one interaction model and one vocabulary.
> Responsive design changes **information density and presentation**, not task logic.

---

## 1. Core Principle

The shared authoring hierarchy is:

> **Trip → Day → Visit → Detail → Confirm → Preview**

This hierarchy must remain consistent on mobile and desktop.

The user should not need to relearn the CMS when switching devices.

---

## 2. What Must Stay Identical Across Devices

The following are product semantics and must not change between mobile and desktop:

- information hierarchy;
- terminology;
- state semantics;
- Visit field order;
- Confirm behavior;
- visibility semantics;
- Required Issue navigation;
- Preview eligibility;
- Place correction flow;
- evidence disclosure logic.

The following may adapt responsively:

- number of hierarchy levels visible at once;
- panel vs full-screen presentation;
- navigation chrome;
- map size/presentation;
- spacing;
- density.

---

## 3. Shared Interaction Model

All devices follow:

```text
Trip
↓
Day
↓
Visit
↓
Visit Detail
↓
Confirm
↓
Preview
```

Desktop may show several levels simultaneously.

Mobile reveals the same levels progressively.

Do **not** create:

- a desktop table-management workflow;
- and a separate mobile wizard.

---

## 4. Desktop Workspace

Preferred desktop structure (Four-Column Spatial Workspace):

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Trip Header       Required Issues              Preview                 │
├────────────┬──────────────────────┬────────────────────────┬───────────┤
│ Days       │ Visit List (~22%)    │ Visit Detail (~32%)    │ Map (~30%)│
│ (~16%)     │                      │                        │ (flex-1)  │
│ Day 1(8/14)│ Visit A              │ Title                  │ [Canvas]  │
│ 12+字概述  │ Visit B              │ Place                  │ ● Focused │
│ Day 2(8/15)│ Visit C              │ Time                   │ ○ Nearby  │
│ ...        │ ...                  │ Visibility             │ ─ Route   │
│            │                      │ Issues                 │           │
│            │                      │ Evidence               │           │
│            │                      │ Confirm & Next         │           │
└────────────┴──────────────────────┴────────────────────────┴───────────┘
```

### Important semantic rule

The product concept is:

> **Visit Detail + Persistent Map Canvas**

The layout reflects the four distinct density zones: Days (~16%, fits Day *(M/D) on line 1 and 12+ CJK characters on line 2), Visit List (~22%), Visit Detail (~32%, compact ergonomic form), and Persistent Map (~30% / flex-1 expansive canvas).
Do not encode "floating popups" as the primary map access method.

---

## 5. Mobile Workspace

Mobile uses a vertical split layout that keeps the map permanently in context:

```text
┌──────────────────────────────────────┐
│ Trip Header                          │
├──────────────────────────────────────┤
│ Day Selector Bar (Horizontal scroll) │
├──────────────────────────────────────┤
│ Upper Section: Persistent Map        │
│  - Mode A (List): ~45vh (1/2 畫面)    │
│  - Mode B (Edit): ~25vh (1/4 畫面)    │
│  - Active day's trajectory & pins    │
│  - Auto-centers on selected visit    │
├──────────────────────────────────────┤
│ Lower Section: Interactive Sheet     │
│  - Mode A (List): ~55vh              │
│  - Mode B (Edit): ~75vh (3/4 畫面)   │
│                                      │
│ Mode A: Visit List                   │
│   Visit 1, Visit 2, Visit 3...       │
│                                      │
│ Mode B: Visit Detail / Edit          │
│   [← Back to List]                   │
│   Title, Place, Time, Visibility...  │
│   Sticky: [Confirm & Next]           │
└──────────────────────────────────────┘
```

The mobile interface keeps the map visible above the content sheet even while editing visit details. When entering edit mode, the map smoothly shrinks to 1/4 screen height (~25vh) and the editor expands to 3/4 screen height (~75vh) to ensure optimal typing comfort and keyboard clearance.

---

## 6. Visit Detail Field Order

Use the same conceptual order on all devices:

1. Visit title.
2. Place.
3. Start/end time.
4. Visibility.
5. Structural issues.
6. Evidence entry.
7. Map entry.
8. Confirm action.

Evidence is collapsed by default.

---

## 7. Confirm Interaction

Confirm is the primary Visit review action.

Approved behavior:

```text
Pending Visit
→ Confirm
→ Confirmed Visit
→ automatically open next Pending Visit
```

Provide a short-lived Undo action.

### Desktop enhancement

Keyboard shortcuts may be added later, for example:

- `C` = Confirm
- `J` = next
- `K` = previous

But shortcuts are optional enhancements only.

The entire workflow must remain usable by touch/pointer.

---

## 8. Mobile Primary Action Placement

On mobile, primary Visit actions should remain comfortably reachable.

Preferred behavior:

- sticky bottom action area;
- Confirm placed in the thumb zone;
- visibility control available without excessive scrolling.

Do not place the only Confirm action in a hard-to-reach top-right corner.

---

## 9. Visibility Presentation

Users should see simple product language:

- Public
- Private

Do not expose internal schema terminology such as:

- `publication_status`;
- `review_status`;
- `draft`;
- `published`

inside Visit editing UI.

The UI must be capable of representing:

- Pending + Public
- Pending + Private
- Confirmed + Public
- Confirmed + Private

---

## 10. Required Issues

Required Issues are a **navigation aid into the normal review workflow**, not a separate issue-management product.

Hierarchy:

```text
Trip
  Required Issues: 6

Day
  Issues: 2

Visit
  ⚠ Place needs review
```

Selecting an issue should navigate into:

> Day → Visit → Detail

### Do not create

- separate issue dashboard as a competing workflow;
- completeness percentages;
- arbitrary severity systems unless product-approved.

---

## 11. Map

Map is the **permanent spatial canvas** of the CMS workspace.

Travel is inherently a spatial narrative. Normal review keeps the map visible at all times so that users never lose geographic orientation during editing.

Primary Map use cases:

- verify Place location and surrounding context;
- visually anchor the active Visit within the day's route;
- correct Place;
- add missing Visit;
- understand nearby spatial context.

### Desktop

Map permanently occupies the 4th column on the right (~30% width).

### Mobile

Map permanently occupies the upper section (~45vh height). Editing visit details occurs in the scrollable lower section without hiding the map.

### Shared Place correction flow

```text
Current Place
→ Nearby suggestions
→ Search fallback
```

### Do not require

- draggable raw GPS;
- coordinate entry;
- GIS editing;
- trajectory drawing.

---

## 12. Place Correction

A user correcting Place should see:

1. current Place;
2. nearby likely candidates;
3. search fallback.

The workflow must remain tap/click friendly.

Changing Place is structural and returns:

`Confirmed → Pending`

---

## 13. Time Editing

Machine-inferred time is shown at approximately 10-minute precision.

Example:

`14:20 – 15:50`

Manually added Visits may use minute-level precision.

The user edits Visit time, never raw GPS timestamps.

---

## 14. Anomaly Language

Present anomalies in human travel language rather than engineering diagnostics.

Prefer:

> “This part of the trip looks out of order.”

Then guide the user to check:

1. missing Visit?
2. wrong Place?
3. only then time correction.

Avoid exposing raw engineering messages such as:

> “Impossible velocity = 426 km/h”

unless hidden inside evidence/debug tooling.

---

## 15. Preview

Preview is a consistent action on both desktop and mobile.

Eligibility:

> usable trajectory + at least one Confirmed + Public Visit

When eligibility is reached for the first time, the interface may show a lightweight hint.

Do not force Preview through a blocking modal.

### Preview mode

Both desktop and mobile transition to a full reader-facing Cruise mode.

Do not create a desktop-only split-screen Preview as the primary workflow.

---

## 16. Mobile-First Safety Rules

Core tasks must not depend on:

- hover;
- right click;
- drag-and-drop;
- keyboard shortcuts;
- extremely precise pointer interaction.

Desktop may enhance these interactions, but may not require them.

---

## 17. Progressive Disclosure

A mobile screen should have one primary cognitive task.

Do not display all of the following by default at once:

- full map;
- evidence;
- full timeline;
- issue history;
- Place candidates;
- all advanced edit controls.

Reveal secondary information only when needed.

---

## 18. Recommended Information Architecture

```text
CMS
├── Trips
└── Trip Workspace
    ├── Trip Overview
    ├── Day Review
    │   └── Visit Detail
    │       └── Contextual Map
    └── Preview
```

Desktop exposes more of this hierarchy simultaneously.

Mobile navigates through the same hierarchy progressively.

---

## 19. Responsive Acceptance Scenario

The same task must be possible on desktop and mobile:

1. Open a Trip.
2. Open Day 3.
3. Find a Pending Visit.
4. Open Visit Detail.
5. Inspect title, Place, time, visibility.
6. Open contextual Map.
7. Return to Visit Detail.
8. Confirm Visit.
9. Automatically move to next Pending Visit.
10. Undo confirmation.
11. Navigate to another Required Issue.
12. Observe Preview eligibility.
13. Trigger Preview transition.

The user should not need to learn a new workflow after switching devices.

---

## 20. Responsive Baseline Table

| Concern | Desktop | Mobile | Product semantic |
|---|---|---|---|
| Navigation | Days + Visits + Detail can coexist | progressive push | Day → Visit → Detail |
| Visit list | middle region | dedicated screen | same data/order |
| Visit detail | side/detail region | full screen | same fields/order |
| Map | contextual panel/workspace | full screen | contextual tool |
| Confirm | detail action | sticky bottom action | Confirm → next Pending |
| Visibility | detail control | detail/bottom control | Public / Private |
| Evidence | expandable | expandable | collapsed by default |
| Required issues | header + hierarchy | header + hierarchy | same navigation |
| Preview | persistent entry | persistent entry | full reader mode |
| Keyboard | optional enhancement | not applicable | never required |

---

## 21. Approved UI Decisions

The following have been explicitly approved:

1. Use `Day → Visit → Detail` as the common cross-platform interaction model.
2. Desktop may use a three-region layout while mobile uses progressive navigation.
3. Map is contextual rather than permanently dominant.
4. Confirm advances to the next Pending Visit and provides Undo.
5. Preview enters full reader mode on both desktop and mobile.

These should be treated as baseline behavior unless the Product Owner revises them.
