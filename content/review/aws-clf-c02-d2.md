# D2 review (2026-10-01)

Structural check: 48/48 pass. Fact check (4 verifiers, each opened the source URL): 47 ok, 1 flagged.

| Card | Finding | Proposed action |
|---|---|---|
| t2.2-07 | Correct, but AWS Config proactive mode is above Cloud Practitioner level | Rewrite: "AWS Config rules prevent noncompliant resources from being created." False. "AWS Config evaluates resource configurations and flags noncompliant resources. Preventing actions needs a preventive control such as an SCP or IAM policy." |
| t2.2-08 | Correct, but CloudTrail event history vs data events is associate-level detail (flagged by Claude, verifier passed it) | Drop or replace |
| t2.1-04 | Correct, but a strawman: nobody believes AWS picks your data sensitivity labels (flagged by Claude, verifier passed it) | Replace |
| t2.1-02, t2.1-05 | Source is an archived whitepaper ("historical reference only") | Point to https://aws.amazon.com/compliance/shared-responsibility-model/ |
| t2.3-08, t2.4-02, t2.4-08 | Source page covers only half of the card; other half verified on a second page | Keep, optionally add second source |

Decisions pending with the owner.
