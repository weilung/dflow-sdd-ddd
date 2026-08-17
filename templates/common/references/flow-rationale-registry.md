# Flow Rationale Registry

Why the rules in the workflow flow files are shaped the way they are. One entry
per physical line, so one lookup returns the whole answer:

```bash
grep -E '^R-FF-BRANCH-02:' references/flow-rationale-registry.md
```

**Do not read this file whole.** It is a lookup table, not a document. Nothing
here is needed to execute a flow. Look up an entry when a developer asks why a
rule exists, or says a rule looks wrong.

Every line reads `<id>: [<edition ·>? <flow file> · <step> · <the rule it
belongs to>]` followed by the reason, so a keyword search finds the line when
you do not have an id. **Search a short fragment — four to eight words — not a whole sentence.**
The flow files are hard-wrapped, so most sentences there span a line break and
carry an indent that this file's single long lines do not have; a long phrase
copied out of a flow file will therefore match nothing here.

**Do not add `-m 1`.** A bracket that opens with `gf ·` or `bf ·` applies to
that edition only — usually one line per edition of the same rule, sometimes a
rule only one edition has. A bracket with no edition marker applies to both. So
a lookup can legitimately return two lines: read the one matching this project's
edition, which the workflow bundle's own `.dflow-bundle-manifest.json` records
in its `edition` field. Taking only the first would hand a Brownfield project
the Greenfield answer — the `gf ·` line is always first.

**Reviewers and future maintainers: read this before concluding that a check is
under-specified.** Several of these rules look loose on their own and are
bounded deliberately, with the boundary recorded here.

## finish-feature-flow.md

R-FF-MINSEL-01: [finish-feature-flow.md · Step 1 · What "Minimal host (zero-phase) only" selects, and what that does not prove] The routing rules are what keep the two apart in practice: a T1 never records into a minimal host, and a sealed minimal host cannot take anything further.

R-FF-ORPHAN-01: [finish-feature-flow.md · Step 1 · "And the other direction, for every host shape"] The checks around this one walk rows → files, so a file no row names is otherwise never examined. Deliberately **not** scoped to a host shape: an unreferenced `phase-spec-*` is precisely what makes a host read as *phase-bearing* to the minimal-host selector below, so a shape-scoped version of this check could never be the one that sees it.

R-FF-BRANCH-01: [finish-feature-flow.md · Step 1 · "The row must name *this* branch"] "An override happened once" would excuse closing out on any branch at all, which is not what the option sanctions; requiring the row to name where you actually are defeats that without over-blocking.

R-FF-BRANCH-02: [finish-feature-flow.md · Step 1 · "You are on this host's branch — or on a branch this host recorded a sanctioned override for"] ⚠ **Deliberately not "the most recent override".** A host can override onto `develop` for one phase and onto `spike/x` for the next, then close out on `develop` — and closeout fires no branch gate of its own, so no newer row is ever written. Keying on the most recent row would block a branch this host recorded a sanctioned override for, which is the same false block this clause exists to remove.

R-FF-BRANCH-03: [finish-feature-flow.md · Step 1 · "When it passes this way, say so in the conversation"] A gate that silently accepts an exception teaches the developer nothing about why it passed.

R-FF-BRSNAP-01: [finish-feature-flow.md · Step 1 · "Current BR Snapshot table is non-empty", on a phase-bearing T1 whose phase-specs establish no BR delta] (genuinely new work is `/dflow:new-feature` "even with no new BR / Domain / schema", `AI-AGENT-GUIDE.md` § Ceremony Scaling step 0, and `new-feature-flow.md` Step 4 initialises the Snapshot from planned BRs that may legitimately be none)

R-FF-GITMV-01: [finish-feature-flow.md · Step 4 · "`git mv` is mandatory — never use plain `mv` + `git add`"] This preserves git's directory rename detection so `git log --follow` / `git blame` / PR diff quality stays intact across the move.

R-FF-SWEEPKEY-01: [gf · finish-feature-flow.md · Step 4 instruction 2 · "Key it on the flow that produced the change, never on the flow that opened the host"] Those differ, and keying on the host is how the deadlock came back: `modify-existing-flow.md` Step 1.6 opens a **phase-bearing** host for a T1 follow-up, and Step 5.4 puts a T1 new-phase or a T2 lightweight *inside* a host opened by `/dflow:new-feature` — each of those runs Step 5.3 as its own sweep. Ask "which flow opened this host" and a hosted **T2** on a phase-bearing **no-BC** host has no arm at all: half (a) is empty because Step 3 is skipped, and the `glossary.md` rename its Step 5.3 made belongs to a sweep the question refused to look at. Unstaged it fails the clean-tree item; staged it is attributable to nothing. Deriving from *this change's* flow is the fix — not widening the set to "anything dirty".

R-FF-SWEEPKEY-01: [bf · finish-feature-flow.md · Step 4 instruction 2 · "Key it on the flow that produced the change, never on the flow that opened the host"] Those differ, and keying on the host is how the deadlock came back: `modify-existing-flow.md` Step 1.6 opens a **phase-bearing** host for a T1 follow-up, and Step 6.4 puts a T1 new-phase or a T2 lightweight *inside* a host opened by `/dflow:new-feature` — each of those runs Step 6.3 as its own sweep. Ask "which flow opened this host" and a hosted **T2** on a phase-bearing **no-BC** host has no arm at all: half (a) is empty because Step 3 is skipped, and the `glossary.md` rename its Step 6.3 made belongs to a sweep the question refused to look at. Unstaged it fails the clean-tree item; staged it is attributable to nothing. Deriving from *this change's* flow is the fix — not widening the set to "anything dirty".

R-FF-SWEEPKEY-02: [finish-feature-flow.md · Step 4 instruction 2 · "do not go looking for a list that host never produced"] ⚠ Keying this on the minimal-host allow-list (`finish-feature-minimal-host.md`) is what deadlocked the one shape where both halves are empty: a **phase-bearing, no-BC** host that swept a global document has nothing from Step 3 *and* no Step 1 allow-list, while this instruction still requires the delta staged and the post-commit path check would then reject it as unpermitted — two mandatory requirements that could not both be met.

R-FF-SPAN-01: [gf · finish-feature-flow.md · Step 4 post-commit verification · "The span is derived from what was staged, not from what the tables name"] Instruction 2 stages the archived directory **whole**, so a span built from the Phase Specs and Lightweight Changes rows is narrower than the commit — and Step 1 permits exactly one file no table names, the `aggregate-design.md` worksheet. Under the narrower span that file entered the commit and was compared against nothing. Keying on `git ls-tree` closes that for any such file, present or future, with no list to maintain.

R-FF-SPAN-01: [bf · finish-feature-flow.md · Step 4 post-commit verification · "The span is derived from what was staged, not from what the tables name"] Instruction 2 stages the archived directory **whole**, so a span built from the Phase Specs and Lightweight Changes rows is narrower than the commit. Greenfield's Step 1 permits one such file by name (an `aggregate-design.md` worksheet); brownfield has no counterpart today, and keying on `git ls-tree` means it needs no edit if one ever appears.

R-FF-POSTCOMMIT-01: [finish-feature-flow.md · Step 4 post-commit verification · "If that list was not recorded, report this check as degraded and say so — do not substitute `HEAD^`"] The parent commit is not the tree Step 1 read: the edits legitimately uncommitted at Step 1 would each surface as a difference no step ordered, and the check would block a correct closeout.

R-FF-POSTCOMMIT-02: [finish-feature-flow.md · Step 4 post-commit verification · "`git show HEAD:<path>` for each"] Reading the **committed** blob is what catches "the rename carried stale content" and "the row never made it into the commit".

R-FF-SPILL-01: [gf · finish-feature-flow.md · Step 4 post-commit verification · "The closeout commit contains only what closeout is allowed to write"] ⚠ **Keyed on instruction 2, and deliberately not on the minimal-host allow-list.** That allow-list exists only for a `Minimal host (zero-phase)` and lives in `finish-feature-minimal-host.md`; a phase-bearing host has none. Keying this item on it — with "plus whatever Step 3 wrote" as the other half — left a **phase-bearing, no-BC** host with **both** sources empty while instruction 2 still required its global sweep delta staged: stage it and this item rejected the path, skip it and the clean-tree item failed. Instruction 2 is the one statement that covers every host shape, which is why it is the source.

R-FF-SPILL-01: [bf · finish-feature-flow.md · Step 4 post-commit verification · "The closeout commit contains only what closeout is allowed to write"] ⚠ **Keyed on instruction 2, and deliberately not on the minimal-host allow-list.** That allow-list exists only for a `Minimal host (zero-phase)` and lives in `finish-feature-minimal-host.md`; a phase-bearing host has none. Keying this item on it — with "plus whatever Step 3 wrote" as the other half — left a **phase-bearing, no-BC** host with **both** sources empty (Step 3 is skipped for a no-BC host and for a baseline host) while instruction 2 still required its global sweep delta staged: stage it and this item rejected the path, skip it and the clean-tree item failed. Instruction 2 is the one statement that covers every host shape, which is why it is the source.

R-FF-SPILL-02: [finish-feature-flow.md · Step 4 post-commit verification · "Scope: this is a path-level spill check and nothing more"] A clean tree does not even cover the path level — it proves the changes were committed, not that only permitted ones were — and Step 4's staging instructions prove nothing on the developer-commit path.

R-FF-DERIV-01: [finish-feature-flow.md · Step 5 · "First, print the closeout verification's derivation"] **Why this is here.** The verification derives its admitted set instead of reading a list — that is what keeps the list and its sources from drifting apart — but it also means a reader cannot see the set by looking at the checklist. Printing the derivation keeps the flow inspectable instead of a box that answers `✓` without showing its working.

R-FF-INFLIGHT-01: [finish-feature-flow.md · Step 5 · "In-flight reminder"] Surfacing them at closeout is deliberate: attention is about to move elsewhere, and this is exactly where half-done work sinks.

## finish-feature-minimal-host.md

R-FF-COMMITCELL-01: [finish-feature-minimal-host.md · Step 1 · "Do not collapse the middle case into the first"] it is the one that reads as *filled* to every rule written against empty / non-empty, which is exactly why it survives elsewhere.

R-FF-COMMITCELL-02: [finish-feature-minimal-host.md · Step 1 · "Deliberately not run on a phase-bearing host"] a hosted T3's row rides the host's *next* commit (`references/git-integration.md` § Commit checkpoints), and nothing requires a hosted row to declare implementation paths — so (c) has no defined input there, and demanding it would reject every hosted T3.

R-FF-BASELINECAP-01: [bf · finish-feature-minimal-host.md · Step 1 · "a `spec-baseline` checkpoint and a `Tier = baseline` row imply each other"] `modify-existing-flow.md` Step 1.7 states the contract: a baseline capture is observation-only, *there is no implementation work*, which is why its checkpoint is not named `implementation`. (1) and (2) alone are the ledger talking about itself; (3) is what makes the claim true of the commit.

R-FF-CKPTCOUNT-01: [finish-feature-minimal-host.md · Step 1 · "the Checkpoint Log carries exactly one row at this point"] ⚠ **Why this counts every row, with no exclusion for the `branch-override` record:** a minimal host cannot carry one. `references/modify-existing-flow.md` withholds the branch-gate override from exactly these hosts (Step 1.6's follow-up variant, Step 1.7, Step 1.8), because they assert branch equality against a `branch:` cut by change class.

R-FF-CKPTCOUNT-02: [finish-feature-minimal-host.md · Step 1 · "the Checkpoint Log carries exactly one row at this point"] "Exactly two after closeout" follows from `finish-feature-flow.md` Step 4's post-commit read, which derives its admitted differences from Step 2 and Step 4 instruction 1 and admits nothing else.

R-FF-FOLLOWUP-01: [finish-feature-minimal-host.md · Step 1 · "the reverse link was opened, not only closed"] Decidable from one commit and one blob per original, so it stays inside closeout's remit.

R-FF-SUMMARY-01: [finish-feature-minimal-host.md · Step 5 · "Zero-phase minimal host — exact fields", on a no-BC host's `Related BR-IDs`] Forcing `none` here would erase a marker the approved zero-phase shape requires.
