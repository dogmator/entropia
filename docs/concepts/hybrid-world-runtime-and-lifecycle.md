# Entropia — Hybrid World Runtime and Lifecycle

> **Status: CONCEPT DRAFT — NOT APPROVED FOR IMPLEMENTATION**
>
> **Date:** 2026-10-21
>
> **Scope:** Architecture and product exploration only. This document authorizes no code changes, implementation PRs, merges, infrastructure provisioning, account creation, deployments, costs, or changes to governance.
>
> **Relationship:** Extends the *discussion* beyond [Issue #57](https://github.com/dogmator/entropia/issues/57), which accepts at the concept level **browser-local persistence between sessions** (IndexedDB as the base storage) and excludes uninterrupted background computation after a tab is closed. Its implementation stays blocked until the prerequisites in that issue are verified. Nothing here amends that issue or its implementation restrictions.

## Companion research concept: Entropia Commons

[**Entropia Commons — Decentralized Evolutionary Computing & Preservation Network**](entropia-commons-decentralized-network.md) explores a future P2P extension of this hybrid model: volunteer compute and archive peers, independently reproducible evolution, explicit authority models, content-addressed histories, community governance and crowdfunding.

**Scope boundary:** It is an optional research direction, not an approved replacement for the local/browser and headless execution stages. It does not authorize implementation or amend Issue #57. No blockchain, token, DAO, provider or payment model has been selected.

## 1. Vision: a world belongs to its history, not its process

Entropia is intended to become a laboratory of evolutionary histories: the user defines a world and observes events that emerge from its laws rather than a prewritten storyline.

A world should outlive an individual browser tab, process, computer, and eventually its original execution location. Its identity and causal history must not be tied to a particular runtime.

There are **two distinct meanings of long-running**:

1. **Continuity of history:** a closed browser can later restore the same world from its last *confirmed* checkpoint. No computation happens while it is suspended.
2. **Continuity of computation:** a headless executor can advance a selected world without an open browser, including while the user is absent.

These capabilities must remain separately testable. Persistence alone is not 24/7 life; leaving a tab open is not durable persistence.

The product vision supports two complementary classes of experiments:

- **Local, sleeping worlds:** private, no account required, browser-operated; pause when the browser is unavailable.
- **Independent, always-on-capable worlds:** a bounded headless executor continues simulation and commits durable progress without a browser. Continuous availability is a target capability, **not an SLA**.

A third, **catch-up simulation** mode is conceivable: after reopening, the system explicitly computes missed simulation steps faster than rendering speed. Catch-up is work, not fabricated time, and must be bounded and user-visible.

## 2. Non-goals and boundaries

This concept does **not** require or approve:

- A hosted backend for all users.
- A cloud account for local play.
- Replacing TypeScript, the simulation engine, React, Three.js, or the browser Worker.
- Running Service Workers as immortal background engines.
- Hard-coded ecological outcomes, scripted species, or guaranteed organism survival.
- Automatically advancing simulated time based on wall-clock time spent away.
- A new evolutionary AI framework, neuroevolution, or a change of genetics.
- Deploying infrastructure or incurring costs.
- Treating complex emergent behavior as evidence of subjective consciousness.

Prefer minimal, experimentally validated separation of runtime and simulation semantics, not a speculative full rewrite.

## 3. Current project baseline and assumptions

Entropia's `main` (checked on 2026-10-22 at commit `f2ec0f6`) contains a TypeScript SimulationEngine, a browser simulation Worker, state export/import services, and tests for random-stream ownership and snapshot continuation. Per-engine RNG isolation and snapshot continuation were merged in PRs #66 and #67. Issue #57 increments G, H, I, J and M are merged in PRs #70 to #74. No merged increment K (simple Utility AI) or L (Boids-related traits) appears on `main`. Behavior claims must be re-checked against `main` at execution time, not taken from this section.

Issue #57's technical appendix (2026-10-20) recorded the gaps below. The status on `main` on 2026-10-22 is noted for each. Each gap still needs verification by tests before it is treated as closed. Issue #57 lists PR #56 as a prerequisite; it is merged (2026-10-20), while the Issue text still calls it open.

- Worker-facing export/import must provide an actual asynchronous, correlated acknowledgment/error contract; a cached/fallback export must not masquerade as a fresh checkpoint. *Status on `main`: `EngineProxy.exportState()` returns a Promise and documents that it never resolves with a cached or synthetic state; import acknowledgments use `commandResponse`.*
- Snapshot capture must happen at a coherent tick boundary. *Status on `main`: the export contract is documented as the state at a tick boundary.*
- Browser-local IndexedDB checkpoint storage is accepted at the concept level as the base storage (Issue #57), and its implementation is gated. *Status on `main`: `CheckpointStore`, `CheckpointController` and a Web Locks `WorldLease` are present (PR #71). Whether the merged increments satisfy the Issue's implementation gate is an owner decision.*
- Historical genealogy and checkpoint size require measurement before retention/truncation policy. *Status on `main`: increments I, J and M are merged (PRs #72 to #74). This document does not assess their measurements.*
- Save/restore equivalence must be established by tests, not inferred from export/import round-trip equality. *Status on `main`: restore and continuation tests exist (for example `CheckpointRestore` and `SnapshotContinuation`). Whether they meet the Issue's equivalence criteria is not assessed here.*

The independent runtime proposal is contingent on these prerequisites and on renewed review of the current source and CI at execution time. No existing PR title or agent progress log is proof of an accepted architecture.

## 4. Logical architecture

~~~mermaid
flowchart TB
  UI["Entropia UI: observe, control, history"]
  CORE["Shared deterministic TypeScript simulation kernel"]

  subgraph LOCAL["Local execution"]
    BW["Browser Worker runtime"]
    IDB[("IndexedDB checkpoints")]
    BW <--> IDB
  end

  subgraph REMOTE["Autonomous execution"]
    CTRL["World controller / ownership registry"]
    HW["Headless simulation runner"]
    STORE[("Durable checkpoints + history")]
    CTRL --> HW
    HW <--> STORE
    CTRL <--> STORE
  end

  CORE -. "one set of simulation laws" .-> BW
  CORE -. "one set of simulation laws" .-> HW
  UI <--> BW
  UI <-. "authenticated observation and commands" .-> CTRL
~~~

This is a **logical** diagram, not a selection of infrastructure vendors, deployment topology, database engines, API protocols, or exact service boundaries.

Conceptual components:

- **World model:** stable identity, lineage/branch, ruleset, configuration and origin.
- **Simulation kernel:** state transition by deterministic tick, serialization/deserialization, and documented equivalence criteria.
- **Runtime adapter:** drives the engine within browser Worker or headless process.
- **Checkpoint store:** holds validated durable state; has a local and a remote adapter.
- **Ownership registry:** coordinates authoritative writers during remote operation and transfer.
- **Observation interface:** telemetry and visual projection, explicitly non-authoritative.
- **History/experiment layer:** causal chronology, comparisons, intervention records and branches.

The rendering system must never become the source of simulation truth.

## 5. Identity and immutable lineage

Each world is an experiment with stable identifiers, not just a mutable tab.

Provisional identity and metadata:

| Field | Meaning |
| --- | --- |
| worldId | Stable identity of an experiment family |
| branchId | Unique identity of a particular causal-history branch |
| parentCheckpointId | Explicit ancestry when a branch forks |
| initialSeed | Seed at experiment creation; current RNG state lives in the checkpoint |
| rulesetVersion | Semantic identity of laws and behavioral algorithms |
| engineBuild | Executable implementation/build identity |
| schemaVersion | Serialization contract |
| tick | Last *actually computed* simulation step |
| ownerEpoch | Monotonic fencing token for authoritative writes |
| latestConfirmedCheckpointId | Verified recovery anchor |
| provenance | Validated origin and user interventions |

The exact field types, checkpoint envelope, collision-resistant identity scheme, and compatibility requirements remain undecided.

A fork is a **new branch**, not two live writers of the same branch. Its lineage must point back to the parent checkpoint.

## 6. Separate ecological state, execution state, and location

Do not collapse biological outcomes into infrastructure states.

### Ecological state

- **VIABLE:** living organisms or ongoing regenerative processes under the model.
- **EXTINCT:** organism extinction under a defined, explicit criterion. Not an application crash.
- **INVALID:** state cannot be safely interpreted under the applicable rules/schema.

An extinct world remains inspectable. No automatic resurrection, population replenishment, or hidden selection pressure is permitted merely to improve user-facing visuals.

### Execution state

- **CREATED:** registered but not yet advanced.
- **RUNNING:** ticks are actually being computed.
- **PAUSED:** stopped intentionally, runtime may still be present.
- **SUSPENDED:** no active executor; durable checkpoint available.
- **CHECKPOINTING:** temporary durable-write operation at a stable tick boundary.
- **TRANSFERRING:** handoff between authoritative execution locations.
- **RECOVERING:** validation/restoration after an interruption.
- **BLOCKED:** unsafe to continue without intervention.

### Location

- **LOCAL:** browser-owned runtime and IndexedDB store.
- **REMOTE:** independently operating headless runtime and durable remote store.

These are orthogonal dimensions. A world may be EXTINCT + SUSPENDED + LOCAL, or VIABLE + RUNNING + REMOTE.

## 7. Local lifecycle: sleep without forgetting

Normal sequence:

**CREATE → RUN → CHECKPOINT → SUSPEND → RESTORE → RUN**

1. Create world, configuration, initial state, lineage identity, ruleset identity and seed.
2. Browser Worker advances simulation. UI observes; it does not own canonical model state.
3. Periodically request a **coherent** checkpoint at a documented tick boundary.
4. Confirm storage commit and validation before presenting a checkpoint as saved.
5. On page closure, background eviction or browser termination, accept losing only the unconfirmed suffix of execution.
6. On return, inspect checkpoint metadata, integrity, compatible ruleset, and schema; restore the latest confirmed checkpoint, with a valid older fallback.
7. Show the recovered tick and any known rollback clearly. Resume only after the engine is ready.

Never rely on page unload to finish a critical asynchronous write. Visibility/page lifecycle events can *request* an opportunistic save but are not a durability guarantee.

Browser storage is fallible: quota, user deletion, browser eviction, private mode and physical crashes must be treated explicitly. Persistent-storage requests may reduce eviction risk but do not create guaranteed backups.

Offer a separate user-owned export for recovery outside the browser profile.

### Multiple tabs

Only one local tab may mutate the canonical branch. Other tabs should open it read-only, or explicitly fork it. `WorldLease` on `main` already uses Web Locks where `navigator.locks` exists, and reports `unsupported` otherwise (PR #71). Target-browser compatibility testing is still needed, and storage transaction and revision checks remain necessary.

A lock tied to one browser origin does not coordinate a remote headless executor. Cross-runtime authority requires a separate protocol.

## 8. Remote lifecycle: compute without an observer

Normal sequence:

**PROVISION → RESTORE → RUN → CHECKPOINT → RUN**

A World Controller manages authorized start, stop, restart, budgets, health checks, owner epoch and recoverability. A HeadlessRuntime loads a confirmed checkpoint and advances ticks using the same kernel as the BrowserRuntime, without React, Three.js, or DOM dependencies.

The remote runner must:

- Advance **real** simulation ticks sequentially under documented determinism conditions.
- Periodically write complete, integrity-checked checkpoints.
- Report tick throughput, memory, storage and resource usage.
- Accept validated, auditable interventions only.
- Respect CPU/memory/disk/time quotas and graceful suspension when budgets expire.
- Recover after crashes by replaying from a confirmed checkpoint.
- Never announce a speculative tick as confirmed durable history.

Process restarts may repeat computation after the last checkpoint. To prevent duplicate external effects, event publication must be idempotent, keyed to branch/event identity, or derived from a committed history marker.

An always-on-capable world is not proof of uninterrupted compute. Operational failures, security updates and budgets can pause it.

## 9. Transfer from LOCAL to REMOTE

**The hardest design problem is not uploading bytes: it is preventing two histories from both claiming to be the original.**

Proposed handoff, subject to protocol review:

1. **PREPARE:** locally pause at exact tick N; freeze a validated checkpoint; stop mutation pending handoff resolution.
2. **UPLOAD:** send snapshot and signed/authorized metadata to remote staging; validate compatibility, size and integrity without starting the runner.
3. **COMMIT AUTHORITY:** atomically establish a remote authoritative owner epoch and checkpoint pointer, with proof that the client is entitled to transfer.
4. **DISABLE LOCAL WRITES:** local canonical branch becomes read-only; a local fork is separately identified if the user wants continued offline experimentation.
5. **START REMOTE:** only the newly authorized headless runner may advance and publish the world.
6. **CONFIRM:** UI displays the verified remote owner, checkpoint/tick and current operational status.

**Failure rule:** If confirmation is lost after transfer, do *not* resume writing the same local canonical branch based on an assumption that transfer failed. Query the authoritative registry when connectivity returns. While offline, viewing or forking is safer than silently reclaiming the original.

This is a conceptual protocol; the atomicity of steps across local and remote stores cannot be assumed. Implementation must explicitly model interrupted uploads, acknowledgment loss, stale clients and rollback before it can claim safe transfer.

## 10. Transfer from REMOTE to LOCAL

Proposed reverse handoff:

1. Request an authorized stop/freeze.
2. Server completes a tick boundary and commits a final checkpoint.
3. Browser downloads and validates a compatible snapshot.
4. Registry atomically revokes remote write authority and advances owner epoch.
5. Remote process is fenced from further authoritative writes.
6. Browser obtains an explicitly valid local ownership token/receipt and resumes from the confirmed tick.

No browser should claim that a remote world has returned home just because it downloaded a copy. If transfer cannot be completed safely, offer read-only viewing or an explicitly new fork.

Offline possession of state is **not** proof of ownership of the remote canonical branch.

## 11. The single-writer invariant

**Invariant:** For one canonical world branch, at most one authoritative state publisher can commit the next canonical revision.

Many observers are allowed. Many independent forked branches are allowed. Multiple competing authoritative writers on one branch are not.

Local coordination can use browser-scoped locks and transactional revision checks. Remote coordination requires a durable, atomic authority registry.

Provisional remote mechanism:

- worldId + branchId identity
- monotonically increasing ownerEpoch (fencing token)
- bounded executor lease
- compare-and-swap commit of owner epoch + expected canonical revision
- rejection of all writes bearing a stale epoch, including writes by old processes that resume after a pause

Leases alone are insufficient. A supposedly expired process can later resume; the **storage write path** must enforce fencing.

Cross-store transfer and local-offline ownership require further design. Never describe this sketch as a distributed-consensus guarantee before adversarial tests.

The registry in this section belongs to the LOCAL ↔ REMOTE stage. The [Entropia Commons concept](entropia-commons-decentralized-network.md) does not assume a central registry (see its section 7). A peer-to-peer variant needs its own authority mechanism.

## 12. Checkpoints and durable publication

Expose a logical checkpoint interface with two adapters:

- **LocalCheckpointStore:** IndexedDB.
- **RemoteCheckpointStore:** durable snapshot objects plus an atomic metadata/ownership registry. Exact technologies deferred.

Each checkpoint should represent a coherent state and include:

- world/branch identity and ancestor link;
- exact tick;
- schema/ruleset/engine identities;
- full state of organisms, resources, spatially relevant data and inheritance;
- configuration, counters and RNG state;
- all *hidden algorithmic state* necessary for faithful continuation;
- integrity metadata, size and creation time;
- owner epoch and expected prior committed revision.

Wall-clock timestamps are metadata, never a substitute for simulation ticks.

### Publish protocol

1. Capture a stable state at tick N.
2. Validate and write new checkpoint payload.
3. Verify stored data and metadata as appropriate.
4. **Atomically advance the last-confirmed pointer**, conditioned on expected branch revision and, remotely, owner epoch.
5. Retain recovery anchors and only then apply approved retention.

An incomplete write never replaces the latest confirmed recovery point. Keep at least two recent valid checkpoints initially, subject to actual size/durability experiments.

Browser transaction completion provides an API-level commit signal, not an absolute guarantee against sudden device/storage failure. Independent file exports and remote backups address different failure domains.

### Historical value versus storage cost

Genealogical ancestry and historical checkpoints may be core research data. Do not discard them blindly to keep memory low. Distinguish ephemeral recovery checkpoints from deliberately pinned scientific checkpoints; design compaction/archive policies only after measurement and reproducibility review.

## 13. Four different clocks

Do not conflate:

1. **Wall-clock time:** time in the user's and infrastructure's world.
2. **Simulation tick:** number of actual engine updates.
3. **Simulated duration:** interpreted model time under an explicitly versioned tick-to-time mapping.
4. **Evolutionary generations:** real births and descent depths in the modeled population.

If a browser is closed for thirty real days and no runner executes, simulation time has not advanced.

If a remote runner advances millions of ticks in those same thirty days, that history must consist of actually computed state transitions, not an invented catch-up.

Generation count does not equal tick count or wall-clock duration.

The system should report confirmed tick, last persisted tick, computed-but-unconfirmed progress, real elapsed time, tick throughput and generation statistics separately.

## 14. Observation is not authority

A browser observing an autonomous world does not need a full authoritative snapshot each frame.

Separate:

- **Telemetry:** small frequent signals (tick, population, energy/resource balances, throughput, runner health).
- **Observation projection:** bounded 3D/spatial state sufficient for visualization; may be sampled or delayed.
- **Authoritative checkpoint:** complete restoreable state, not a streaming UI cache.
- **History events:** validated events with references to tick, branch, source, metrics and evidence.

When disconnected, label the last observed tick/timestamp explicitly. Do not animate fabricated evolution while suggesting it is live.

Commands changing a world (pause, resume, change parameter, fork) must be authorized, ordered and recorded as interventions; scientific analysis must distinguish interventions from natural selection.

## 15. Engine portability and reproducibility

The same TypeScript source does not automatically guarantee bit-identical results in all host environments.

Risks include: browser-only APIs hidden in the kernel, differing scheduling, source of randomness, iteration order, floating-point effects, serialization behavior, clock access and changes to genetic or ecological rules between software versions.

Before claiming BrowserRuntime ↔ HeadlessRuntime compatibility, compare the same initial checkpoint and fixed tick horizon in both environments using:

- equivalent state snapshots at intermediate ticks;
- RNG and counters;
- population and entity identities;
- ecological totals and event order;
- documented bytewise or bounded numerical comparison rules.

Track engineBuild and rulesetVersion. Worlds should either retain their compatible rule implementation, undergo an explicitly tested migration, or be opened read-only. New deployments must not silently rewrite the past.

An initial portability experiment could run **100,000 ticks from one checkpoint in browser and headless mode** and compare outputs. This is a proposed experiment, not an authorized deliverable or performance promise.

## 16. Failure and recovery matrix

| Failure or event | Required safe behavior |
| --- | --- |
| Browser terminated with no unload notice | Recover from last confirmed local checkpoint; report lost unconfirmed ticks |
| Partial/corrupted IndexedDB write | Preserve and offer prior confirmed checkpoint |
| Quota exceeded / storage cleared | Inform user; never silently substitute a new world |
| Two tabs attempt canonical writes | Admit one writer or require an explicit fork |
| Headless process crashes | Restart from confirmed remote checkpoint with valid authority |
| Old remote runner resumes after lease loss | Storage rejects its stale-epoch writes |
| Connection fails during transfer | Reconcile ownership before resuming canonical mutation |
| Incompatible engine/schema | Block continuation pending verified compatibility or migration |
| Checkpoint payload validates but hidden state differs | Fail deterministic equivalence acceptance; do not claim exact restore |
| Entire modeled population goes extinct | Preserve the result and make history inspectable |
| Compute budget exhausted | Checkpoint, suspend and report explicitly |
| History/archive grows too large | Enforce measured quotas and a separately approved retention plan |

Define recovery point/recovery time objectives only after measuring representative runs; do not invent numbers.

## 17. Security, privacy and cost model

Local worlds should require **no remote account, backend, paid service or network connectivity**.

If autonomous worlds are offered, separately design:

- identity/authentication and per-world authorization;
- upload/import validation against malicious or oversized state;
- process and world isolation;
- CPU, memory, storage, network and execution-time quotas;
- secure command admission and audit trail;
- durable remote backups;
- cost visibility, configurable budgets and controlled suspension;
- rate limits and protection against runaway checkpoint/history growth.

A home computer is one possible headless host, not a mandatory dependency. No provider, service, cost tier or permanent host is selected by this document.

## 18. Evolutionary observatory: why preserve history?

The long-term dream is to study *unexpected yet causally explainable evolutionary outcomes*, not to manufacture impressive visual effects.

Potential capabilities, none yet authorized:

- **Chronicle:** a time-indexed narrative of measured crashes, recoveries, extinctions and changes of strategy.
- **Lineage explorer:** trace a trait or lineage backward to ancestors and historical selective pressure.
- **Branching experiments:** fork a confirmed checkpoint, change exactly one controlled variable, advance multiple independent seeded replicates, and compare results.
- **World museum:** inspect completed/extinct ecosystems without resurrecting them.
- **Autonomous observatory:** observe multiple long-lived worlds, their compute throughput, ecological conditions and discoveries.
- **Alternative histories:** explore which outcomes depend on chance, resource constraints or user interventions.

A candidate event detector may flag an unusual population shift; it must not call it a new species or scientific discovery without explicit measurable criteria and supporting evidence.

The UI can become a laboratory for evolutionary causal inference. Multiple replicates and controls are needed before treating a difference between two histories as a causal conclusion.

Long-term exploration might expand toward niche construction, coevolution, symbiosis, structural genome evolution and cultural transmission, but these are research horizons, not current model capabilities or scope approvals.

## 19. Staged evolution of the architecture

Stages are **candidate design and test boundaries**, not approved tickets, PRs or a commitment to hosting.

| Stage | Focus | Evidence of success |
| --- | --- | --- |
| A — Local durability | Async Worker snapshot acknowledgments, IndexedDB checkpoints, backup, restoration and tab coordination | Browser close/reopen reliably resumes from a confirmed tick |
| B — Runtime independence | Separate engine runtime contracts from UI and browser-specific APIs | Same checkpoint evolves equivalently across browser and headless harnesses |
| C — Single headless pilot | One isolated executor, durable checkpoints, process crash/restart | World advances and restores without an open browser |
| D — Controlled handoff | Authority epochs, fencing, guarded transfer and explicit forks | No split-brain writes across interrupted LOCAL ↔ REMOTE transfers |
| E — Long-running observatory | Catalog, quotas, remote observation, archival history, repeated experiments | Long experiments survive controlled faults with verifiable lineage and budget |

Stage A is partly on `main` already: worker snapshot acknowledgments, IndexedDB checkpoints and the tab lease are merged (PRs #70 and #71). The table describes the remaining design boundaries and does not show what is merged.

A logical product ordering is **reliable history first, runtime portability second, independent computing third, and inter-runtime transfer fourth**. It minimizes infrastructure built before evidence. This ordering covers infrastructure only. Issue #57's product sequence (ecology, simple Utility AI, Boids-related traits, endurance acceptance) is neither reordered nor scheduled here.

The existing Issue #57 implementation sequence G–M remains a separate concept-level plan. This document does not automatically insert new server milestones into it.

## 20. Acceptance principles and hard questions

Architecture-level claims should eventually be tested against:

1. Local operation is independent of any server.
2. Closing a tab cannot silently convert an unconfirmed or corrupt snapshot into confirmed history.
3. Save/restore/continue equivalence is measurable on multiple seeds and checkpoints.
4. Multiple browser tabs cannot commit concurrent divergent canonical states.
5. Remote ownership epochs reject stale writers.
6. Handoff failures do not silently create two originals.
7. Crashes recover from known good durable states, with explicit rollback accounting.
8. Engine/ruleset upgrades do not silently change an old experiment.
9. Extinction remains a legitimate, inspectable outcome.
10. Costs, checkpoint sizes, genealogy growth, and tick throughput are measured.
11. Observed events have causal evidence, not only generated descriptions.
12. A user can export a world independently of its execution infrastructure.

Open decisions needing additional experiments and operator review:

- Who hosts remote execution, under which security and cost constraints?
- What storage formats, integrity scheme, schema migration and backup policies are justified?
- What compatibility guarantees can be demonstrated between browser and headless runtimes?
- How long do canonical histories, recovery checkpoints and pinned scientific points survive?
- Which exact ownership/fork rules apply during extended offline periods?
- How is deliberate extinction termination distinguished from infrastructure failure?
- What operational recovery objectives and compute quotas are practical?
- When should observation events be deemed scientifically meaningful?
- At what stage would public access, sharing or collaboration be considered?

## 21. Research references for future design review

- [Entropia Issue #57 — Ecological Utility Evolution & IndexedDB Persistence](https://github.com/dogmator/entropia/issues/57)
- [MDN — IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [MDN — Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
- [MDN — StorageManager.persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
- [MDN — Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN — Service Worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [Node.js — Worker threads](https://nodejs.org/api/worker_threads.html)
- [Martin Kleppmann — How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)

References are background material and candidates for later evidence review, not a claim that infrastructure choices are settled.

## 22. Governance and decision status

**CONCEPT ONLY. IMPLEMENTATION NOT AUTHORIZED.**

Main-branch protection remains in force. Classic branch protection requires the `Verification` check, as the operator verified on 2026-10-21. Ruleset `17666581` targets a misspelled branch, which is an open owner action recorded in [ADR 0001](../adr/0001-branch-protection-and-quality-gates.md).

No infrastructure, credential, deployment, expenditure or source-code authority is granted by this document. No change to Issue #57's accepted scope is implied. The working coding agent's current assignments and branches are unaffected.

Issue #57's principle 7 ("No radical architectural changes") keeps the current TypeScript engine, Web Worker and browser execution. Autonomous headless runtimes would require the owner to revise that principle first. This document does not revise it.

To proceed from vision to execution, the operator must separately approve a bounded architecture/specification increment, its acceptance tests, resource limits and PR scope.

**Long-term north star:** Create the smallest digital universe capable of producing evolutionary histories its author did not script, while making those histories durable, inspectable, portable and scientifically testable.
