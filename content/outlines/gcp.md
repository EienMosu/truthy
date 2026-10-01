# Summary

- IMPORTANT: The HTML guide pages (cloud.google.com/learn/certification/guides/...) are STALE (older versions: CDL 17/16/16/17/17/17 with 6.x/4.x sub-sections; ACE 5 sections 20/17.5/25/20/17.5). The current official guides are the PDFs linked from the certification pages, read first-hand by extracting text from the downloaded PDFs. Section outlines below are from the PDFs.
- CDL PDF footer: "Cloud Digital Leader exam guide - launched on August 12, 2026" (7 pages). The CDL cert page says: "As of August 12, the new version of the exam is now live. See the exam guide for topics that may be assessed." Six sections, weights ~18/18/18/18/18/10 (sums to 100). New version adds agentic AI, Gemini, AI Hypercomputer, Google Threat Intelligence, etc.
- ACE PDF has NO version/date stamp (5 pages, PDF title "Associate Cloud Engineer Exam Guide | English"). It is clearly newer than the HTML page (mentions Gemini CLI, Antigravity, Agent Runtime, Cloud Hub). Four sections ~20/30/30/20 (sums to 100). Exact publish date: unverified.
- Exam facts (cert pages, first-hand): CDL 90 min, 50-60 MC/MS, $99, 3 yrs, recommended "Experience collaborating with technical professionals". ACE 2 h, 50-60 MC/MS, $125, 3 yrs, recommended "6+ months hands-on experience with Google Cloud".
- Recommendation: Cloud Digital Leader. It is concepts/service-selection/business-value, so most bullets map to one stable verifiable fact per card. ACE is dominated by procedures (gcloud/console/kubectl: resize subnet, create MIG from template, snapshots schedule, log routers, WIF) which suit scenario questions and CLI-flag trivia, which dates fast and does not fit true/false cards. CDL is also the closer counterpart of AWS Certified Cloud Practitioner (CLF-C02): foundational, no hands-on prerequisite, business/value focus, covers cloud concepts, security, shared responsibility-type topics, cost. (CLF-C02 domain details are from my own knowledge, NOT fetched; unverified.)
- Caveats for card writing: CDL new guide has volatile product naming (Gemini Enterprise Agent Platform, "Agent Platform API", "Managed Service for Apache Spark", Cloud Run functions); verify names before cards. The new CDL guide dropped explicit mentions of e.g. Pub/Sub-only wording, Anthos, Customer Care, sustainability sections vs old HTML page; old HTML page still lists them, so do not use it. ACE alternative use: Section 2.2 / 4.x (storage classes, IAM role types) are the card-friendly parts only.
- Unverified: ACE guide publish date; a possible newer-than-PDF guide (cert pages did not mention one); the third-party claim that ACE moved to Pearson VUE on March 2, 2026 (not from official source, ignore). Fetch tool paraphrased the HTML pages; PDFs were read via pdftotext, so wording below is exact from PDF.

# Sources (official)
- CDL cert page: https://cloud.google.com/learn/certification/cloud-digital-leader
- CDL current guide PDF (footer "launched on August 12, 2026"): https://services.google.com/fh/files/misc/cloud_digital_leader_exam_guide_english.pdf
- CDL HTML guide (STALE, older version): https://cloud.google.com/learn/certification/guides/cloud-digital-leader
- ACE cert page: https://cloud.google.com/learn/certification/cloud-engineer
- ACE current guide PDF (no date stamp): https://services.google.com/fh/files/misc/associate_cloud_engineer_exam_guide_english.pdf
- ACE HTML guide (STALE, older 5-section version): https://cloud.google.com/learn/certification/guides/cloud-engineer
- ACE renewal guide (not opened): https://services.google.com/fh/files/misc/associate_cloud_engineer_renewal_exam_guide_english.pdf

# A. CLOUD DIGITAL LEADER (current PDF, launched August 12, 2026)
Overview: "A Cloud Digital Leader can articulate the capabilities of Google Cloud core products and services and how they benefit organizations. They can also describe common business use cases and how cloud solutions support an enterprise."
Note: "This exam guide outlines the topics that may appear on both the standard and renewal exams."

## Section 1: Digital Transformation with Google Cloud (~18% of the exam)
1.1 Explain why and how the cloud is revolutionizing businesses. Considerations include:
- Define the terms: cloud, agentic AI, infrastructure, digital transformation, open source, open standard.
- Explain the benefits of cloud technology to a business' digital transformation (e.g., scalability, cost-effectiveness, agility, speed, flexibility, enhanced security, global reach and high availability, data-driven insights, strategic value and focus).
- Describe the primary drivers that compel organizations to pursue digital transformation and the significant challenges they face (i.e., factors that motivate organizations to transform, common hurdles that can affect transformation, implications and risks of not adopting cloud).
- Recognize some of Google Cloud's top differentiators (e.g., world-leading AI, deep commitment to openness and interoperability, AI Hypercomputer, AI-ready data platform, security, global network).
1.2 Describe fundamental cloud concepts. Considerations include:
- Identify the corresponding business use case and benefits of various cloud architectures (e.g., private cloud, hybrid cloud, multicloud).
- Define fundamental networking concepts and describe how Google Cloud's global network infrastructure supports digital transformation (e.g., IP address, domain name service (DNS), basic IP addresses, latency, bandwidth).
- Describe the components of Google Cloud's network and explain how they work together (e.g., regions, zones, edge locations).
- Describe the benefits and tradeoffs of different cloud service models: Infrastructure as a Service (IaaS), Platform as a Service (PaaS), and Software as a Service (SaaS)

## Section 2: Exploring Data Transformation with Google Cloud (~18% of the exam)
2.1 Describe the intrinsic role that data plays in an organization's digital transformation. Considerations include:
- Explain why data is valuable (e.g., generating real-time business insights, identifying trends, informing strategic decision making, fueling AI).
- Differentiate between databases, data warehouses, and data lakes.
- Recognize types of data (e.g., first-party, second-party, third-party, structured, unstructured, semi-structured).
- Describe an organization's data supply chain (e.g., data genesis, data collection, data processing, data storage, data analysis, data activation).
- Describe the data governance process and why it's important.
- Explain why openness and interoperability with data management platforms are critical for eliminating data silos and avoiding vendor lock-in.
2.2 Determine which Google Cloud data management products are applicable to different business use cases. Considerations include:
- Determine which Google Cloud data management offering is best for each business use case (e.g., Cloud Storage, Spanner, Cloud SQL, AlloyDB, Bigtable, BigQuery, Firestore).
- Define key data management concepts and terms (e.g., relational, non-relational, object storage, structured query language [SQL], NoSQL).
- Differentiate between storage classes in Cloud Storage regarding cost and frequency of access (e.g., Standard, Nearline, Coldline, Archive, Autoclass).
- Describe the ways that an organization can migrate or modernize their current database in the cloud.
2.3 Discuss how smart analytics, business intelligence tools, and streaming analytics can add value in different business use cases. Considerations include:
- Describe how Looker democratizes access to data.
- Recognize the value of analyzing and visualizing data from BigQuery in Looker to create real-time reports, dashboards, and integrating data into workflows.
- Explain why real-time streaming analytics is critical for modern businesses.
- Describe the main Google Cloud products that modernize data pipelines (e.g., Pub/Sub, Dataflow, Managed Service for Apache Spark).

## Section 3: Innovating with Google Cloud Artificial Intelligence (~18% of the exam)
3.1 Describe fundamental AI and ML concepts and how they create business value. Considerations include:
- Recognize the definition of artificial intelligence (AI), machine learning (ML), generative AI (gen AI), data analytics, and business intelligence.
- Recognize some of the ways agentic AI is fundamentally reshaping different industries and the way people work (e.g., workforce productivity, customer support, sales experiences, product innovation, operations, research).
- Recognize the key benefits of Google Cloud's AI offerings (e.g., best infrastructure for AI, AI-ready data cloud, sophisticated 1P models, all-in-one AI developer platform, pre-built AI agents and applications).
- Identify the business problems that ML can solve, and describe key use cases and the business value that ML provides (e.g., replacing or simplifying rule-based systems, deriving business insights from large datasets [structured and unstructured], scaling business decisions).
- Explain why high-quality, accurate data is essential for successful AI models and identify the main dimensions of data quality (e.g., completeness, uniqueness, timeliness, validity, accuracy, consistency).
- Describe the business implications of explainable and responsible AI in AI systems.
3.2 Explain how Google Cloud's AI offerings can create business value. Considerations include:
- Describe the strategic considerations that organizations must make when selecting Google Cloud AI solutions (e.g., implementation speed, development effort, potential for business differentiation, technical expertise requirements, choice and flexibility).
- Describe the functionality of Gemini Enterprise Agent Platform and identify potential business use cases.
- Match the Google Cloud pre-trained API and foundation model to various business use cases (e.g., Agent Platform API, Vision API, Cloud Translation API, Speech-to-Text API, Gemini).
- Explain how an organization can build custom models using their own data to create business value (e.g., Agent Studio on Agent Platform, AutoML on Agent Platform).
- Recognize the core components of Google Cloud's AI Hypercomputer and how organizations benefit by gaining improved performance and efficiency for AI workloads (e.g., GPUs and TPUs, industry-leading software and open standards, cost control with flexible consumption models).
- Discuss how BigQuery ML lets users create and execute machine learning models in BigQuery by using standard SQL queries and flexibility to experiment with data.

## Section 4: Modernize Infrastructure and Applications with Google Cloud (~18% of the exam)
4.1 Describe how Google Cloud helps organizations transition to the cloud. Considerations include:
- Define fundamental cloud migration terms (e.g., workload, discovery and assessment, retire, retain, rehost [lift and shift], replatform [move and improve], refactor; reimagine).
- Define the fundamental cloud compute terms (e.g., virtual machines (VMs), containerization and containers, applications and microservices, serverless computing, spot VMs, Kubernetes, autoscaling and load balancing, managed services).
4.2 Describe the functionality, business use cases, and business value of Google Cloud's infrastructure offerings. Considerations include:
- Discuss the business value of using Compute Engine to create and run virtual machines on Google's infrastructure.
- Describe the business value of modern application development (e.g., flexible architectures like microservices, accelerated deployment processes through managed services, cost optimization, enhanced scalability and resilience, improved operational efficiency).
- Describe the business value of using GKE to deploy and manage containers.
- Describe the business value of using serverless computing Google Cloud products (e.g., Cloud Run; Cloud Run functions).
- Recognize the Google Cloud products that are supported on multicloud and hybrid cloud environments (e.g., AlloyDB Omni, BigQuery Omni, GKE Enterprise, Cloud SQL, Looker).
4.3 Describe the business value of application programming interfaces (APIs). Considerations include:
- Define application programming interface (API).
- Describe how organizations can create new business opportunities by exposing and monetizing public-facing APIs.
- Describe the business value of using Apigee API Management.

## Section 5: Trust and Security with Google Cloud (~18% of the exam)
5.1 Describe fundamental cloud security concepts. Considerations include:
- Describe relevant cybersecurity threats and business implications (e.g., DDoS, ransomware, cryptomining, malware, viruses, phishing, misconfiguration, unsecured third party systems, physical damage, LLM attacks).
- Differentiate between cloud security and on-premises security.
- Describe the importance of control, compliance, confidentiality, integrity, and availability in a cloud security model.
- Define key security terms and concepts (e.g., data loss prevention, privileged access, least privilege, zero-trust architecture, security by default, security posture, cyber resilience, firewall, encryption, decryption).
- Explain how encryption safeguards an organization's data in different usage states (e.g., in use, in transit, at rest).
- Differentiate between authentication, authorization, and auditing (e.g., multi-factor authentication, two-step verification [2SV], IAM).
- Define the fundamental cloud security operations (SecOps) terms (e.g., security posture, threat intelligence, threat response).
5.2 Describe the business value of making Google part of an organization's security team with its defense-in-depth, multilayered approach to cloud security. Considerations include:
- Recognize how Google Cloud secures every layer of the AI stack (e.g., infrastructure, data, models, platform, agents).
- Recognize how Google Threat Intelligence provides organizations with proactive insights into cyber threats and identify the unique sources that power its analysis (e.g., Google's vast global visibility, Mandiant's frontline incident response expertise, VirusTotal's crowd sourced threat detection).
- Recognize the benefits of Security Command Center to proactively discover, prioritize, and remediate security risks and misconfigurations across the Google Cloud environment.
- Recognize the benefits of using a unified security operations platform, like Google Security Operations, to ingest telemetry and accelerate threat detection and response.
- Recognize the benefits of Google's secure-by-design cloud platform (e.g., core infrastructure, proprietary data centers, purpose-built servers and networking, custom security hardware and software).
- Recognize the functionality, business value, and use cases for Google Cloud's AI-assisted and AI-focused security offerings (e.g., Gemini in Google Security Operations, AI Protection, Model Armor).
- Recognize the functionality, use cases, and business value of Google's other security offerings (e.g., Cloud VPC, Cloud VPN, Cloud Interconnect, firewalls, Cloud Armor, Cloud Logging, IAM, Sensitive Data Protection, Confidential Computing, Certificate Manager, Identity-Aware Proxy).
- Describe how Google Cloud earns and maintains customer trust in the cloud (e.g., transparency reports, third-party audits, digital sovereignty, data residency, compliance resource manager).

## Section 6: Scaling with Google Cloud Operations (~10% of the exam)
6.1 Recognize how Google Cloud supports an organization's ability to control their cloud costs. Considerations include:
- Explain how an organization's transition from an on-premises environment to the cloud shifts their capital expenditures (CapEx) to operational expenditures (OpEx), and how that affects their total cost of ownership (TCO).
- Describe Google-recommended practices for cloud financial governance (e.g., identify who manages cloud costs, Google Cloud's cost management tools).
- Recognize the role of people, process, and technology in controlling cloud costs.
- Recognize the components of Google Cloud's resource hierarchy (e.g., resources, projects, folders, organization node) and the benefits (e.g., access control, inheritance and propagation rules, security and compliance, visibility and auditing capabilities).
- Recognize how to control cloud consumption (e.g., resource quota policies, budget threshold rules, Cloud Billing reports, Dynamic Workload Scheduler, Spot VMs).
6.2 Describe the fundamental concepts of modern operations, reliability, and resilience in the cloud. Considerations include:
- Describe how to modernize operations by using Google Cloud's Observability (e.g., operations suite, Cloud Monitoring, Cloud Logging, Cloud Trace, Cloud Profiler, Error Reporting).
- Recognize the fundamental cloud operations terms (e.g., operational excellence, reliability, high availability).
- Recognize how to design resilient infrastructure and processes (e.g., redundancy, replication, scalable infrastructure, backups).
- Recognize how a system's performance and reliability are measured (e.g., latency, traffic, saturation, errors).
- Recognize fundamental concepts of DevOps and Site Reliability Engineering (e.g., service level indicators, service level objectives, service level agreements).

CDL exam facts (cert page): 90 minutes, 50-60 multiple choice and multiple select, $99, English/Japanese/Spanish/Portuguese/French, valid 3 years, recommended experience "Experience collaborating with technical professionals". Banner: "As of August 12, the new version of the exam is now live."
CDL change vs old HTML guide: old had 17/16/16/17/17/17 with sub-sections 4.1-4.6 (incl. Anthos, containers, serverless split) and 6.3 Sustainability, Customer Care; the new PDF has 3 sub-sections in section 4, no sustainability section, adds agentic AI, Gemini, AI Hypercomputer, Google Threat Intelligence, Security Command Center, Model Armor.

# B. ASSOCIATE CLOUD ENGINEER (current PDF, no date stamp)
Overview: "An Associate Cloud Engineer deploys and secures applications, services, and infrastructure, monitors the operations of multiple projects, and maintains enterprise solutions to meet target performance metrics. This individual has experience working with public clouds or on-premises solutions. They are able to perform common platform-based tasks, supported by AI tooling, to maintain and scale one or more deployed solutions that leverage Google-managed or self-managed services on Google Cloud."

## Section 1: Setting up a cloud solution environment (~20% of the exam)
1.1 Setting up cloud projects and accounts. Considerations include:
- Creating a resource hierarchy
- Applying organizational policies to the resource hierarchy
- Granting members Identity and Access Management (IAM) roles within a project
- Managing users and groups in Cloud Identity (manually and automated)
- Enabling APIs within projects
- Provisioning and setting up products in Google Cloud Observability
- Assessing quotas and requesting increases
- Setting up standalone organizations
- Setting up cloud networking
- Verifying product availability across geographical locations (e.g., regions, zones)
- Configuring Cloud Asset Inventory and using Gemini Cloud Assist to analyze resources
- Configuring Workforce Identity Federation
1.2 Managing billing configuration. Considerations include:
- Creating one or more billing accounts
- Linking projects to a billing account
- Establishing billing budgets and alerts
- Setting up billing exports

## Section 2: Planning and implementing a cloud solution (~30% of the exam)
2.1 Planning and implementing compute resources. Considerations include:
- Selecting appropriate compute choices for a given workload (e.g., Compute Engine, Google Kubernetes Engine [GKE], Cloud Run, Cloud Run functions, Agent Runtime on Gemini Enterprise Agent Platform [formerly Vertex AI Agent Engine])
- Launching a compute instance (e.g., availability policy, SSH keys)
- Choosing the appropriate storage for Compute Engine (e.g., zonal Persistent Disk, regional Persistent Disk, Google Cloud Hyperdisk)
- Creating an autoscaled managed instance group by using an instance template
- Configuring OS Login
- Configuring VM Manager
- Using Spot VM instances and custom machine types
- Installing and configuring the command-line interface (CLI) for Kubernetes (kubectl)
- Deploying a GKE cluster with different configurations (e.g., GKE Autopilot, regional clusters, private clusters)
- Deploying a containerized application to GKE
- Deploying an application to serverless compute platforms, including for the processing of Google Cloud events (e.g., Pub/Sub events, Cloud Storage object change notification events, Eventarc)
- Identifying whether to use GPUs or TPUs
2.2 Planning and implementing storage and data solutions. Considerations include:
- Choosing and deploying data products (e.g., Cloud SQL, BigQuery, Firestore, Spanner, Bigtable, AlloyDB, Dataflow, Pub/Sub, Google Cloud Managed Service for Apache Kafka, Memorystore)
- Choosing and deploying storage products (e.g., Cloud Storage, Filestore, Google Cloud NetApp Volumes, Google Cloud Managed Lustre) and Cloud Storage options (e.g., Standard, Nearline, Coldline, Archive)
- Loading data (e.g., command-line upload, load data from Cloud Storage, Storage Transfer Service)
- Maintaining multi-region redundancy across data solutions
2.3 Planning and implementing networking resources. Considerations include:
- Creating a VPC with subnets (e.g., custom mode VPC, Shared VPC, VPC Network Peering)
- Creating and applying VPC firewalls rules and Cloud Next Generation Firewall (Cloud NGFW) policies with ingress and egress rules and attributes (e.g., action, source, destination, targets, protocols, ports)
- Using Tags (e.g., secure Tags) and service accounts in Cloud NGFW policy rules
- Establishing network connectivity (e.g., Cloud VPN, VPC Network Peering, Cloud Interconnect)
- Choosing and deploying load balancers
- Differentiating Network Service Tiers
2.4 Planning and implementing resources using tooling. Considerations include:
- Infrastructure as Code tooling (e.g., Fabric FAST, Config Connector, Terraform, Helm)
- AI-assisted planning and implementation (e.g., Gemini CLI, Google Antigravity, Gemini Cloud Assist, Application Design Center)

## Section 3: Ensuring the successful operation of a cloud solution (~30% of the exam)
3.1 Managing compute resources. Considerations include:
- Remotely connecting to a Compute Engine instance
- Viewing current running Compute Engine instances
- Working with snapshots and images (e.g., create, view, and delete images or snapshots; schedule a snapshot)
- Viewing current running GKE cluster inventory (e.g., nodes, Pods, Services)
- Configuring GKE to access Artifact Registry
- Working with GKE node pools (e.g., add, edit, or remove a node pool; autoscaling node pool)
- Working with Kubernetes resources (e.g., Pods, Services, StatefulSets)
- Managing horizontal and vertical Pod autoscaling configurations
- Managing GKE Autopilot Pod resource requests
- Deploying new versions of a Cloud Run application
- Adjusting application traffic splitting parameters (e.g., Cloud Run, Cloud Run functions, GKE)
- Configuring autoscaling for a Cloud Run application
- Attaching GPUs and TPUs
- Deploying an agent to Agent Runtime on Gemini Enterprise Agent Platform (formerly Vertex AI Agent Engine)
- Managing notebooks in Gemini Enterprise Agent Platform Workbench (formerly Vertex AI Workbench) and BigQuery
- Managing developer environments (e.g., Cloud Workstations)
3.2 Managing storage and data solutions. Considerations include:
- Managing and securing objects in Cloud Storage buckets
- Setting object lifecycle management policies for Cloud Storage buckets
- Executing queries to retrieve data from data instances (e.g., Cloud SQL, BigQuery, Bigtable, Spanner, Firestore, AlloyDB)
- Estimating costs of data storage resources
- Backing up and restoring database instances (e.g., Cloud SQL, Firestore, Spanner, AlloyDB, Bigtable)
- Reviewing job status (e.g., Dataflow, BigQuery)
- Using Database Center to manage the Google Cloud database fleet
- Configuring customer-managed encryption keys (CMEK)
3.3 Managing networking resources. Considerations include:
- Resizing a subnet's IPv4 address range
- Reserving static external or internal IP addresses
- Adding custom static routes in a VPC
- Using Cloud DNS and Cloud NAT
- Managing VPC firewall rules and Cloud NGFW policies
3.4 Monitoring and logging. Considerations include:
- Creating Cloud Monitoring alerts based on resource metrics
- Creating and ingesting Cloud Monitoring custom metrics (e.g., from applications or logs)
- Configuring audit logs (e.g., VPC Flow Logs, audit logs, firewall logs)
- Exporting logs to external systems (e.g., on-premises, BigQuery)
- Configuring log buckets, log analytics, and log routers
- Viewing and filtering logs in Cloud Logging
- Viewing specific log message details in Cloud Logging
- Using cloud diagnostic tools (e.g., Cloud Trace, Cloud Profiler, Query Insights, index advisor) to investigate an application issue
- Viewing the Personalized Service Health dashboard
- Configuring and deploying Ops Agent
- Deploying Google Cloud Managed Service for Prometheus
- Using Gemini Cloud Assist for Cloud Monitoring
- Using Active Assist to optimize resource utilization
- Using Cloud Hub to monitor active events and application health data

## Section 4: Configuring access and security (~20% of the exam)
4.1 Managing IAM. Considerations include:
- Viewing and creating IAM policies
- Attaching roles and policy inheritance in the Organization hierarchy
- Managing the various role types and defining custom IAM roles
4.2 Managing service accounts. Considerations include:
- Creating service accounts, including Google-managed service accounts
- Using service accounts in IAM policies with minimum permissions
- Assigning service accounts to resources
- Managing IAM permissions of a service account
- Managing service account impersonation
- Creating and managing short-lived service account credentials
- Using a Google Cloud service account with a GKE application
- Provisioning Workload Identity Federation

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
- WebFetch refused to reproduce the PDFs verbatim; wording above was extracted locally with pdftotext from the saved PDFs (exact). The two HTML guide pages were returned through a summarizing fetcher and are marked stale, not authoritative.
- Local PDF copies: <session tool-results>/webfetch-1790817030759-mknn9k.pdf (CDL) and webfetch-1790817030729-dv8ur1.pdf (ACE) in the same folder.