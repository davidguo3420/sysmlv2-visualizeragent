# SysML 2 Rule Verification Guide

## Scope

This document summarizes the active ME VAL modeling rules currently loaded by the visualizer after excluding the `ME Essential Modeling` sheet. The active ruleset contains `38` rules across `Standard Modeling`, `Optional`, and `Executable`.

Each rule below includes:

- the model-quality intent of the rule
- a practical verification approach for SysML 2 textual models
- source citations that ground the check in SysML, UML, or MBSE modeling literature

The verification approaches are written for SysML 2 text-first processing. Some checks map directly to SysML 2 language constructs, while others are legacy SysML/UML diagram-quality checks that should be evaluated through derived views, metadata, or migration-oriented compatibility checks.

## Citation Key

| Key | Source |
| --- | --- |
| S1 | Object Management Group, [OMG System Modeling Language Specification Version 2.0](https://www.omg.org/spec/SysML). The OMG page identifies the SysML 2.0 Language Specification and related machine-readable syntax artifacts. |
| S2 | Object Management Group, [Kernel Modeling Language Specification Version 1.0](https://www.omg.org/spec/KerML). KerML provides the semantic kernel for SysML 2 model elements, features, types, membership, and relationships. |
| S3 | Object Management Group, [Unified Modeling Language Specification Version 2.5.1](https://www.omg.org/spec/UML/2.5.1/About-UML). UML remains useful for legacy activity, interaction, state-machine, use-case, actor, artifact, comment, and diagram semantics. |
| S4 | Object Management Group, [OMG Systems Modeling Language Specification Version 1.7](https://www.omg.org/spec/SysML/1.7/About-SysML). SysML 1.7 remains the most direct source for legacy SysML block, internal-block, proxy-port, item-flow, constraint-block, and diagram concepts that are being migrated or approximated in SysML 2. |
| S5 | Friedenthal, Moore, and Steiner, [A Practical Guide to SysML, 3rd Edition](https://www.oreilly.com/library/view/a-practical-guide/9780128002025/). The published contents cover package organization, blocks, ports and flows, constraints, activities, interactions, state machines, use cases, and requirements. |
| S6 | NASA, [NASA Systems Modeling Handbook for Systems Engineering](https://standards.nasa.gov/standard/NASA/NASA-HDBK-1009). This handbook ties SysML modeling to systems engineering products, model organization, technical requirements, verification, validation, and generated views. |
| S7 | NASA, [Systems Engineering Handbook Appendix](https://www.nasa.gov/reference/system-engineering-handbook-appendix/). The appendix includes requirements quality and verification matrix guidance useful for documentation and reviewability checks. |
| S8 | OMG SysML Partners, [The SysML Modelling Language](https://www.omg.org/sysml/The_SysML_Modelling_Language.pdf). This paper describes SysML as an extension of UML for specification, analysis, design, verification, and validation of complex systems. |

## Standard Modeling Rules

| Rule | Rule summary | SysML 2 verification approach | Sources |
| --- | --- | --- | --- |
| `ACTIVITYEDGEINCOMING` | Control nodes must have at least one incoming control or object flow. | Build a directed activity graph from SysML 2 action, flow, succession, and transition relationships. For each derived control node except an initial/start node, verify that at least one incoming control or object-flow edge resolves to that node. Report unresolved targets separately from true missing incoming edges. | S1, S2, S3, S5 |
| `ACTIVITYNAME` | Activities must be named. | Inspect all `action def`, action usage, behavior, and derived activity containers. Verify that each has a non-empty declared name after trimming quoted names and aliases. For anonymous inline actions, verify that the owning step has a stable generated label and record it as a warning rather than a pass. | S1, S2, S3, S5 |
| `ACTORNAME` | All actors must have names. | In SysML 2, represent actors as named external `part def`, `part`, stakeholder, or metadata-classified elements. Verify every element classified as an actor or external participant has a non-empty declared name and a stable identifier for traceability. | S1, S2, S3, S5 |
| `ANNOTATEDELEMENTS` | Problem and rationale elements should annotate at least one model element. | Parse `comment`, `doc`, metadata, problem, rationale, and annotation-like records. Verify each annotation carries a target reference such as `about`, `for`, `annotates`, ownership context, or a resolvable element path. An unattached package-level `doc` can be treated as applicable to the package. | S1, S2, S3, S6, S7 |
| `ARTIFACTNAME` | All artifact elements must be named. | Identify artifact-like elements through metadata, package imports, external-file references, generated-view records, or legacy migration tags. Verify each artifact has a non-empty name or declared URI label. In pure SysML 2 models without artifact constructs, mark the rule not applicable. | S1, S2, S3, S6 |
| `BLOCKNAME` | Blocks must be named. | Map legacy blocks to SysML 2 `part def` and related definition elements. Verify every structural definition has a non-empty name and that duplicate display names are either qualified by package path or explicitly aliased. | S1, S2, S4, S5 |
| `CLASSPROHIBIT-EDIT` | Unstereotyped classes are prohibited; use blocks, activities, or other elements instead. | Scan source text and parsed model elements for raw UML `class` declarations or imported unstereotyped class records. In SysML 2, prefer `part def`, `item def`, `action def`, `attribute def`, `interface def`, or other SysML definitions. Exempt known tool-import packages only when the source preserves explicit provenance metadata. | S1, S2, S3, S4, S5 |
| `COMMENTBODY` | Comment, problem, and rationale bodies may not be empty. | Parse `comment`, `doc`, problem, rationale, and metadata note bodies. Verify the normalized text contains at least one non-whitespace token. If the comment exists only as a title or ID, fail the body check while preserving the identifier for repair. | S1, S2, S3, S6, S7 |
| `CONSTRAINTSPECIFICATION` | Constraint specifications may not be empty. | Inspect `constraint`, `assert constraint`, `require constraint`, `calc def`, and constraint-block-like definitions. Verify each owns an expression, predicate, equation, or requirement condition body. Empty braces, placeholders, and comments-only bodies should fail. | S1, S2, S4, S5 |
| `CONTROLNODEINCOMING` | Joins and merges must have at least two incoming flows. | Classify derived control nodes as join or merge nodes from SysML 2 action-flow structure or legacy metadata. Count resolved incoming control/object-flow edges and require at least two. Treat unresolved incoming references as errors because they weaken executable semantics. | S1, S2, S3, S5 |
| `CONTROLNODEOUTGOING` | Forks and decisions must have at least two outgoing flows. | Classify fork and decision nodes in the derived activity graph. Verify each has at least two outgoing edges. For decisions, also check that the branch labels or guards are carried on outgoing edges so later semantic checks can reason about alternatives. | S1, S2, S3, S5 |
| `DECISIONNODENAME` | Decision nodes must have a name. | Locate decision nodes, decision actions, or choice-like control nodes in activities. Verify each has a non-empty name that states the decision criterion or question. A branch label alone is not enough unless it is also promoted to the decision node label. | S1, S2, S3, S5 |
| `DIAGRAMNAME` | Diagram names may not be blank. | SysML 2 text does not require diagrams as first-class language elements, so evaluate this against visualizer metadata, exported view records, and tool-specific diagram annotations. Verify every saved diagram/view has a non-empty title and a stable owning model element. | S4, S5, S6 |
| `ENUMERATIONLITERAL` | Enumerations must own at least one literal. | Inspect `enum def`, datatype enumerations, or migrated enumeration records. Verify each enumeration owns at least one literal member. If the type is only referenced but defined externally, mark it unresolved rather than failing the local model. | S1, S2, S3, S5 |
| `FLOWFINALINCOMING` | All flow final nodes must have one incoming flow. | Identify final-flow nodes in the derived activity graph. Verify exactly or at least one incoming edge according to project convention; for this workbook rule, require one or more incoming edges and no outgoing edges. | S1, S2, S3, S5 |
| `IBDOWNER` | Internal block diagrams must be owned by a block. | In SysML 2, derive IBD-like views from a `part def` or structural usage context. Verify every internal-structure view has a resolvable owning `part def` or equivalent block-like definition, not just a free-floating collection of parts. | S1, S2, S4, S5 |
| `MERGEJOINOUTGOING` | Merge and join nodes must have exactly one outgoing flow. | For each merge or join node in the derived activity graph, count resolved outgoing flows. Require exactly one outgoing edge. Multiple outgoing edges should be modeled as a following fork or decision so synchronization and merge semantics remain clear. | S1, S2, S3, S5 |
| `OPERATIONNAME` | Operations must be named. | Verify `operation`, operation-like `action def`, service action, and callable behavior members have non-empty names. For SysML 2 models that use actions instead of UML operations, validate the callable action name and any exposed interface feature name. | S1, S2, S3, S5 |
| `PACKAGENAME` | Packages must be named. | Parse all `package` declarations and nested namespaces. Verify each package has a non-empty declared name and a unique qualified name within the model repository. Anonymous package fragments should be rejected or wrapped by an import container. | S1, S2, S5, S6 |
| `SIGNALEVENTSIGNAL` | Signal events must have a signal defined. | Inspect accept actions, event triggers, transitions, and sequence/event metadata. Verify each signal event references a defined `item def`, signal-like type, event type, or imported signal definition. Unresolved signal names should fail because receivers cannot type their data payloads. | S1, S2, S3, S5 |
| `SIGNALNAME` | All signals must be named. | Treat SysML 2 signal-like payloads as named `item def`, event/item definitions, or imported signal records. Verify every signal definition has a non-empty name and that event usages refer to it by a resolvable name or qualified path. | S1, S2, S3, S5 |
| `STMACHINENAME` | State machine names may not be blank. | Identify state-machine-like behavior definitions, state definitions, transition clusters, or migrated UML state machines. Verify each state machine has a non-empty name and an owning part/block context when executable behavior is intended. | S1, S2, S3, S5 |
| `TERMNAME` | Glossary terms must be named. | Parse glossary packages, term metadata, requirement vocabulary records, and documentation tables. Verify each term has a non-empty term name plus optional definition text. If glossary information is external, mark the rule unresolved and link to the external vocabulary source. | S6, S7 |
| `USECASENAME` | Use cases must be named. | For legacy or migrated use-case models, verify each use case has a non-empty name. In SysML 2 text, use cases are often represented as requirements, actions, or stakeholder interaction scenarios, so the checker should also validate any use-case metadata applied to those elements. | S1, S2, S3, S5 |
| `VALUENAME` | Value properties must be named. | Inspect `attribute`, value property, quantity, and measure declarations. Verify each value feature has a non-empty name and, where possible, a declared type or unit. The name check is separate from type/units quality checks. | S1, S2, S4, S5 |

## Optional Rules

| Rule | Rule summary | SysML 2 verification approach | Sources |
| --- | --- | --- | --- |
| `ACTPARTYPE` | Activity parameter nodes must be typed by signals, blocks, or value types. | Inspect activity input and output parameters, action pins, and derived object-flow endpoints. Verify each parameter has a resolvable type such as an `item def`, `part def`, value type, attribute type, or imported signal/data definition. | S1, S2, S3, S5 |
| `CONNECTOREND` | Connector ends must be proxy ports. | For SysML 2 connectors, inspect each endpoint path and resolve it to a port or interface feature. When checking legacy SysML compatibility, require connector ends to terminate on proxy-port-equivalent interface features rather than directly on arbitrary internal properties, unless the modeling method explicitly allows direct part connectors. | S1, S2, S4, S5 |
| `CONSTRAINTBLOCKDOC` | Constraint blocks must have documentation. | Map legacy constraint blocks to SysML 2 constraint definitions, calculations, or analysis definitions. Verify each has explanatory `doc` or comment text describing the physical, mathematical, or logical meaning of the expression, not just the equation body. | S1, S2, S4, S5, S6 |
| `CONSTRAINTTYPE` | Constraint properties must be typed by constraint blocks. | Inspect usages of constraints, calculations, and parametric bindings. Verify each constraint usage is typed by a defined constraint/calculation definition rather than by an untyped anonymous expression when reuse or traceability is expected. | S1, S2, S4, S5 |
| `CONVEYTYPE-BLOCK` | Item flows may only convey blocks. | For project profiles that restrict conveyed items to structural block-like things, resolve each item flow payload and verify it maps to a `part def` or acceptable block-equivalent definition. In pure SysML 2, document this as a method rule because SysML 2 may model conveyed things as item definitions instead. | S1, S2, S4, S5 |
| `CONVEYTYPE-SIGNAL` | Item flows may only convey signals. | For project profiles that restrict conveyed items to signal-like payloads, resolve each item flow payload and verify it maps to a signal, event item, or `item def` designated as a signal. If both block and signal conveyance rules are active, the checker should flag profile conflict unless the model distinguishes separate flow categories. | S1, S2, S3, S4, S5 |
| `ENTRYEXITNAME` | Entry and exit points for state machines must be named. | Identify entry and exit pseudo-states in state-machine-like behavior. Verify each has a non-empty name so transition paths can be referenced, reviewed, and traced. If the SysML 2 model expresses these as explicit actions, validate the corresponding action names. | S1, S2, S3, S5 |
| `STMCLASSIFIERBEHAVIOR` | If a block owns one or more state machines, one must be the block's classifier behavior. | For each `part def` or block-equivalent definition with owned state-machine behavior, verify one behavior is designated as the primary classifier/executing behavior through metadata, ownership convention, or explicit binding. Without that designation, simulation tools cannot reliably choose the state machine that governs the part. | S1, S2, S3, S5 |

## Executable Rules

| Rule | Rule summary | SysML 2 verification approach | Sources |
| --- | --- | --- | --- |
| `ACCEPTEVENTOUTPUT` | Accept events triggered by signal events must own an output pin. | Inspect accept actions and event-triggered transitions. When the trigger is a signal or signal-like item, verify the accept action exposes an output parameter/pin typed by the signal payload so downstream object flows can carry the received data. | S1, S2, S3, S5 |
| `MESSAGEFLOWNEEDED` | Signal message signatures must be realized by item flows or flow sets. | Build a sequence/message view from interactions, action flows, and connectors. For each message whose signature resolves to a signal or event item, verify there is a corresponding connector, item flow, object flow, or interface feature that realizes the exchange path. | S1, S2, S3, S4, S5 |
| `MESSAGESIGNATURE` | Sequence messages must have signatures assigned, except reply, create, and delete messages. | Inspect generated or imported sequence interactions. Verify each ordinary message has a resolvable signature, such as an operation, action, signal, item definition, or event type. Exempt lifecycle messages only when they are explicitly marked as reply, create, or delete. | S1, S2, S3, S5 |
| `STMINTEGRITY` | State machines may only call operations owned within their owning block's structural decomposition. | For each state machine, resolve its owning `part def` or block-equivalent definition. For each called operation/action in transitions or state effects, verify ownership is within the owner, one of its parts, or a type reachable through the owner's decomposition. Flag external calls without an explicit interface or allocation. | S1, S2, S3, S5 |
| `SUBMACHINESTR` | Submachine states must reference state machines owned by the owning block or blocks typing part properties within the owning block's structure. | Resolve each submachine reference and compare its owner to the structural context of the referencing state machine. Accept submachines owned by the same block/part definition or by definitions that type owned parts. Flag references to unrelated behavior libraries unless imported as an explicit reusable behavior pattern. | S1, S2, S3, S5 |

## Implementation Notes for the Visualizer

- Direct SysML 2 checks should operate on parsed definitions, usages, features, relationships, constraints, and textual source spans.
- Legacy UML/SysML diagram checks should operate on derived views plus visualizer metadata, because SysML 2 text does not require every SysML 1.x diagram artifact to exist as a first-class language element.
- Every rule outcome should distinguish `pass`, `fail`, `not_applicable`, and `unsupported`.
- A `not_applicable` result means the model does not contain the concept being checked.
- An `unsupported` result means the current parser cannot yet inspect the concept with enough fidelity.
- A `fail` result should include the specific element names or source locations needed for repair.

## Recommended Trace Fields

For each rule evaluation, the analysis tab should persist:

| Field | Purpose |
| --- | --- |
| `rule_id` | Stable workbook rule name, such as `BLOCKNAME`. |
| `ruleset` | Active workbook sheet, such as `Standard Modeling`. |
| `status` | `pass`, `fail`, `not_applicable`, or `unsupported`. |
| `support_mode` | `direct`, `approximate`, or `legacy-derived`. |
| `checked_elements` | Count and names of elements inspected. |
| `failing_elements` | Count and names of elements that violate the rule. |
| `source_spans` | Text ranges or line numbers for repair. |
| `rationale` | Human-readable explanation of the result. |
| `citations` | Source keys from this guide. |
