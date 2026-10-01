"""Generates the single-chat (v2) card generation prompts: one ready-to-paste file per deck.

Usage: python3 build_v2.py
Protocol: paste the file into a fresh chat (web browsing on). The model answers with batch b1.
Send `next` for each following batch. Save every JSON answer to content/raw/.
"""
import pathlib

MASTER = '''You are writing content for "Truthy", a mobile true/false card game that teaches IT knowledge. The player sees one statement, answers True or False, then reads a short explanation. A wrong fact in this game teaches people something false, so accuracy matters more than volume.

DECK
{deck_brief}

SECTIONS ({cards_per_section} cards each, {total} cards in total)
{sections}

BATCHES
{batches}

HOW THIS CHAT WORKS
This whole deck is produced in this one chat, one batch per answer, so that you can see every card you have already written and never test the same fact twice.
- In this first answer: do STEP 1 and STEP 2 for the whole deck, then write batch b1.
- Each time I send `next`, write the following batch. Before writing it, reread the RULES below and the plan, and check the new cards against every card already written in this chat.
- After the last batch, if I send `next` again, answer only with DONE.
- Every answer is a single JSON code block and nothing else.

STEP 1. Check the source of truth
{source_step}

STEP 2. Plan the whole deck before writing any card
For every section, list the {cards_per_section} facts its cards will test, each as a short factKey (kebab-case, for example "ebs-volume-single-az"). The plan must satisfy:
- A factKey appears once in the whole deck. Two cards rest on the same fact if knowing one answer gives you the other, even when one is true and the other false, or when they are worded differently.
- No mirrored pairs (service A wrongly given B's job in one card, and B wrongly given A's job in another). Pick one side.
- No repeated distractor template. If one card is false because "X is described as a firewall", no other card may use that same trick with a different X.
- The facts of a section cover its breadth, not one sub-topic twelve times.
- Half of each section's cards are true and half are false.
Put the plan in the "plan" field of batch b1. In later batches you may deviate from the plan only to fix a problem, and then say so in "notes".

RULES FOR THE STATEMENT
- Original wording. Do not copy or paraphrase practice exams, exam dumps or course material.
- One fact per statement. No compound statements where one half is true and the other false.
- Maximum 120 characters. Plain declarative sentence, present tense.
- No negations ("is not", "cannot", "never", "without") in the statement.
- No absolutes ("always", "all", "only", "every", "must") unless the official source states it that way.
- Use official product and API names exactly as the official source writes them today.
- A false statement is false for exactly one clear reason, and that reason is a realistic misconception a learner who studied could hold. Never make a statement false through trick wording, spelling or a changed number.
- No strawman: if nobody who studied would answer True, write a different card.
- No truism: a statement that is true by common sense, by definition or by arithmetic, and that is not specific to this subject, teaches nothing. Write a different card.
- No name giveaway: the answer must not be readable from the product name alone (for example "X for Windows File Server provides Windows file systems").
- True and false statements must be indistinguishable by form: within each section keep the average length of the false statements within 5 characters of the average length of the true ones, and use the same sentence patterns for both.
- Do not rely on facts that change often: prices, exact quotas and limits, counts of regions, free tier amounts, launch dates, preview features. If a card depends on something that could change within a year or two, set "volatility" to "may_change" and say why in "volatilityNote". Otherwise "stable".
- Leave out products that are deprecated, in maintenance mode or closed to new customers.
- Difficulty mix within each section: roughly 40% easy (1), 40% medium (2), 20% hard (3). Hard means a real distinction between two similar things, not an obscure detail.
{level_rules}

RULES FOR THE EXPLANATION
- One or two sentences, maximum 240 characters.
- Do not start with "True", "False", "Correct" or "Incorrect". The game shows the verdict itself.
- For a false statement, state the right fact. For a true statement, add the reason or the context that makes it stick.
- Must make sense on its own, without the statement next to it.
- Stay on this card's own fact. Do not mention facts that are the answer to another card in the deck.

RULES FOR THE SOURCE
- Every card needs one official URL ({allowed_sources}) where the whole card can be checked, including the right fact given in the explanation of a false statement. Open the page and confirm it supports the card as of today. No blogs by third parties, no forums, no course sites.
- Prefer current documentation over archived or historical pages.
- If you cannot verify a card against an official page, drop that fact from the plan and choose another.

SELF-CHECK BEFORE EVERY ANSWER
Go through every card of the batch as a sceptical instructor:
- Is each true statement unambiguously true and each false statement unambiguously false today? Could an expert defend the opposite answer on a technicality, a recent change or an exception? If yes, rewrite or replace.
- Does any card rest on the same fact as, mirror, or give away the answer of a card in this batch or in an earlier batch of this chat? Replace it.
- Is any statement a strawman, a truism or a name giveaway? Replace it.
- Any statement over 120 characters or explanation over 240? Shorten it.
- Are true and false statements alike in length and style in each section?

OUTPUT
Answer with a single JSON code block and nothing else, in exactly this shape:

{{
  "deck": "{deck_id}",
  "block": "<batch id, e.g. b1>",
  "generatedOn": "<today, YYYY-MM-DD>",
  "sourceCheck": "<what you found in step 1; batch b1 only, empty string afterwards>",
  "plan": [
    {{ "section": "<section id>", "facts": ["<factKey>", "..."] }}
  ],
  "notes": "<deviations from the plan, or empty string>",
  "cards": [
    {{
      "id": "{deck_id}-s<section id>-01",
      "section": "<section id>",
      "statement": "...",
      "answer": false,
      "explanation": "...",
      "misconception": "...",
      "factKey": "<the factKey from the plan>",
      "topic": "<two to four words>",
      "tags": ["<official product, service or API names tested>"],
      "appliesTo": "{applies_to_hint}",
      "difficulty": 1,
      "volatility": "stable",
      "volatilityNote": "",
      "source": {{ "title": "...", "url": "https://..." }}
    }}
  ]
}}

Field notes:
- "plan": the full plan in batch b1; an empty array in later batches.
- "id": {deck_id}-s<section id>-<two digit number, restarting at 01 for each section>.
- "misconception": for false cards, the wrong belief the statement encodes; for true cards, an empty string.
- "topic": two to four words, reused consistently across cards about the same thing.
- "appliesTo": {applies_to_note}

Start now with STEP 1, STEP 2 and batch b1.
'''

DECKS = {
    'aws-saa-c03': dict(
        deck_brief='''AWS Certified Solutions Architect - Associate (SAA-C03).
Taxonomy: cloud > AWS > certifications > Solutions Architect Associate. Sections are the task statements of the official exam guide.''',
        cards_per_section=12,
        sections='''Domain 1: Design Secure Architectures (30%)
1.1 Design secure access to AWS resources
1.2 Design secure workloads and applications
1.3 Determine appropriate data security controls
Domain 2: Design Resilient Architectures (26%)
2.1 Design scalable and loosely coupled architectures
2.2 Design highly available and/or fault-tolerant architectures
Domain 3: Design High-Performing Architectures (24%)
3.1 Determine high-performing and/or scalable storage solutions
3.2 Design high-performing and elastic compute solutions
3.3 Determine high-performing database solutions
3.4 Determine high-performing and/or scalable network architectures
3.5 Determine high-performing data ingestion and transformation solutions
Domain 4: Design Cost-Optimized Architectures (20%)
4.1 Design cost-optimized storage solutions
4.2 Design cost-optimized compute solutions
4.3 Design cost-optimized database solutions
4.4 Design cost-optimized network architectures''',
        batches='''b1: sections 1.1, 1.2, 1.3, 2.1 (48 cards)
b2: sections 2.2, 3.1, 3.2, 3.3 (48 cards)
b3: sections 3.4, 3.5, 4.1, 4.2 (48 cards)
b4: sections 4.3, 4.4 (24 cards)''',
        source_step='''Open the current official exam guide for this certification on aws.amazon.com / docs.aws.amazon.com (https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html and its domain pages). Confirm that the exam code is still current and that the task statements above exist with this wording. Read the "Knowledge of" and "Skills in" bullets of every task statement: they define what each section's cards may test. Report any difference in "sourceCheck" and continue with the task statements given above.''',
        level_rules='''- Depth: associate level. This exam is about choosing between designs, so test the capabilities, limits and trade-offs that decide such a choice: what a service or feature can and cannot do, its scope (zonal, regional, global), how two similar options differ, which requirement each one meets. Assume the player already knows what each service is for; cards that only identify a service belong to the Cloud Practitioner deck.
- Never state a judgement as a fact. "X is the most cost-effective option" or "X is the best choice" is acceptable only when the statement itself contains the full requirement that makes it so and AWS documentation supports it. Prefer statements about behaviour over statements about what is best.
- The four cost tasks (4.1 to 4.4) share the same cost-management tooling in the exam guide (AWS Cost Explorer, AWS Budgets, cost and usage reports, cost allocation tags). Test that tooling at most twice in the whole deck; the rest of domain 4 is about cost trade-offs of storage, compute, database and network designs.''',
        allowed_sources='docs.aws.amazon.com or aws.amazon.com',
        applies_to_hint='',
        applies_to_note='empty string for this deck.',
    ),
    'gcp-cdl': dict(
        deck_brief='''Google Cloud Certified: Cloud Digital Leader.
Taxonomy: cloud > Google Cloud > certifications > Cloud Digital Leader. Sections are the numbered sub-sections of the official exam guide launched on August 12, 2026.''',
        cards_per_section=10,
        sections='''Section 1: Digital Transformation with Google Cloud (~18%)
1.1 Explain why and how the cloud is revolutionizing businesses
1.2 Describe fundamental cloud concepts
Section 2: Exploring Data Transformation with Google Cloud (~18%)
2.1 Describe the intrinsic role that data plays in an organization's digital transformation
2.2 Determine which Google Cloud data management products are applicable to different business use cases
2.3 Discuss how smart analytics, business intelligence tools, and streaming analytics can add value in different business use cases
Section 3: Innovating with Google Cloud Artificial Intelligence (~18%)
3.1 Describe fundamental AI and ML concepts and how they create business value
3.2 Explain how Google Cloud's AI offerings can create business value
Section 4: Modernize Infrastructure and Applications with Google Cloud (~18%)
4.1 Describe how Google Cloud helps organizations transition to the cloud
4.2 Describe the functionality, business use cases, and business value of Google Cloud's infrastructure offerings
4.3 Describe the business value of application programming interfaces (APIs)
Section 5: Trust and Security with Google Cloud (~18%)
5.1 Describe fundamental cloud security concepts
5.2 Describe the business value of making Google part of an organization's security team with its defense-in-depth, multilayered approach to cloud security
Section 6: Scaling with Google Cloud Operations (~10%)
6.1 Recognize how Google Cloud supports an organization's ability to control their cloud costs
6.2 Describe the fundamental concepts of modern operations, reliability, and resilience in the cloud''',
        batches='''b1: sections 1.1, 1.2, 2.1, 2.2, 2.3 (50 cards)
b2: sections 3.1, 3.2, 4.1, 4.2, 4.3 (50 cards)
b3: sections 5.1, 5.2, 6.1, 6.2 (40 cards)''',
        source_step='''Open the current official exam guide PDF linked from the Cloud Digital Leader certification page on cloud.google.com (https://services.google.com/fh/files/misc/cloud_digital_leader_exam_guide_english.pdf; its footer should say it launched on August 12, 2026). Do not use the older HTML guide pages under cloud.google.com/learn/certification/guides, which describe a previous version. Confirm that the sections above exist with this wording and read the "Considerations include" bullets of every sub-section: they define what each section's cards may test. Report any difference, and the guide version you used, in "sourceCheck", then continue with the sections given above.''',
        level_rules='''- Depth: foundational, for people who work with technical teams. Test defined terms, what each Google Cloud product is for, which product fits which business use case, and how Google Cloud words its own concepts (for example the shared responsibility and shared fate models, storage classes, service models).
- This guide contains many business-value topics. They are the easiest place to write truisms ("cloud helps businesses innovate"). Every card must rest on a specific, checkable fact: a definition Google publishes, a product capability, a distinction between two products or two terms. If a sub-section seems to offer only generalities, anchor the cards in the concrete terms and products its "Considerations include" bullets name.
- Product names in this area change often (for example the Gemini and Vertex AI families). Use the name the official product page uses today, and set "volatility" to "may_change" for cards whose correctness depends on a product name or packaging.''',
        allowed_sources='cloud.google.com, docs.cloud.google.com, or another official google.com property',
        applies_to_hint='',
        applies_to_note='empty string for this deck.',
    ),
    'nextjs-rendering': dict(
        deck_brief='''Next.js: rendering, data and caching.
Taxonomy: frontend > Next.js > topics > Rendering. There is no exam guide; the official documentation is the source of truth. The audience is working frontend developers.''',
        cards_per_section=12,
        sections='''r1 Server Components and Client Components (the "use client" boundary, what can cross it, what runs where)
r2 How a request renders (RSC Payload, HTML, hydration, first load versus later navigations)
r3 Streaming and Suspense (loading UI, what ships in the shell, what streams)
r4 Static and dynamic rendering, including the Pages Router model (getStaticProps, getServerSideProps, getStaticPaths, Automatic Static Optimization)
r5 Data fetching patterns (fetching in Server Components, request memoization, parallel versus sequential, client-side fetching)
r6 Caching in the previous model (fetch caching and its defaults per major version, route segment config, Router Cache)
r7 Cache Components (the cacheComponents flag, "use cache", cacheLife, cacheTag, the static shell and Partial Prerendering)
r8 Revalidation, ISR and Server Functions (time-based and on-demand revalidation, revalidatePath, revalidateTag, updateTag, Server Actions)''',
        batches='''b1: sections r1, r2, r3, r4 (48 cards)
b2: sections r5, r6, r7, r8 (48 cards)''',
        source_step='''Open nextjs.org/docs and the Next.js blog and establish the current stable major and minor version of Next.js and the React version it ships with. Then open the official pages for each section (for example /docs/app/getting-started/server-and-client-components, /docs/app/guides/streaming, /docs/app/getting-started/fetching-data, /docs/app/getting-started/caching, /docs/app/guides/caching-without-cache-components, /docs/app/getting-started/revalidating, /docs/app/guides/incremental-static-regeneration, /docs/app/guides/server-actions, the version 15 and version 16 upgrade guides, the Pages Router data fetching references, and react.dev for Server Components, Suspense and hydrateRoot). In "sourceCheck" report the versions you pinned, the pages you opened, and any section above that the current docs no longer support as described.''',
        level_rules='''- Depth: a developer who ships Next.js apps. Test behaviour: what runs on the server or the client, what is cached and when, what triggers dynamic rendering, what a function or directive does and where it may be used. No trivia about file names or CLI flags.
- Version pinning is mandatory. Caching defaults changed between major versions (14 to 15, and again with Cache Components in 16), and the docs describe two caching models side by side. Every card whose answer depends on a version or on the cacheComponents flag must say so inside the statement (for example "In Next.js 16 with Cache Components enabled, ...") and in "appliesTo". Cards about behaviour that is the same in every supported version leave the version out of the statement and set "appliesTo" to the pinned current major.
- Leave out anything the docs mark as experimental, canary or "will become the default in a future major version", and leave out numeric defaults (cache lifetimes, stale times).
- Unless a section says otherwise, cards are about the App Router. Cards about the Pages Router say "In the Pages Router, ..." in the statement.''',
        allowed_sources='nextjs.org or react.dev',
        applies_to_hint='Next.js <major>',
        applies_to_note='the Next.js version or versions the card is true for, for example "Next.js 16", "Next.js 15 and 16" or "Next.js 16 with Cache Components".',
    ),
}

here = pathlib.Path(__file__).parent
for deck_id, d in DECKS.items():
    n_sections = sum(1 for line in d['sections'].splitlines() if line[:1].isdigit() or line.startswith('r'))
    text = MASTER.format(deck_id=deck_id, total=n_sections * d['cards_per_section'], **d)
    path = here / f'ready-v2-{deck_id}.txt'
    path.write_text(text, encoding='utf-8')
    print(f'{path.name}: {n_sections} sections, {n_sections * d["cards_per_section"]} cards, {len(text)} chars')
