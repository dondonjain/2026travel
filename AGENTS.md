This file defines the shared operating rules for AI coding agents working in this repository.
It is intentionally vendor-neutral. Do not assume a specific agent, model, IDE, shell, or tool implementation.
The goal is not maximum autonomy. The goal is reliable progress with controlled scope, sufficient context, low unnecessary token usage, and clear human decision points.
Prefer, in this order:
1. Correctness over autonomy.
2. Scope control over speculative improvements.
3. Recorded project decisions over re-deriving architecture.
4. Minimum sufficient context over repository-wide exploration.
5. Targeted validation over repeated full validation.
6. Small, reviewable changes over broad refactors.
7. Explicit uncertainty over invented assumptions.
Do not expand the task simply because an adjacent improvement is possible.
Do not redesign accepted architecture unless the current task explicitly requires reconsideration or repository evidence reveals a contradiction.
The /docs directory is the shared Project Memory for humans and AI agents.
Do not duplicate its contents into this file.
For a substantial new task, read:
- docs/CURRENT_TASK.md
Before implementation or verification that can affect product-visible behavior, also read:
- docs/MVP_BEHAVIORAL_BASELINE.md
Use it to understand:
- current goal
- current hypothesis
- open questions
- implementation status
- explicit non-scope or "Do Not Implement" constraints
For trivial, clearly isolated edits such as typo fixes or small style changes, reading Project Memory is not required unless the edit touches documented product or domain behavior.
Read when the task involves:
- product behavior
- user-facing functionality
- feature scope
- user roles
- product intent
Read when the task involves:
- existing technical architecture
- data flow
- module responsibilities
- cross-component behavior
- architectural refactoring
Read when the task involves:
- domain entities
- entity responsibilities
- relationships between concepts
- data ownership
- Place / Visit / Trip / Media or related concepts
Read when:
- an architectural or product decision may already have been made
- the task could conflict with an existing decision
- the reason behind an existing design is relevant
Accepted decisions are constraints, not suggestions.
If implementation and Project Memory disagree, do not silently choose one. Identify the discrepancy and determine whether the code or documentation is stale.
Use the minimum context sufficient to complete the task reliably.
Do not perform a repository-wide scan by default.
Prefer this sequence:
1. Read the relevant Project Memory.
2. Search for relevant symbols, filenames, imports, or references.
3. Inspect the smallest set of relevant files.
4. Expand the search only when evidence indicates it is necessary.
Do not repeatedly read files whose relevant contents are already known and unchanged within the current task.
Do not repeatedly summarize the entire project unless explicitly requested.
Do not inspect generated, cached, dependency, build, or output directories unless they are directly relevant to the problem.
Examples include:
- node_modules
- .next
- dist
- build
- coverage
- caches
- generated artifacts
- large logs
Do not assume every file matching these examples is irrelevant if the current task specifically concerns it.
Do not spend context reconstructing architectural reasoning that is already recorded in Project Memory.
Read the relevant decision and work from it.
One session should normally correspond to one coherent engineering goal.
When the engineering goal or subsystem changes substantially, prefer a clean session using Project Memory over carrying large amounts of unrelated conversation history.
Project knowledge should persist through /docs and version control, not through indefinitely growing chat history.
Before acting, determine whether the task is straightforward implementation or requires discovery.
Proceed without unnecessary planning when the task is well-defined and low-risk, for example:
- clear bug fix with sufficient evidence
- isolated UI styling or layout change
- copy or translation change
- small modification inside an existing component
- implementation of an already accepted and documented plan
Inspect the relevant code, make the smallest appropriate change, and validate it.
Do not immediately implement when the task involves unresolved decisions such as:
- database schema or migration design
- authentication or authorization architecture
- global state architecture
- cross-system API architecture
- unresolved domain modeling
- broad refactoring without a defined target
- ambiguous product behavior
- changes conflicting with Project Memory
In these cases:
1. inspect existing evidence
2. identify constraints
3. distinguish facts from assumptions
4. propose a recommended default when possible
5. identify decisions requiring human approval
6. do not implement until the relevant decision is accepted
Avoid serial low-value questions. Consolidate important uncertainties whenever practical.
Every non-trivial task should have an identifiable:
- Goal
- Scope
- Non-scope
- Validation method
These do not need to be restated verbosely when they are already clear from CURRENT_TASK.md or the user's request.
Respect explicit Non-scope strictly.
Typical boundaries may include:
- no schema changes
- no migrations
- no unrelated refactors
- no production changes
- no deployment
- no push to protected branches
- no destructive data changes
- no expansion into future phases
Do not turn a local task into a framework, abstraction, or generalized system unless the current requirements justify it.
Potential future improvements may be reported separately without implementing them.
Agents should reduce low-value human decisions, not eliminate meaningful human control.
Normally safe:
- reading files
- searching code
- inspecting git state
- static analysis
- targeted validation
- low-risk edits clearly inside approved scope
Do not perform without clear authorization:
- database schema changes
- migrations affecting persistent data
- destructive data operations
- production deployment
- changes to authentication or authorization policy
- changes to secrets or credentials
- pushing to protected/main branches when not explicitly requested
- irreversible or difficult-to-reverse operations
When approval is required, explain:
- what will change
- why it is necessary
- main risks
- expected impact
Do not force the user to decide implementation details that can safely be derived from existing project conventions.
Before running a command, consider whether it only observes state or changes state.
Read-only inspection and diagnostics may normally proceed without confirmation.
Use additional care for commands that:
- install or remove dependencies
- move or overwrite files
- modify repository state
- modify persistent data
- change configuration
- affect external systems
Stay within the approved task scope.
Do not use destructive or irreversible operations when a safer alternative exists.
Never use destructive commands merely for convenience.
Do not force-push unless the user explicitly requests it and the consequences are understood.
This project may contain Traditional Chinese text.
When modifying text-heavy files:
- preserve UTF-8 encoding
- avoid tools or command patterns known to introduce encoding corruption
- verify edited content when encoding risk exists
If corrupted text is detected, stop further edits to the affected file and report it.
Prefer the smallest change that correctly solves the approved problem.
Before introducing a new abstraction, dependency, table, service, or framework, check whether the existing architecture already provides an appropriate mechanism.
Follow existing repository conventions unless there is an explicit decision to change them.
Do not mix unrelated cleanup with feature work.
Do not silently rename domain concepts.
Do not convert hypotheses in Project Memory into implemented architecture unless they have been accepted.
For user-facing Traditional Chinese content, use Traditional Chinese and Taiwan-appropriate terminology unless another language is explicitly requested.
Validation should be proportional to the change.
During iteration, prefer targeted checks first.
Examples:
- relevant type checking
- targeted tests
- linting affected code
- focused runtime verification
Do not repeatedly run expensive full builds or complete test suites after every small edit unless necessary.
Before declaring a substantial implementation complete, perform the broader validation appropriate to the project.
Where applicable, distinguish:
1. code compiles
2. tests pass
3. local behavior works
4. preview environment works
5. production is deployed
6. production behavior is verified
Do not claim a later stage has been validated when only an earlier stage was checked.
If production does not reflect a change, verify deployment state before assuming the implementation is defective.
Project Memory should reflect accepted project truth.
Update the appropriate /docs file when a task materially changes:
- product behavior
- architecture
- domain model
- accepted decisions
- current task state
Do not update documentation merely to create activity.
Do not record speculation as accepted fact.
When an architectural decision is accepted, record the decision and rationale in the appropriate decision record.
When implementation reveals that existing documentation is incorrect, report and reconcile the discrepancy.
A task is complete only when:
- the requested scope is implemented or answered
- relevant validation has been performed
- known failures or uncertainties are disclosed
- no prohibited scope was silently added
- relevant Project Memory is updated when necessary
Keep completion reports concise.
Normally report:
- what changed
- validation performed
- remaining issue or decision, if any
Do not generate lengthy summaries of unchanged project context.
Do not keep a session alive solely to preserve project knowledge.
When a coherent engineering goal is complete, the session may end.
Before handing off an unfinished substantial task, preserve only the context necessary for continuation:
- current goal
- relevant completed work
- unresolved issue
- important accepted decisions
- files materially involved
- validation already performed
- recommended next action
Prefer updating docs/CURRENT_TASK.md when the information represents shared project state.
Use a temporary handoff summary only for information that does not belong in persistent Project Memory.
The repository and /docs are the long-term memory. Chat history is not.
When uncertain between doing more and staying within scope, stay within scope.
When uncertain whether context is needed, acquire the smallest additional context that can resolve the uncertainty.
When repository evidence conflicts with an assumption, trust the evidence and surface the conflict.
When an accepted human decision exists, follow it unless the task explicitly reopens that decision.

## Autonomous Verification Protocol

Use this protocol when a functional unit has an approved product baseline, clear machine-verifiable acceptance criteria, and a suspected technical implementation regression. Within that boundary, agents may autonomously inspect, reproduce, diagnose, repair, run focused verification, run affected regression verification, and continue the remaining verification. Do not hand work back merely because another ordinary technical regression appears in the same functional unit.

### Establish the operational baseline (V0)

Before repair, determine what PASS means from repository state, executable evidence, and approved Product Owner decisions:

- `V0_CLEAR`: documentation, implementation expectations, and executable evidence agree.
- `V0_OPERATIONAL`: documentation has drifted, but approved intent and runtime or executable evidence make expected behavior unambiguous. Proceed and report the drift.
- `V0_BLOCKED`: expected behavior cannot be determined, or the required environment or evidence is unavailable. Stop.

Documentation drift alone is not a stop condition. Product Owner decisions remain authoritative, and repository evidence must be surfaced when it contradicts an assumption.

### Classify failures and control retries

Before changing production code, classify each failed verification as:

- `PRODUCT_REGRESSION`: reproducible product/code/data behavior contradicts the approved baseline.
- `TEST_OR_FLAKY_FAILURE`: the assertion, selector, timing, harness, or rerun consistency is suspect.
- `ENVIRONMENT_FAILURE`: a required runner, dependency, network, service, permission, or approved wrapper is unavailable.
- `UNCLASSIFIED`: evidence is insufficient to choose safely.

Only a confirmed `PRODUCT_REGRESSION` consumes autonomous repair attempts. For the first unexpected failure, preserve compact evidence and rerun the same verification once under equivalent conditions. A matching failure may become a regression candidate; disagreement indicates a possible flaky or environment failure. Allow one further rerun only for a concrete diagnostic reason. Never rerun repeatedly until PASS.

For runtime regressions, prefer: observe → reproduce → record expected versus actual → diagnose → repair → rerun the same reproduction. Deterministic evidence that already proves the cause may replace runtime reproduction; source inspection alone may not.

### Verification ladder and evidence

Use the cheapest reliable level first:

1. `V1`: focused deterministic verification.
2. `V2`: integration verification across relevant data, adapter, API, or service boundaries.
3. `V3`: runtime or browser verification.
4. `V4`: Product Owner subjective acceptance.

Do not run expensive browser or full-system verification while relevant focused verification is failing. A machine-verifiable criterion is PASS only with executable evidence such as a test result, deterministic script, browser automation observation, API/database query, build, typecheck, lint, or equivalent mechanism. No executable evidence means no MACHINE PASS; mark the criterion `UNVERIFIED`.

### Repair loop, impact, and test integrity

For a confirmed `PRODUCT_REGRESSION`, implement the smallest robust repair, pass focused verification, verify affected consumers, then continue the remaining functional-unit verification. Do not stop for another ordinary technical bug within the same unit.

Classify each change by impact:

- `LOCAL`: isolated logic with no meaningful shared consumers. Run focused verification and directly affected tests.
- `SHARED`: shared components, state, hooks, helpers, routing, adapters, importers, public APIs, trajectory/data processing, authentication/privacy filters, or global configuration. Run focused verification, affected-consumer regression, and the relevant broader suite.

Do not rerun previously verified MATCH behavior unless the change affects it, a dependency changed, or new evidence contradicts it. Do not weaken tests, lower approved values, remove regression assertions, replace required runtime evidence with source-string checks, or test an unused hypothetical helper. A stale or defective test may be corrected only when executable evidence demonstrates the defect and product semantics remain unchanged.

Default repair budgets are:

- At most 2 genuine repair attempts for one confirmed regression.
- At most 3 confirmed regression repair cycles for one functional unit.

Flaky and environment retries do not consume repair cycles. Agents must not raise these limits themselves. Stop and report the evidence and current hypothesis when a budget is exhausted.

### Mandatory stop and ownership boundaries

Stop autonomous work when:

- a new Product Owner decision is required or expected behavior is ambiguous;
- repair requires an unapproved schema, domain, architecture, or public-contract change;
- repair requires weakening a privacy or security boundary;
- scope expands significantly into an unrelated subsystem;
- required machine verification cannot be executed;
- failure remains `UNCLASSIFIED`; or
- the repair budget is exhausted.

Do not stop merely because another ordinary technical bug appears, several related files require edits, or focused verification initially fails.

Agents may objectively verify state and data correctness, API/adapter behavior, route or marker continuity, deterministic camera targets, functional browser interactions, runtime errors, and build/type/lint results. Product Owner acceptance remains required for aesthetic quality, motion comfort, emotional pacing, whether zoom feels right, and the overall product experience.

### Context, secrets, and completion

Keep large stack traces, DOM dumps, build logs, console logs, and network logs out of active context. Retain only the command/action, expected and actual results, first relevant error, source location, reproduction status, and artifact location when needed. During long tasks, maintain a compact current-state summary containing the functional unit, current commit, confirmed PASS behavior, open regressions, attempts used, remaining verification, and next action.

Follow the Secret Handling and Capability Tiers below. Never inspect secret-bearing files or dump environments. If output unexpectedly includes a credential, token, Authorization header, or credential-bearing URL, do not reproduce it; replace it with `[REDACTED_SECRET]` and use approved QA wrappers. Do not create new secret infrastructure for ordinary verification.

A functional unit is machine-complete only when V0 is clear or operational, required machine verification passes, no confirmed technical regression remains, shared-impact verification is complete, every MACHINE PASS has executable evidence, and only Product Owner subjective acceptance remains. Do not commit each small repair separately. At machine completion, apply the Unit-Completion Git Checkpoints policy below: run the required regression checks, secret scan, and `git diff --check`; verify staged scope; create one functional-unit checkpoint; and report its hash, message, and final status.

## Unit-Completion Git Checkpoints

Create a Git checkpoint commit after completing each independently verifiable unit of work. A completed unit is a bounded task or vertical-slice subfeature that has a clear acceptance condition, is coherent enough to review and validate on its own, and can be reverted without coupling the rollback to unrelated unfinished work. Intermediate exploration, partial implementation, failing work, and unrelated edits do not count as a completed unit.

Before creating the checkpoint, perform the minimum gates appropriate to the unit:

1. Review `git status`, the relevant unstaged diff, and the staged diff so the commit contains only the completed unit.
2. Run the smallest relevant tests, type checks, lint checks, builds, or runtime verification required by the unit's acceptance condition. Documentation-only changes may use document review and `git diff --check` when no executable behavior changed.
3. Run the repository-approved secret scan and confirm that it passes.
4. Confirm that no sensitive or unrelated artifact is staged.

Never commit `.env` or `.env.*` files, secrets, credentials, tokens, credential-bearing temporary files or scripts, secret-bearing logs, generated local task logs, environment dumps, or other sensitive local artifacts. Safe example files containing variable names and non-secret placeholders may be committed only when they are intentionally part of the unit.

If the secret scan reports a finding, or review identifies a possibly credential-bearing file or value, STOP the checkpoint. Do not stage or commit the finding, do not expose its contents, and report the blocker with sanitized evidence so a human can decide how it should be resolved.

The commit message must identify the completed function or bounded unit and state the gate result. Use a concise subject describing the unit and include a body or trailer recording the relevant verification and secret-scan status when the subject alone cannot do so clearly.

After committing, report the commit hash, commit message, validation and secret-scan results, and final `git status`, including any deliberately excluded or remaining uncommitted changes. Do not push unless explicitly requested.

## Secret Handling and Capability Tiers

Use repository-approved capability commands instead of directly handling credentials.

- Tier 0 — public/runtime: public URL, publishable key, and public RPC verification.
- Tier 1 — QA read: bounded read-only connectivity and aggregate fixture verification.
- Tier 2 — QA write: explicitly approved controlled QA fixture import.
- Tier 3 — infrastructure admin: credential creation, reset, rotation, revocation, recovery, Management API access, project configuration, and destructive infrastructure operations.

Agents MUST NOT inspect secret-bearing environment files by using `cat`, `type`, `Get-Content`, `grep`, `Select-String`, parsers, summaries, or equivalent mechanisms. Agents MUST NOT print secret environment-variable values, dump process environments, place secret literals in CLI arguments or inline scripts, echo complete connection strings, or copy secrets into logs, docs, prompts, tests, fixtures, or source. Discoverability does not authorize use of infrastructure-admin credentials. Agents MUST NOT perform credential creation, reset, rotation, revocation, or recovery unless the task explicitly authorizes a dedicated approved mechanism.

Agents MAY inspect documented environment VARIABLE NAMES, invoke approved wrappers that consume values internally, and receive sanitized PASS/FAIL or aggregate output. Normal QA must use the `qa:*` package commands documented in `docs/SECRET_BOUNDARY.md`; do not substitute arbitrary database, PowerShell, Node, curl, or Management API commands.

If an operation requires direct secret inspection or an unapproved Tier 3 capability, STOP and request the bounded human/admin action instead.
