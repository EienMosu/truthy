# Summary

- IMPORTANT: The HTML guide pages (cloud.google.com/learn/certification/guides/...) are STALE (older versions: CDL 17/16/16/17/17/17 with 6.x/4.x sub-sections; ACE 5 sections 20/17.5/25/20/17.5). The current official guides are the PDFs linked from the certification pages, read first-hand from the downloaded PDFs. The section outlines below follow the PDFs.
- The CDL PDF footer dates this version to its launch on August 12, 2026 (7 pages), and the CDL certification page says the new version of the exam is live as of that date. Six sections, weights ~18/18/18/18/18/10 (sums to 100). The new version adds agentic AI, Gemini, AI Hypercomputer, Google Threat Intelligence, etc.
- ACE PDF has NO version/date stamp (5 pages, PDF title "Associate Cloud Engineer Exam Guide | English"). It is clearly newer than the HTML page (mentions Gemini CLI, Antigravity, Agent Runtime, Cloud Hub). Four sections ~20/30/30/20 (sums to 100). Exact publish date: unverified.
- Exam facts (cert pages, first-hand): CDL 90 min, 50-60 MC/MS, $99, 3 yrs, recommended "Experience collaborating with technical professionals". ACE 2 h, 50-60 MC/MS, $125, 3 yrs, recommended "6+ months hands-on experience with Google Cloud".
- Recommendation: Cloud Digital Leader. It is concepts/service-selection/business-value, so most bullets map to one stable verifiable fact per card. ACE is dominated by procedures (gcloud/console/kubectl: resize subnet, create MIG from template, snapshots schedule, log routers, WIF) which suit scenario questions and CLI-flag trivia, which dates fast and does not fit true/false cards. CDL is also the closer counterpart of AWS Certified Cloud Practitioner (CLF-C02): foundational, no hands-on prerequisite, business/value focus, covers cloud concepts, security, shared responsibility-type topics, cost. (CLF-C02 domain details are from my own knowledge, NOT fetched; unverified.)
- Caveats for card writing: CDL new guide has volatile product naming (Gemini Enterprise Agent Platform, "Agent Platform API", "Managed Service for Apache Spark", Cloud Run functions); verify names before cards. The new CDL guide dropped explicit mentions of e.g. Pub/Sub-only wording, Anthos, Customer Care, sustainability sections vs old HTML page; old HTML page still lists them, so do not use it. ACE alternative use: Section 2.2 / 4.x (storage classes, IAM role types) are the card-friendly parts only.
- Unverified: ACE guide publish date; a possible newer-than-PDF guide (cert pages did not mention one); the third-party claim that ACE moved to Pearson VUE on March 2, 2026 (not from official source, ignore).
- Sections A and B are short summaries in our own words of what each guide section covers. The guides are Google's; read the PDFs linked under Sources for the official wording.

# Sources (official)
- CDL cert page: https://cloud.google.com/learn/certification/cloud-digital-leader
- CDL current guide PDF (launched August 12, 2026): https://services.google.com/fh/files/misc/cloud_digital_leader_exam_guide_english.pdf
- CDL HTML guide (STALE, older version): https://cloud.google.com/learn/certification/guides/cloud-digital-leader
- ACE cert page: https://cloud.google.com/learn/certification/cloud-engineer
- ACE current guide PDF (no date stamp): https://services.google.com/fh/files/misc/associate_cloud_engineer_exam_guide_english.pdf
- ACE HTML guide (STALE, older 5-section version): https://cloud.google.com/learn/certification/guides/cloud-engineer
- ACE renewal guide (not opened): https://services.google.com/fh/files/misc/associate_cloud_engineer_renewal_exam_guide_english.pdf

# A. CLOUD DIGITAL LEADER (current PDF, launched August 12, 2026)
Official guide: https://services.google.com/fh/files/misc/cloud_digital_leader_exam_guide_english.pdf
In short: the candidate explains what Google Cloud's core products do and the business value and use cases they serve. The same guide covers the standard and the renewal exam.

## Section 1: Digital transformation with Google Cloud (~18%)
- 1.1 Why the cloud changes businesses: core terms (cloud, agentic AI, digital transformation, open source and open standards), the business benefits of the cloud, what drives transformation and what holds it back, and Google Cloud's differentiators (AI, openness, AI Hypercomputer, data platform, security, global network).
- 1.2 Cloud fundamentals: private, hybrid and multicloud architectures; networking basics (IP addresses, DNS, latency, bandwidth); regions, zones and edge locations; IaaS, PaaS and SaaS trade-offs.

## Section 2: Data transformation with Google Cloud (~18%)
- 2.1 Why data matters: databases vs warehouses vs lakes, kinds of data (first/second/third party; structured, semi-structured, unstructured), the stages data passes through, data governance, and openness as a way out of silos and lock-in.
- 2.2 Choosing a data product per use case (Cloud Storage, Spanner, Cloud SQL, AlloyDB, Bigtable, BigQuery, Firestore), relational vs non-relational and object storage terms, Cloud Storage classes and Autoclass, and database migration and modernization paths.
- 2.3 Analytics value: Looker and BigQuery for reporting and dashboards, why streaming analytics matters, and pipeline products (Pub/Sub, Dataflow, Managed Service for Apache Spark).

## Section 3: Innovating with Google Cloud AI (~18%)
- 3.1 AI and ML basics: definitions (AI, ML, generative AI, analytics, BI), agentic AI across industries, Google Cloud's AI strengths, the business problems ML solves, the data quality dimensions, and explainable and responsible AI.
- 3.2 Picking AI offerings: selection trade-offs, Gemini Enterprise Agent Platform, pre-trained APIs and models (Vision, Translation, Speech-to-Text, Gemini), custom models (Agent Studio, AutoML), AI Hypercomputer (GPUs, TPUs, open software, flexible consumption), and BigQuery ML with SQL.

## Section 4: Modernizing infrastructure and applications (~18%)
- 4.1 Migration and compute vocabulary: workloads, discovery and assessment, retire, retain, rehost, replatform, refactor, reimagine; VMs, containers, microservices, serverless, Spot VMs, Kubernetes, autoscaling, load balancing, managed services.
- 4.2 Business value of Compute Engine, modern application development, GKE and serverless (Cloud Run, Cloud Run functions), and products that run across hybrid and multicloud setups (AlloyDB Omni, BigQuery Omni, GKE Enterprise, Cloud SQL, Looker).
- 4.3 APIs: what an API is, new business from exposing and monetizing APIs, and Apigee API Management.

## Section 5: Trust and security with Google Cloud (~18%)
- 5.1 Security fundamentals: common threats (DDoS, ransomware, malware, phishing, misconfiguration, LLM attacks and more), cloud vs on-premises security, confidentiality, integrity and availability, key terms (least privilege, zero trust, encryption and more), encryption at rest, in transit and in use, authentication vs authorization vs auditing, and SecOps terms.
- 5.2 Google as part of the security team: securing the AI stack, Google Threat Intelligence and its sources (Google, Mandiant, VirusTotal), Security Command Center, Google Security Operations, secure-by-design infrastructure, AI security offerings (Model Armor, AI Protection), other security products (VPC, VPN, Interconnect, Cloud Armor, IAM, Sensitive Data Protection, Confidential Computing, Identity-Aware Proxy and more), and how Google earns trust (transparency, audits, sovereignty, data residency).

## Section 6: Scaling with Google Cloud operations (~10%)
- 6.1 Cost control: CapEx to OpEx and TCO, cloud financial governance, people, process and technology, the resource hierarchy and its benefits, and consumption controls (quotas, budgets, billing reports, Dynamic Workload Scheduler, Spot VMs).
- 6.2 Modern operations: Google Cloud Observability (Monitoring, Logging, Trace, Profiler, Error Reporting), reliability and availability terms, resilient design, the four golden signals, and DevOps and SRE concepts (SLIs, SLOs, SLAs).

CDL exam facts (cert page): 90 minutes, 50-60 multiple choice and multiple select, $99, English/Japanese/Spanish/Portuguese/French, valid 3 years, recommended experience "Experience collaborating with technical professionals". The page announces that the new version of the exam is live since August 12.
CDL change vs old HTML guide: old had 17/16/16/17/17/17 with sub-sections 4.1-4.6 (incl. Anthos, containers, serverless split) and 6.3 Sustainability, Customer Care; the new PDF has 3 sub-sections in section 4, no sustainability section, adds agentic AI, Gemini, AI Hypercomputer, Google Threat Intelligence, Security Command Center, Model Armor.

# B. ASSOCIATE CLOUD ENGINEER (current PDF, no date stamp)
Official guide: https://services.google.com/fh/files/misc/associate_cloud_engineer_exam_guide_english.pdf
In short: the candidate deploys, secures, monitors and maintains applications and infrastructure on Google Cloud across projects, using AI tooling for routine platform tasks.

## Section 1: Setting up a cloud solution environment (~20%)
- 1.1 Projects and accounts: resource hierarchy and organization policies, IAM roles, Cloud Identity users and groups, enabling APIs, Observability setup, quotas, standalone organizations, networking, regional availability, Cloud Asset Inventory with Gemini Cloud Assist, Workforce Identity Federation.
- 1.2 Billing: billing accounts, linking projects, budgets and alerts, billing exports.

## Section 2: Planning and implementing a cloud solution (~30%)
- 2.1 Compute: choosing between Compute Engine, GKE, Cloud Run, Cloud Run functions and Agent Runtime; launching instances; disk choices; autoscaled managed instance groups; OS Login and VM Manager; Spot VMs and custom machine types; kubectl; GKE cluster types and deployments; event-driven serverless deployments; GPUs vs TPUs.
- 2.2 Storage and data: choosing and deploying data products (Cloud SQL, BigQuery, Firestore, Spanner, Bigtable, AlloyDB, Dataflow, Pub/Sub, Managed Kafka, Memorystore) and storage products with their classes, loading data, multi-region redundancy.
- 2.3 Networking: VPCs and subnets (custom mode, Shared VPC, peering), firewall rules and Cloud NGFW policies with tags and service accounts, VPN, peering and Interconnect, load balancers, Network Service Tiers.
- 2.4 Tooling: infrastructure as code (Fabric FAST, Config Connector, Terraform, Helm) and AI-assisted planning (Gemini CLI, Antigravity, Gemini Cloud Assist, Application Design Center).

## Section 3: Ensuring the successful operation of a cloud solution (~30%)
- 3.1 Compute operations: connecting to and listing instances, snapshots and images, GKE inventory, node pools, Kubernetes resources and Pod autoscaling, Autopilot requests, Cloud Run releases, traffic splitting and autoscaling, attaching GPUs and TPUs, Agent Runtime deployments, Workbench notebooks, Cloud Workstations.
- 3.2 Storage and data operations: securing Cloud Storage objects and lifecycle rules, querying data products, cost estimates, backup and restore, job status, Database Center, CMEK.
- 3.3 Network operations: resizing subnets, static IP addresses, custom routes, Cloud DNS and Cloud NAT, firewall and NGFW policy management.
- 3.4 Monitoring and logging: alerts and custom metrics, audit and flow logs, log exports, buckets, analytics and routers, viewing logs, diagnostic tools (Trace, Profiler, Query Insights, index advisor), Personalized Service Health, Ops Agent, Managed Service for Prometheus, Gemini Cloud Assist, Active Assist, Cloud Hub.

## Section 4: Configuring access and security (~20%)
- 4.1 IAM: policies, role inheritance in the hierarchy, role types and custom roles.
- 4.2 Service accounts: creating and assigning them, least-privilege use in policies, impersonation, short-lived credentials, GKE workloads, Workload Identity Federation.

ACE exam facts (cert page): 2 hours, 50-60 multiple choice and multiple select, $125, English/Japanese/Spanish/Portuguese, valid 3 years, recommended "6+ months hands-on experience with Google Cloud", no prerequisites.
ACE change vs old HTML guide: old had 5 sections 20/17.5/25/20/17.5 (1 setup, 2 plan/configure, 3 deploy, 4 operate, 5 access/security with 5.1 IAM and 5.2 service accounts); new PDF merges plan+deploy into one 30% section, adds AI tooling and many new products.

# C. RECOMMENDATION
Pick Cloud Digital Leader.
1. Card fit: each CDL bullet is a concept or a product-to-use-case mapping ("Standard, Nearline, Coldline, Archive by access frequency", "BigQuery ML = ML via standard SQL", "IaaS/PaaS/SaaS shared responsibility", "SLI/SLO/SLA", "Cloud Armor = DDoS", "Looker = BI on BigQuery"). These are single, stable, checkable facts, ideal for true/false.
2. ACE is mostly procedure: roughly Sections 2.1, 2.3, 3.1, 3.3, 3.4 and 4.2 are "creating/configuring/deploying/resizing/attaching" tasks (kubectl, MIG from template, resizing a subnet's IPv4 range, log routers, impersonation, short-lived credentials). A true/false card on these either becomes CLI-flag trivia (changes with releases) or needs scenario context that does not fit one card. Only parts are card-friendly: Cloud Storage classes, Spot VMs, IAM role types, network service tiers, resource hierarchy.
3. Both guides churn on product names (Vertex AI Agent Engine renamed Agent Runtime on Gemini Enterprise Agent Platform; Anthos -> GKE Enterprise; Cloud Functions -> Cloud Run functions), but CDL stays at the product-purpose level where renames matter less; ACE ties facts to console/CLI behavior that changes faster.
4. Closest AWS Certified Cloud Practitioner counterpart: CDL. Both are foundational, no hands-on prerequisite (CDL recommended experience is "collaborating with technical professionals"; ACE says 6+ months hands-on, which matches AWS SAA-level associate more than CLF). Both CLF and CDL test cloud value, service-purpose mapping, security/shared responsibility and cost. (CLF-C02 domain structure is from my own knowledge, not fetched in this task: unverified.)
5. Suggested deck mapping for a ~12-card-per-section layout: CDL has 6 sections (1-6) with 17 sub-sections, so one section per guide section, or split sections 3.x, 5.x into two. ACE could be a later second deck limited to its card-friendly sub-sections.

# D. Unverified / caveats
- ACE PDF publication date and whether an even newer ACE guide exists: not stated on any official page opened.
- A third-party site claims ACE moved to Pearson VUE on March 2, 2026; not from an official source, not used.
- The two HTML guide pages were returned through a summarizing fetcher and are marked stale, not authoritative.
