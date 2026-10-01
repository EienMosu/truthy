# Truthy: AWS Certified Cloud Practitioner (CLF-C02): card generation prompts

How to use: copy the MASTER PROMPT, replace the `<<DOMAIN BLOCK>>` line with one of the domain blocks at the bottom, paste into GPT (web browsing on). One run per block. Save each answer as `content/raw/aws-clf-c02-<block>.json` (for example `aws-clf-c02-d2.json`).

Start with block D2 only. We check that batch before running the others.

---

## MASTER PROMPT

```text
You are writing content for "Truthy", a mobile true/false card game that helps people study for IT certifications. The player sees one statement, answers True or False, then reads a short explanation. A wrong fact in this game teaches people something false, so accuracy matters more than volume.

Deck: AWS Certified Cloud Practitioner (CLF-C02).

<<DOMAIN BLOCK>>

STEP 1. Check the exam guide
Open the current official exam guide for this certification on aws.amazon.com. Confirm that the task statements listed above still exist and are worded the same way. Report any difference in the "examGuideCheck" field. If the exam code has been replaced by a newer version, say so there and continue with the task statements given above.

STEP 2. Write the cards
For EACH task statement above, write 12 cards.

Rules for the statement:
- Original wording. Do not copy or paraphrase questions from practice exams, exam dumps or course material.
- One fact per statement. No compound statements where one half is true and the other is false.
- Maximum 120 characters. Plain declarative sentence, present tense.
- No negations ("is not", "cannot", "never") in the statement. Players get confused answering True to a negative.
- No absolutes ("always", "all", "only", "every", "never") unless the official documentation itself states it that way.
- Use official service names (Amazon S3, AWS Lambda, Amazon EC2, AWS IAM Identity Center).
- A false statement must be false for exactly one clear reason, and that reason must be a realistic misconception a learner could hold (a swapped service, a swapped responsibility, a wrong scope). Never make a statement false through trick wording, spelling, or a changed number.
- Do not rely on facts that change often: prices, exact quotas, number of Regions or Availability Zones, free tier amounts, feature launch dates. If a card depends on something that could change within a year or two, set "volatility" to "may_change" and say why in "volatilityNote". Otherwise "stable".
- Within each task statement: 6 true and 6 false. True and false statements must be indistinguishable by form: keep the average length of the false statements within 5 characters of the average length of the true ones, and use the same sentence patterns for both.
- Foundational level only. This is the Cloud Practitioner exam: test what a service is for, who is responsible for what, and which service fits which need. Do not test feature modes, configuration options, API or event-type details, or anything that belongs to an associate or professional exam.
- No strawman false statements. A false statement must be something a learner who studied could plausibly believe. If nobody would answer True, write a different card.
- Difficulty mix within each task statement: about 5 easy (1), 5 medium (2), 2 hard (3). Hard means it needs a real distinction between two similar things, not an obscure detail.
- Cover the breadth of the task statement. No two cards may test the same fact.

Rules for the explanation:
- One or two sentences, maximum 240 characters.
- Do not start with "True", "False", "Correct" or "Incorrect". The game shows the verdict itself.
- For a false statement, state the right fact. For a true statement, add the reason or the context that makes it stick.
- Must make sense on its own, without the statement next to it.

Rules for the source:
- Every card needs one official AWS URL (docs.aws.amazon.com or aws.amazon.com) where the fact can be checked. Open the page and confirm it supports the card as of today. No blogs, no third-party sites.
- The page must support the whole card, including the right fact given in the explanation of a false statement. Prefer current service documentation over archived whitepapers marked as historical reference.
- If you cannot verify a card against an official page, drop it and write a different one.

STEP 3. Self-check before answering
Go through every card once more as a sceptical AWS instructor:
- Is each true statement unambiguously true and each false statement unambiguously false today?
- Could an expert argue the opposite answer on a technicality? If yes, rewrite or drop it.
- Any duplicates or near-duplicates? Replace them.
- Any statement over 120 characters or explanation over 240? Shorten it.

OUTPUT
Answer with a single JSON code block and nothing else, in exactly this shape:

{
  "deck": "aws-clf-c02",
  "block": "<block id from the domain block, e.g. d2>",
  "generatedOn": "<today, YYYY-MM-DD>",
  "examGuideCheck": "<what you found in step 1>",
  "cards": [
    {
      "id": "aws-clf-c02-t2.1-01",
      "task": "2.1",
      "statement": "AWS is responsible for patching the guest operating system on your Amazon EC2 instances.",
      "answer": false,
      "explanation": "You patch the guest OS on EC2. AWS looks after the hypervisor, the physical hosts and the data centres beneath it.",
      "misconception": "Thinking AWS manages everything below the application on EC2.",
      "topic": "Shared responsibility model",
      "services": ["Amazon EC2"],
      "difficulty": 1,
      "volatility": "stable",
      "volatilityNote": "",
      "source": {
        "title": "Shared Responsibility Model",
        "url": "https://aws.amazon.com/compliance/shared-responsibility-model/"
      }
    }
  ]
}

Field notes:
- "id": aws-clf-c02-t<task>-<two digit number, restarting at 01 for each task statement>.
- "misconception": for false cards, the wrong belief the statement encodes; for true cards, an empty string.
- "topic": two to four words, reused consistently across cards about the same thing.
- "services": official service names mentioned or tested, may be empty.
- The example card above is only an example. Do not include it in your output.
```

---

## DOMAIN BLOCKS

### D1

```text
Block id: d1
Domain 1: Cloud Concepts
Task statements:
1.1 Define the benefits of the AWS Cloud
1.2 Identify design principles of the AWS Cloud (AWS Well-Architected Framework)
1.3 Understand the benefits of and strategies for migration to the AWS Cloud (AWS Cloud Adoption Framework, migration strategies)
1.4 Understand concepts of cloud economics
```

### D2 (run this one first)

```text
Block id: d2
Domain 2: Security and Compliance
Task statements:
2.1 Understand the AWS shared responsibility model
2.2 Understand AWS Cloud security, governance, and compliance concepts
2.3 Identify AWS access management capabilities
2.4 Identify components and resources for security
```

### D3a

```text
Block id: d3a
Domain 3: Cloud Technology and Services (part 1 of 2)
Task statements:
3.1 Define methods of deploying and operating in the AWS Cloud
3.2 Define the AWS global infrastructure
3.3 Identify AWS compute services
3.4 Identify AWS database services
```

### D3b

```text
Block id: d3b
Domain 3: Cloud Technology and Services (part 2 of 2)
Task statements:
3.5 Identify AWS network services
3.6 Identify AWS storage services
3.7 Identify AWS artificial intelligence and machine learning (AI/ML) services and analytics services
3.8 Identify services from other in-scope AWS service categories
```

### D4

```text
Block id: d4
Domain 4: Billing, Pricing, and Support
Task statements:
4.1 Compare AWS pricing models
4.2 Understand resources for billing, budget, and cost management
4.3 Identify AWS technical resources and AWS Support options
```
