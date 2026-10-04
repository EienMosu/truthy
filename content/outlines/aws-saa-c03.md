# Summary

- SAA-C03 is still the current code as of 2026-10-01. No SAA-C04 or retirement notice appeared on the certification page (aws.amazon.com/certification/certified-solutions-architect-associate/) or in an official-domain search. This is absence of evidence, not a positive statement from AWS; the search tool is US-only and WebFetch summarises pages via a small model.
- 4 domains, 14 task statements. The weightings and task wording below came from WebFetch of the five official docs.aws.amazon.com pages. I did not open the PDF, so the headings are exact but the bullets are fetched-and-summarised text.
- The exam has 65 questions (50 scored, 15 unscored), pass mark 720 of 1000, with compensatory scoring. Weightings are per domain only; the guide gives no per-task weights.
- Domain 1 has 3 tasks, Domain 2 has 2, Domain 3 has 5, Domain 4 has 4. Each "Knowledge of" and "Skills in" list is long, so the outline gives a depth note per task rather than a full dump. Fetch the page URL for the full bullets.
- The in-scope services appendix exists and I opened it. It has 16 categories and says the list is incomplete and may change.
- Unverified: the PDF version, the "Technologies and Concepts" page, the "Mentions of AWS Services" page and the out-of-scope page. I did not open any of them. Their URLs are inferred from the nav links on the main page and the filename pattern of the pages I did open.
- Gotcha for the card writer: Task 4.1 to 4.4 repeat the same cost-management bullets (Cost Explorer, Budgets, CUR, cost allocation tags), so cost-management cards belong in one place. Task 2.2 mentions "AWS Managed Services (AMS)" but gives Comprehend and Polly as examples, which are AI services. Treat that as official wording that card writers should not over-read.

# AWS Certified Solutions Architect - Associate (SAA-C03), official outline

Retrieved 2026-10-01 from docs.aws.amazon.com.

## Exam code status
- Main page title: "AWS Certified Solutions Architect - Associate (SAA-C03)". It describes the exam as a check of the candidate's ability to design solutions on the AWS Well-Architected Framework.
- The aws.amazon.com certification page also lists SAA-C03, with no replacement or retirement notice.
- Searching for SAA-C04 on aws.amazon.com and docs.aws.amazon.com found nothing. I found no replacement announcement (not proof that none exists).
- The exam guide has no revision date. The AWS blog post "Updated AWS Certified Solutions Architect - Associate" only came up as a search hit, and I did not open it.
- Exam format: 65 questions, 130 min, 150 USD, multiple choice or multiple response. 50 are scored and 15 unscored. Minimum passing score is 720 on a 100-1000 scale.
- The guide warns that its list of exam content is not complete.

## Source pages (opened first-hand via WebFetch)
- Main guide: https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html
- Domain 1: https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain1.html
- Domain 2: https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain2.html
- Domain 3: https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain3.html
- Domain 4: https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain4.html
- Certification landing page: https://aws.amazon.com/certification/certified-solutions-architect-associate/
- Full guide PDF (surfaced by search, not opened): https://docs.aws.amazon.com/pdfs/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.pdf

## Domain 1: Design Secure Architectures (30% of scored content)
URL: .../solutions-architect-associate-03-domain1.html

**Task 1.1: Design secure access to AWS resources**
- Knowledge covers: multi-account access control, federation and identity services (IAM, IAM Identity Center), global infrastructure, least privilege, shared responsibility model.
- Skills cover: MFA on root and IAM users; IAM users, groups, roles and policies; RBAC with STS, role switching and cross-account access; multi-account strategy (Control Tower, SCPs); resource policies; when to federate a directory service with IAM roles.
- Depth: scenario-level "which mechanism fits" decisions, not IAM policy syntax.

**Task 1.2: Design secure workloads and applications**
- Knowledge covers: application configuration and credentials security, service endpoints, ports, protocols and traffic control, secure application access, security services and their use cases (Cognito, GuardDuty, Macie), external threat vectors (DDoS, SQL injection).
- Skills cover: VPC security components (security groups, route tables, NACLs, NAT gateways); public vs private subnet segmentation; integrating Shield, WAF, IAM Identity Center and Secrets Manager; securing external connections (VPN, Direct Connect).
- Depth: match a threat or requirement to the service or VPC construct.

**Task 1.3: Determine appropriate data security controls**
- Knowledge covers: data access and governance, data recovery, retention and classification, encryption and key management.
- Skills cover: compliance alignment; encryption at rest (KMS) and in transit (ACM with TLS); key access policies; backups and replication; access, lifecycle and protection policies; key rotation and certificate renewal.
- Depth: choose and configure controls, with KMS key policy and rotation behaviour at the core.

## Domain 2: Design Resilient Architectures (26% of scored content)
URL: .../solutions-architect-associate-03-domain2.html

**Task 2.1: Design scalable and loosely coupled architectures**
- Knowledge covers a long list: API Gateway and REST APIs, managed services (Transfer Family, SQS, Secrets Manager), caching, stateless vs stateful microservices, event-driven design, horizontal vs vertical scaling, CDN and edge accelerators, migrating apps into containers, ALB, multi-tier, pub/sub, serverless (Fargate, Lambda), object/file/block storage, ECS/EKS, read replicas, Step Functions.
- Skills cover: designing event-driven, microservice or multi-tier systems; scaling strategy; choosing services for loose coupling; when to use containers or serverless; recommending compute, storage, network and database options; using purpose-built services.
- Depth: pattern selection ("what decouples this?").

**Task 2.2: Design highly available and/or fault-tolerant architectures**
- Knowledge covers: Regions, AZs and Route 53; managed AI services (Comprehend, Polly) listed under "AWS Managed Services (AMS)"; route tables; DR strategies (backup and restore, pilot light, warm standby, active-active, RPO, RTO); distributed design patterns; failover; immutable infrastructure; ALB; RDS Proxy; service quotas and throttling in standby environments; storage durability and replication; X-Ray visibility.
- Skills cover: automation for infrastructure integrity; multi-AZ and multi-Region service choice; HA metrics from business requirements; removing single points of failure; durability and availability of data; picking a DR strategy; improving reliability of legacy apps that cannot change.
- Depth: DR strategy vs RPO/RTO is the best-defined, most testable area here.

## Domain 3: Design High-Performing Architectures (24% of scored content)
URL: .../solutions-architect-associate-03-domain3.html

**Task 3.1: Determine high-performing and/or scalable storage solutions**
- Knowledge covers: hybrid storage, S3/EFS/EBS use cases, object vs file vs block characteristics.
- Skills cover: storage and configurations that meet performance demands; storage that scales for future needs.
- Depth: short lists, so a service-selection comparison.

**Task 3.2: Design high-performing and elastic compute solutions**
- Knowledge covers: compute services and use cases (Batch, EMR, Fargate), distributed computing with edge services, queuing and pub/sub, scalability (EC2 Auto Scaling, AWS Auto Scaling), serverless (Lambda, Fargate), ECS/EKS.
- Skills cover: decoupling so components scale independently; scaling metrics and conditions; compute options and EC2 instance types; resource type and size (for example Lambda memory).
- Depth: sizing and scaling-trigger decisions.

**Task 3.3: Determine high-performing database solutions**
- Knowledge covers: global infrastructure, caching (ElastiCache), read- vs write-intensive access patterns, capacity planning (capacity units, instance types, Provisioned IOPS), connections and proxies, engine use cases (heterogeneous and homogeneous migration), replication and read replicas, database types (serverless, relational, non-relational, in-memory).
- Skills cover: configuring read replicas; designing database architectures; choosing an engine (MySQL vs PostgreSQL); choosing a type (Aurora vs DynamoDB); integrating caching.
- Depth: matching engine and type to access pattern.

**Task 3.4: Determine high-performing and/or scalable network architectures**
- Knowledge covers: edge services (CloudFront, Global Accelerator), network design (subnet tiers, routing, IP addressing), ALB, connection options (VPN, Direct Connect, PrivateLink).
- Skills cover: topologies for global, hybrid and multi-tier; scalable network configurations; resource placement; load balancing strategy.
- Depth: pick the connectivity or edge service for a scenario.

**Task 3.5: Determine high-performing data ingestion and transformation solutions**
- Knowledge covers: analytics and visualisation (Athena, Lake Formation, Amazon Quick), ingestion patterns and frequency, transfer services (DataSync, Storage Gateway), transformation (Glue), securing ingestion points, sizes and speeds, streaming (Kinesis).
- Skills cover: building and securing data lakes; streaming architectures; data transfer solutions; visualisation strategies; EMR for processing; ingestion configuration; format conversion such as .csv to .parquet.
- Depth: service-per-stage mapping of the data pipeline.

## Domain 4: Design Cost-Optimized Architectures (20% of scored content)
URL: .../solutions-architect-associate-03-domain4.html

**Task 4.1: Design cost-optimized storage solutions**
- Knowledge covers: Requester Pays buckets; cost allocation tags and multi-account billing; Cost Explorer, Budgets, CUR; FSx, EFS, S3, EBS; backup strategies; HDD vs SSD volume types; data lifecycles; hybrid options (DataSync, Transfer Family, Storage Gateway); access patterns; cold tiering.
- Skills cover: batch vs individual S3 uploads; right-sizing storage; lowest-cost transfer method; storage auto scaling; S3 lifecycle management; backup and archival choice; migration service choice; tier choice; most cost-effective storage service.
- Depth: tier and lifecycle trade-offs, with cost framing.

**Task 4.2: Design cost-optimized compute solutions**
- Knowledge covers: cost tools (same bullets as 4.1); global infrastructure; purchasing options (Spot, Reserved, Savings Plans); edge processing; Outposts; instance types, families and sizes; utilisation optimisation (containers, serverless, microservices); scaling strategies (auto scaling, hibernation).
- Skills cover: ALB (L7) vs NLB (L4) vs GWLB; horizontal vs vertical scaling and EC2 hibernation; Lambda vs EC2 vs Fargate; availability required for production vs non-production; instance family and size.
- Depth: purchasing-option and instance-family selection.

**Task 4.3: Design cost-optimized database solutions**
- Knowledge covers: cost tools (same as above); caching; data retention policies; capacity units; connections and proxies; engine use cases; replication; database types (Aurora, DynamoDB, relational vs non-relational).
- Skills cover: backup and retention policy design (snapshot frequency); engine choice; DynamoDB vs RDS vs serverless; time-series and columnar formats; migrating schemas and data across locations and engines.
- Depth: cheapest adequate database, plus migration.

**Task 4.4: Design cost-optimized network architectures**
- Knowledge covers: cost tools (same as above); load balancing; NAT instance vs NAT gateway costs; private lines, dedicated lines and VPNs; Transit Gateway and VPC peering; DNS.
- Skills cover: shared NAT gateway vs one per AZ; Direct Connect vs VPN vs internet; routes that minimise transfer cost (Region to Region, AZ to AZ, Global Accelerator, VPC endpoints); CDN and edge caching; reviewing workloads for optimisation; throttling strategy; bandwidth allocation (single vs multiple VPNs, Direct Connect speed).
- Depth: data-transfer cost reasoning.

## Service references
- In-Scope AWS Services (opened first-hand): https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/saa-03-in-scope-services.html
  - The intro says the list is incomplete and may change.
  - 16 categories: Analytics, Application Integration, AWS Cost Management, Compute, Containers, Database, Developer Tools, Front-End Web and Mobile, Machine Learning, Management and Governance, Media Services, Migration and Transfer, Networking and Content Delivery, Security Identity and Compliance, Serverless, Storage.
- Linked from the main page's nav list but NOT opened (URLs inferred from the main page's relative links and the filename pattern of the pages I opened, unverified):
  - Technologies and Concepts: https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/saa-technologies-concepts.html (the search tool also returned this exact URL)
  - Mentions of AWS Services on the Exam: .../saa-service-mentions.html
  - Out-of-Scope AWS Services: .../saa-03-out-of-scope-services.html

## Unverified
- Whether AWS has announced a successor exam outside the pages checked.
- The PDF contents.
- The three service-reference pages listed above (not opened).
- Exact bullet text beyond what WebFetch returned. The headings, domain weightings and task titles are exact.