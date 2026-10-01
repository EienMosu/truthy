# AWS CLF-C02 deck review summary (2026-10-01)

228 cards in 5 blocks (d1 48, d2 48, d3a 48, d3b 48, d4 36). Structural check: all pass.
Fact check: one sceptical verifier per task statement opened each source URL and decided the answer independently.
Result: 0 wrong answers, 0 explanation errors, 0 ambiguous. Details per block in `*.verify.json` and `aws-clf-c02-d2.md`.

## Rewrite or replace (10)

| Card | Reason | Rewrite available |
|---|---|---|
| t1.2-03 | strawman (cost optimization pillar recovers workloads) | yes, d1.verify.json |
| t1.4-03 | self-evident (powering servers is part of TCO) | yes |
| t1.4-06 | tautology (automation reduces manual work) | yes |
| t1.4-12 | arithmetic truism (cost per transaction) | yes, or drop |
| t2.1-04 | strawman (AWS chooses data sensitivity labels), flagged by Claude | needs replacement |
| t2.2-07 | above CLF level (Config proactive mode) | yes, aws-clf-c02-d2.md |
| t2.2-08 | above CLF level (CloudTrail event history vs data events), flagged by Claude | needs replacement |
| t3.1-06 | strawman (on-premises hosted in a public cloud data center) | yes, d3a.verify.json |
| t3.6-04 | answer readable from the service name (FSx for Windows) | yes, d3b.verify.json |
| t4.2-08 | answer readable from the name (AWS-generated tags) | yes, d4.verify.json |

## Source URL fixes (4)

t2.1-02, t2.1-05 (archived whitepaper -> shared responsibility model page), t4.1-09 (-> Savings Plans FAQ), t4.1-10 (-> EC2 On-Demand pricing page).

## Cross-block duplicates (5 pairs, drop the second of each)

- t3.4-11 / t3.7-11: Redshift is optimized for individual order transactions
- t1.1-04 / t3.2-07: deploying or choosing a Region near users reduces latency
- t1.1-09 / t3.2-05: EC2 replicates instances across Regions
- t2.4-03 / t4.3-09: AWS Marketplace offers third-party software
- t1.1-08 / t3.4-02: Amazon RDS is a managed relational database service

Mirrored pairs kept on purpose: t1.1-10 / t3.3-08 (Auto Scaling vs Elastic Load Balancing).

## Notes

- Support plans: current plans are Basic, Business Support+, Enterprise, Unified Operations; Developer, Business and Enterprise On-Ramp are discontinued on 2027-01-01. The d4 verifier reports that the live exam guide page for task 4.3 already uses the new names (the d4 generator had said the guide still showed legacy names; the two disagree, the verifier read the page directly).
- Renames confirmed against AWS docs: Amazon SageMaker AI, Amazon Quick Sight (within Amazon Quick), AWS Security Hub CSPM.
- Limits of this review: one verifier per card, no second independent pass.
