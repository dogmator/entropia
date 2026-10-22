# Entropia Commons — Decentralized Evolutionary Computing & Preservation Network

> **Status: RESEARCH CONCEPT DRAFT — NOT APPROVED FOR IMPLEMENTATION**
>
> **Date:** 2026-10-21
>
> **Related:** [Hybrid World Runtime and Lifecycle](hybrid-world-runtime-and-lifecycle.md) and [Issue #57 — browser persistence and ecology](https://github.com/dogmator/entropia/issues/57).
>
> **Authority boundary:** Research, discussion and documentation only. This text does **not** approve protocol implementation, network deployment, blockchain integration, a native token, fundraising, wallet integration, infrastructure, expenses, security-policy changes, code changes, merges or changes to Issue #57. Separate scoped review and authorization are required.
>
> **Working name:** Entropia Commons. No token, DAO, chain, market or provider is selected.

## 1. The dream: life, memory and commons

Entropia could evolve from one person's browser experiment into an open, participant-operated network of evolving artificial worlds.

A person runs a world, pauses it, or delegates computation to another volunteer. Different people preserve verifiable copies of its history. Independent participants repeat experiments and challenge incorrect results. Communities can sponsor experiments and the infrastructure required to run and preserve them.

The desired property is **absence of dependence on any indispensable operator**. The project should, in principle, remain usable, reproducible and forkable if the originating website or developer disappears.

Three separate values form its identity:

- **Life:** execution of evolutionary state transitions.
- **Memory:** durable, portable preservation of the worlds and their causal histories.
- **Commons:** open participation, verifiability, governance and transparent resourcing.

These are goals, not claims that a peer network automatically supplies availability, trust or perpetual funding.

### North star

> A digital ecosystem can be computed by one participant, independently verified by another, preserved by many, and scientifically revisited without requiring trust in its original operator.

The network is a way to preserve and study **unanticipated but causally explainable evolutionary histories**, not a machine that fabricates discoveries.

## 2. Distinguish decentralization from three other claims

**Peer-to-peer distribution** removes the need for a single data-transfer server. It does not automatically make data durable or a result trustworthy.

**Permissionless participation** allows arbitrary nodes to appear. It creates Sybil, spam, abuse, scheduling and adversarial-validation problems.

**Self-sustaining economics** means ongoing compute, storage, networking, moderation and maintenance resources are actually available. Distributed topology does not pay for electricity or guarantee volunteers will remain.

**Trustless validation** is stronger than cryptographic hashes. A content hash proves integrity of bytes relative to the hash; it does *not* prove the simulated transition was correctly executed.

Use precise claims and measured threat models. Never label a design fully trustless, censorship-resistant, 24/7 guaranteed or immortal before its assumptions and tests justify those words.

## 3. Borrow mechanisms, not unnecessary platforms

Three complementary traditions inform the concept:

| Inspiration | Reusable design idea | Not implied |
| --- | --- | --- |
| BitTorrent | Swarming retrieval, multiple seeders, independent data transfer | Availability without online seeders or pinned copies |
| IPFS/content addressing | Immutable content identifiers, Merkle-linked artifacts, portable archives | Permanent storage, valid computation or consensus |
| Ethereum | Signed commitments, public verifiability, optional settlement/governance mechanisms | Run all organism ticks on-chain or create an Entropia blockchain |
| BOINC | Voluntary compute, replicates, results comparison, validation of untrusted machines | Instant trust or free unlimited computation |
| Git | Immutable history graph and explicit forks | A consensus protocol for one canonical world |

Possible future candidates include libp2p networking, content-addressed checkpoint storage and existing payment/grant tools. All require fit tests; none is approved by this document.

Avoid creating a native blockchain or token as a prerequisite. An open peer network and independent experimental replication should work without either.

## 4. Prefer distributed *worlds*, not distributed *ticks*

### Recommended starting topology

A world has one authoritative state-transition executor at a time, while other nodes may store checkpoints, replay transition ranges and observe its history. Many independent worlds could execute on different peers. No scale is claimed here.

This retains the hybrid concept's deterministic engine and single-writer semantics without demanding cross-machine synchronization on every collision, food consumption or movement.

**One world distributed across many compute nodes** could be explored later, but partition boundaries, high-frequency interaction, cross-node latency, ordering and floating-point reproducibility create substantial complexity. It is not the default architecture.

### Logical node roles

- **Compute Node:** advances assigned worlds or bounded tick ranges under versioned rules.
- **Archive Node:** pins and serves content-addressed checkpoints, provenance and history.
- **Validator Node:** independently recomputes or audits claimed results.
- **Discovery / Relay Node:** helps locate peers and connect networks with NAT or browser restrictions.
- **Observer Node:** explores world projections, histories and comparisons without authoritative writes.
- **Coordinator / Project Node:** optionally creates experiments, assigns jobs and aggregates results under an explicit trust policy; it is replaceable, not a mandatory permanent authority for the entire network.

One machine may combine roles. No role grants automatic authority to modify another user's canonical world.

### Logical sketch

~~~mermaid
flowchart TB
    UI["Observers / researchers / experiment sponsors"]
    NET["Open peer discovery and authenticated messages"]
    UI <--> NET

    A["Compute node A"]
    B["Compute / validator B"]
    C["Archive node C"]
    D["Archive / relay D"]
    NET <--> A
    NET <--> B
    NET <--> C
    NET <--> D

    A --> HIST["Content-addressed checkpoints and provenance"]
    B --> HIST
    C <--> HIST
    D <--> HIST
    HIST --> WORLDS["Independent worlds and branches"]

    FUNDS["Community contributions / grants / sponsorship"]
    FUNDS -. "bounded, transparent resources" .-> A
    FUNDS -. "bounded, transparent resources" .-> C
~~~

This diagram does **not** imply one global mutable chain, one global state or one mandatory coordination service.

## 5. World identity, checkpoints and Merkle-linked provenance

Reuse the hybrid concept's identities: worldId, branchId, parentCheckpointId, tick, rulesetVersion, engineBuild, schemaVersion and provenances.

A proposed immutable artifact envelope includes:

- worldId, branchId and explicit origin / parent;
- input checkpoint CID and output checkpoint CID;
- exact tick start/end and canonical serialization/hash algorithm version;
- simulator ruleset, engine build and deterministic execution profile;
- ordered user interventions and run parameters;
- state-content digest, resource and validation metadata;
- author/submitter identity or public key signature where appropriate;
- validation statements, explicitly distinguished from state-content hashes.

A checkpoint is an immutable **claim about state**, not evidence that its antecedent computation was performed.

Provenance is a directed acyclic graph of immutable artifacts and declared transitions. A fork produces a new branch ID. This means participants can replay or fork history without overwriting it.

An untrusted node cannot declare a forged snapshot valid merely by naming a CID or signing it. Cryptographic signatures establish *which key signed an assertion*, not that the assertion is true.

Exact canonical encoding, hashing, signatures and protocol-version migration are undecided; design them before expecting cross-implementation reproducibility. Changing encodings must not silently reinterpret old histories.

## 6. Proof of Evolution: a research term, not a proof system

**Working term only:** *Proof of Evolution* (PoE) means evidence accompanying a claimed world transition. It must not be marketed as cryptographic proof of correct computation unless it actually provides that property.

### Candidate validation procedure

1. A scheduler or world owner creates a bounded task: checkpoint A, engine/ruleset identity, parameters, range [tick N, tick M], execution budget and expected artifact format.
2. Node A restores A, computes the requested transitions and publishes checkpoint B and a signed execution claim.
3. Independently selected verifier nodes restore A, compute the same tick range and compare the canonical output state and relevant event commitments.
4. Accepted validation evidence is attached to the A → B transition under an explicit policy.
5. The authority mechanism for that world decides whether B becomes the next **canonical** checkpoint.

Verification is not identical to consensus, and consensus on a hash is not verification of its computation.

### Proposed assurance levels

| Level | Candidate mechanism | Explicit residual risk |
| --- | --- | --- |
| L0 — Private/local | Author trusts local engine and locally measured invariants | Device defects or manipulated local state |
| L1 — Owner-verified | Owner replays selected transitions | Owner availability, non-independent proof |
| L2 — Replica-verified | Multiple independently operated nodes replay full bounded tasks | Extra compute, collusion, correlated bugs |
| L3 — Audited | Independent random or risk-based spot-check of transitions | Probabilistic detection; incomplete coverage |
| L4 — Succinct/verifiable compute research | Investigate formal/cryptographic execution proofs only after feasibility study | Proof engineering, cost and compatibility may be prohibitive |

No assurance level is automatically appropriate for every world. A personal experiment need not fund the same validation as a public scientific claim.

### Adversarial validation concerns

- Independently operated validators matter more than nominal validator count; one adversary can create many identities.
- Validator selection must mitigate collusion and predictable targeting if used as adversarial evidence.
- Replicas may share the **same code defect** and agree incorrectly. Cross-implementation or property-based checks might be necessary for higher confidence.
- Replaying a full job can cost as much as the original computation; validation budgets must be explicit.
- Stalled validators or inconsistent answers should produce a disputed/unverified state, not invented success.
- A malicious task can exhaust CPU, memory or storage; enforce quotas and strict import validation.
- Validation must reproduce **simulation state and causal rules**, not just superficial population totals or render buffers.

## 7. What replaces the hybrid design's central authority registry?

It is not necessary for all worlds to share a universal consensus mechanism. Different communities may choose different authority models.

### A. Owner-authoritative worlds

A world owner signs permissible history/ownership transitions. Third-party compute and archive nodes can participate without dictating the owner's next canonical branch.

Benefits: simple and suitable for private experiments and early decentralized storage.

Limitations: owner availability, key security, recovery and potential unilateral rewriting of claimed canonicity must be handled.

### B. Federated / community-authoritative worlds

A specified set of governance/validator participants follows agreed acceptance thresholds, membership, rotation and conflict procedures. A quorum may accept a checkpoint or transfer ownership.

This can distribute trust but remains an explicitly governed federation. It is not automatically permissionless or Sybil-resistant.

Membership identity, safety under network partitions, liveness under offline nodes and signer-key recovery need separate protocol design.

### C. Free-fork worlds

No single canonical successor is required: any participant may fork a verified checkpoint with a new branch ID and publish an alternative evolutionary history.

Free forking is especially well suited to scientific comparisons. Distinguish *intentional alternative histories* from accidentally concurrent writes claiming the **same** canonical branch.

### One writer per canonical branch

Within a chosen canonical authority mode, retain the invariant that no two publishers may commit mutually incompatible next revisions as the same undisputed canonical branch.

In the current hybrid architecture, a registry checks an ownerEpoch fencing token. In a P2P model, the *mechanism implementing that check depends on authority mode*:

- Owner-signed sequence numbers and conflict detection for personal histories.
- Quorum-agreed revision/epoch statements for federated histories.
- Explicitly separate branches when competing histories have no shared canonical arbiter.

**Critical caveat:** signed append-only claims alone do not prevent an owner from signing two incompatible successors. Gossip and public conflict evidence can *detect* equivocation, but cannot create global finality or guarantee one canonical head during a network partition.

Never claim linearizable global ownership or finality for a permissionless federation without a concrete consensus/security protocol and adversarial evidence.

## 8. Storage: durability requires real custodians

Content addressing is a retrieval/integrity mechanism, not a preservation contract.

Availability depends on peers who physically retain and serve complete data, or on explicitly contracted storage providers. A CID whose blocks are not held by anyone is not a backup.

Candidates:

- Peer-to-peer block distribution / swarming.
- Replicated immutable checkpoint objects and separate provenance manifests.
- Independent pinning/storage commitments with verification and expiration dates.
- Optional erasure coding only if measurements show it improves reliability/cost.
- Local offline export/import, independent of the P2P discovery service.
- Scheduled availability probes, restore tests and replica audits.

### Storage invariants

- Define what constitutes a **complete** recoverable snapshot, including all referenced blocks, genetic ancestry and ruleset version.
- Maintain and test more than one independent failure domain for important published histories.
- Report verified replica count and last successful restore-check rather than promising permanence.
- Make pinned scientific checkpoints explicit; do not silently delete them for quota reasons.
- Distinguish transient relay caching, funded archival storage and best-effort volunteer pinning.
- Respect privacy: publication to a peer network may become difficult or impossible to revoke, even if an interface hides it.

The system should be able to operate without a privileged permanent bootstrap node, using multiple independent discovery paths; this does not imply guaranteed connectivity across all NAT/firewall configurations.

## 9. Peer networking

A potential networking stack may need:

- Stable peer identities and authenticated connections.
- Flexible transports for desktop/server and browser clients.
- Discovery and exchange of peer addresses/records.
- Relay support when direct connections fail.
- Immutable block exchange and availability announcements.
- Rate limiting, quotas and abuse controls.
- Version negotiation, authenticated task assignment and result publication.

libp2p/IPFS technologies are **candidates**, not an approved implementation.

The browser may be a limited observer or local executor rather than a publicly reachable archival/full compute peer. Browser lifecycle, platform restrictions, permissions and background suspension prevent reliable promises of 24/7 compute from a tab.

A fully distributed network still needs physical bandwidth, public rendezvous/relay capacity, resilience planning and security maintenance.

## 10. Open participation versus trust, abuse and fairness

The network should support participation by independent contributors, but open joining does not automatically make all contributed artifacts trustworthy.

Threat cases to research:

- Identity multiplication (Sybil) to overwhelm validator quorums or funding.
- Falsified compute results and bogus validator acknowledgments.
- Corrupt/partial blocks, archive withholding and unavailable historical dependencies.
- Maliciously huge, cyclic or malformed manifests and snapshot imports.
- Denial of service by expensive genomes, worlds or unbounded tick tasks.
- Replay/rollback attacks and conflicting owner-signed successors.
- Key theft and compromised compute/validator/archive nodes.
- Software supply-chain compromise and cross-version ruleset ambiguity.
- Task/telemetry poisoning and false claims of discovery.
- Privacy leakage from public metadata, genealogy, owner identities and command logs.
- Resource extraction from volunteers without consent or clear caps.

Volunteers must opt in to bounded CPU, memory, disk, electricity, networking and scheduling limits. Participation should be pausable and reversible, with clear cost and workload estimates.

Nothing in this concept authorizes executing untrusted user-supplied code or remotely supplied plugins. Early jobs should accept *data and known, versioned engine binaries only*.

## 11. An open network without a native cryptocurrency

The research should start from useful decentralized computation and preservation, not a speculative asset.

### Community resources

Volunteer nodes contribute controlled spare computation, independent checkpoint storage, validation, relay or documentation.

Contributions may be acknowledged via publicly verifiable records of work, with privacy controls and anti-gaming protections. A badge is not evidence that computation was useful or correct.

### Project funding

Transparent contributions, grants, sponsorship and recurring support can cover engineering, audit, testing, documentation, relay and bootstrap operation, and shared infrastructure. Relay and bootstrap operators should be plural and separately funded, so that no project-owned endpoint is required (see section 12).

An open budget should distinguish operating expenses from research allocations and publish what was actually funded and delivered.

Existing payment, nonprofit, crowdfunding or fiscal-hosting services are potential mechanisms. A native currency is not a prerequisite.

### Experiment-specific funding

A community may fund a well-specified scientific question, e.g.:

> Under what local ecological constraints can cooperative behavior become stable without an explicit scripted-cooperation action?

An experiment specification should include:

- Hypothesis, controls and preregistered measurements where appropriate.
- Ruleset/engine identity and reproducible baseline.
- Number of independent seeds and task ranges.
- Required validation assurance and archive redundancy.
- Estimated CPU, time, storage, money and maximum budget.
- Explicit failure criteria and public evidence/reports.

Payments, if any, are tied to agreed service deliverables and verified artifact availability/execution, not unsubstantiated discoveries or guaranteed favorable evolution outcomes.

### Economic limits

A fully volunteer network can go offline when volunteers leave. A fully paid network can stop when funding expires. Sustainable operation requires measurable supply, demand, budgets and incentives.

Avoid claiming that donated capacity has zero cost: electricity, hardware wear, network use and time are borne by participants.

### No token-first design

A hypothetical future on-chain component could handle limited public commitments, escrow or transparent settlement when justified. It should not store every snapshot or compute biology on-chain.

Before even considering a native token, require evidence that simpler fiat/donation/payment/federation mechanisms fail a specific requirement, and separately assess legal/regulatory, security, manipulation and governance consequences.

This document approves **no token issuance, sale, promotion, fundraising campaign, DAO, wallet, smart contract or financial integration**.

## 12. Sustainability and governance of Entropia Commons

Proposed governance principles for discussion:

1. Open protocol specifications and versioned interoperable data formats.
2. Reproducible tests and independent implementations where feasible.
3. Plural bootstrap, relay and archive operators; no required project-owned endpoint.
4. Transparent code review, incident response and documented protocol changes.
5. Defined ruleset compatibility: new code may not silently rewrite old biological histories.
6. Clear software/data licensing and publication/withdrawal expectations before opening archives.
7. Separate the ability to *fork a world* from governance of a *canonical world*.
8. Publish the costs and assumptions supporting availability claims.
9. Provide a path for the network to remain usable if the original project disappears.
10. Allow governance models to evolve only through explicit decisions with documented tradeoffs.

Potential future organizational choices range from informal OSS contributors to nonprofit stewardship, a research consortium or other governance mechanisms. None is selected.

Permissionless hosting and open-source licensing require separate attention to abuse, safety and moderation of publicly indexed data. An "open" network need not mean every peer blindly accepts or serves every artifact.

## 13. A decisive, bounded pilot: four independent peers

Before attempting any full distributed network, prove a narrow claim:

> One world can be computed by one operator, independently checked by another and recovered from separately held replicas when the primary compute/storage peer disappears.

### Candidate pilot setup

- Peer A: original compute operator.
- Peer B: independent recompute/validator and candidate successor compute operator.
- Peer C: durable checkpoint archive.
- Peer D: separate archive and discovery/relay where needed.

No mandatory blockchain or tokens. Roles are logically distinct, and the experiment should use genuinely separate failure domains if claiming resilience.

### Candidate test sequence

1. Begin with an identical signed/canonicalized checkpoint A at a known tick and published engine/ruleset identities.
2. Node A computes a bounded range and publishes output B.
3. Node B recomputes the range independently and records comparison/evidence. Introduce a deliberately incorrect result in a synthetic negative test.
4. Archive nodes C and D independently store and prove retrieval of the complete checkpoint and its provenance.
5. Terminate A and deliberately make its storage unavailable.
6. Recover from C or D, authorize successor B using the chosen *explicit* personal/federated authority policy and advance further ticks.
7. Introduce interruption during handoff and make sure competing canonical writes are detected/rejected under the **stated** trust model.
8. Confirm genealogy, tick, RNG, causal history, rule versions and scientific measurements survive.
9. Test disappearance of one discovery/relay path and confirm alternative path or document the limitation.
10. Record CPU/memory/network/storage/verification overhead, downtime, replica availability and negative-test outcomes.

Success is not "the network is decentralized forever." It is the narrower, measured property of independent replay, recovery and bounded handoff under a declared failure/trust model.

**This pilot is a proposed experiment only. No permission to run it is granted by this document.**

## 14. Conceptual evolutionary roadmap

This adds a research trajectory to the existing [Hybrid World Runtime and Lifecycle](hybrid-world-runtime-and-lifecycle.md). It does **not** replace its stages or Issue #57.

| Direction | Proposed milestone | Proof sought |
| --- | --- | --- |
| Foundation | Local checkpoint durability, deterministic equivalence | A world survives browser closure and exact restore |
| Execution portability | Shared TypeScript core in browser and headless | Reproducible fixed-horizon state evolution across runtimes |
| Networked memory | Replicated content-addressed checkpoints | Independent retrieval after a peer disappears |
| Volunteer computation | Bounded tasks with independent replay | Untrusted execution is distinguishable from correctness |
| Federated worlds | Explicit authority models and conflict handling | Recoverable canonical history without one permanent compute operator |
| Open commons | Multiple independent operators and transparent support | Measured, durable collaboration and realistic costs |
| Research observatory | Public experimental history and repeatable forks | Evidence-based comparison of evolutionary possibilities |

The table lists infrastructure directions only. Issue #57's product sequence (ecology, simple Utility AI, Boids-related traits, endurance acceptance) remains the product priority and is not represented in this table.

Keep the network optional for local users. Do not impose public key management or participation in peer discovery on someone who only wants a private, sleeping IndexedDB world.

## 15. Open questions and research gates

The following **remain undecided**:

- What is the minimum viable trust model: owner authority, federation, or free-fork-only?
- Is there a need for canonical world ownership across offline participants at all, or can forks resolve most contention?
- Which deterministic execution profile can be reproduced across platforms?
- What workload granularity produces useful distributed throughput after replication cost?
- Which validation assurance level is appropriate to each scientific claim?
- How to resist Sybil identities without making participation exclusive or financially coercive?
- How to canonicalize state encoding and version rule changes?
- What privacy/default-publication policy applies to world history and genealogy?
- Who pays for archive replication, validators, discovery and relays?
- What is the realistic retention/availability promise for a funded versus volunteered world?
- What governance and licensing preserve openness without claiming immunity to abuse?
- Is a blockchain or settlement ledger demonstrably necessary for any concrete use case?

Gate to deeper research: **measure real local determinism, snapshot size, throughput, archive footprint and independent replay cost first**. Research candidate protocols against threat models, not marketing labels.

## 16. References for future verification

The following are *research starting points*, not implementation endorsements:

- [Entropia hybrid world runtime concept](hybrid-world-runtime-and-lifecycle.md)
- [Entropia Issue #57](https://github.com/dogmator/entropia/issues/57)
- [IPFS — how content addressing works](https://docs.ipfs.tech/concepts/content-addressing/)
- [IPFS — persistence / pinning](https://docs.ipfs.tech/how-to/pin-files/)
- [libp2p](https://libp2p.io/)
- [BOINC](https://boinc.berkeley.edu/)
- [Ethereum documentation](https://ethereum.org/en/developers/docs/)
- [Golem Network documentation](https://docs.golem.network/)
- [Martin Kleppmann — How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)

Project research should compare the actual documentation, implementation maturity and current security/operational constraints at the time of any later approval.

## 17. Decision and governance status

**RESEARCH CONCEPT ONLY. IMPLEMENTATION NOT AUTHORIZED.**

No change to the accepted, implementation-blocked scope of Issue #57. No grant of permission for source modifications, new implementation PRs, infrastructure changes, expenditures, fundraising, tokens, cryptocurrency, deployment, governance or security policy changes.

The existing coding agent's approved mission and branches remain unaffected. This document does not direct or authorize that agent to begin P2P development.

Entropia Commons is one possible future **extension of the hybrid architecture**. It may ultimately be built as an open P2P protocol, a federation of volunteer operators, a free-fork scientific archive, or some combination. Selection depends on evidence, operator decisions and incremental review.

**Long-term north star:** A small digital universe whose evolutionary histories may be computed by one participant, independently reproduced by another, preserved by many and examined by anyone with access—without requiring perpetual operation by its creator.
