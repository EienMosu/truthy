"""Structural check for raw card batches. Usage: python3 validate.py raw/aws-clf-c02-d1.json [...]"""
import collections
import json
import re
import sys

REQUIRED = ['id', 'statement', 'answer', 'explanation', 'misconception', 'topic',
            'difficulty', 'volatility', 'volatilityNote', 'source']
# v1 batches use task/services, v2 batches use section/tags/factKey/appliesTo
EITHER = [('task', 'section'), ('services', 'tags')]
NEGATION = re.compile(r"\b(not|cannot|can't|never|no longer|isn't|doesn't|don't|without)\b", re.I)
# Official documentation hosts of every deck's product (exact host or a subdomain of it).
OFFICIAL = re.compile(
    r"https://([\w-]+\.)*("
    r"aws\.amazon\.com|google\.com|google|nextjs\.org|react\.dev"
    r"|microsoft\.com"
    r"|docker\.com|kubernetes\.io|cncf\.io|linuxfoundation\.org|github\.com/cncf"
    r"|prometheus\.io|opentelemetry\.io|opengitops\.dev|opencontainers\.org|knative\.dev|helm\.sh|readthedocs\.io"
    r"|github\.blog"
    r"|hashicorp\.com|github\.com|githubusercontent\.com"
    r"|typescriptlang\.org"
    r"|owasp\.org|mozilla\.org|w3\.org|whatwg\.org|ietf\.org|rfc-editor\.org|web\.dev|chromium\.org"
    r"|tc39\.es|ecma-international\.org|nodejs\.org|git-scm\.com|kernel\.org|man7\.org|gnu\.org|freedesktop\.org"
    r"|openbsd\.org|openssh\.com|uapi-group\.org|w3c\.github\.io|chrome\.com|debian\.org|fedoraproject\.org|ubuntu\.com|systemd\.io"
    r"|python\.org|postgresql\.org"
    r")/"
)
ABSOLUTE = re.compile(r"\b(always|all|only|every|solely|exclusively)\b", re.I)
VERDICT_START = re.compile(r"\s*(true|false|correct|incorrect)\b", re.I)
AWS_URL = re.compile(r"https://([\w-]+\.)*aws\.amazon\.com/")


def load(path):
    raw = open(path, encoding='utf-8').read().strip()
    raw = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw)
    return json.loads(raw)


def check(path):
    d = load(path)
    cards = d['cards']
    print(f"\n== {path}: block {d.get('block')}, {len(cards)} cards, generated {d.get('generatedOn')}")
    print(f"   source check: {(d.get('sourceCheck') or d.get('examGuideCheck') or '')[:400]}")
    if d.get('plan'):
        planned = [k for sec in d['plan'] for k in sec['facts']]
        print(f"   plan: {len(d['plan'])} sections, {len(planned)} facts, {len(planned) - len(set(planned))} repeated factKeys")
    if d.get('notes'):
        print(f"   notes: {d['notes'][:400]}")
    issues, ids, fact_keys = [], set(), {}
    by_task = collections.defaultdict(list)
    for c in cards:
        i = c.get('id', '?')
        issues += [(i, f'missing {k}') for k in REQUIRED if k not in c]
        issues += [(i, f'missing {a} or {b}') for a, b in EITHER if a not in c and b not in c]
        if 'factKey' in c:
            if c['factKey'] in fact_keys:
                issues.append((i, f"factKey {c['factKey']} already used by {fact_keys[c['factKey']]}"))
            fact_keys[c['factKey']] = i
        if i in ids:
            issues.append((i, 'duplicate id'))
        ids.add(i)
        by_task[c.get('section', c.get('task'))].append(c)
        s, e = c.get('statement', ''), c.get('explanation', '')
        if len(s) > 120:
            issues.append((i, f'statement {len(s)} chars'))
        if len(e) > 240:
            issues.append((i, f'explanation {len(e)} chars'))
        if not isinstance(c.get('answer'), bool):
            issues.append((i, 'answer is not a boolean'))
        if NEGATION.search(s):
            issues.append((i, 'negation: ' + s))
        if ABSOLUTE.search(s):
            issues.append((i, 'absolute: ' + s))
        if VERDICT_START.match(e):
            issues.append((i, 'explanation starts with a verdict'))
        if not OFFICIAL.match(c.get('source', {}).get('url', '')):
            issues.append((i, 'source is not an official URL: ' + str(c.get('source'))))
        if c.get('answer') is False and not c.get('misconception'):
            issues.append((i, 'false card without misconception'))
        if c.get('volatility') != 'stable':
            issues.append((i, f"volatility {c.get('volatility')}: {c.get('volatilityNote', '')}"))
    for task, cs in sorted(by_task.items()):
        true = [c for c in cs if c['answer'] is True]
        false = [c for c in cs if c['answer'] is False]
        avg = lambda xs: round(sum(len(c['statement']) for c in xs) / max(1, len(xs)))
        diff = dict(sorted(collections.Counter(c['difficulty'] for c in cs).items()))
        print(f"   {task}: {len(cs)} cards, {len(true)} true / {len(false)} false, difficulty {diff}, "
              f"avg statement length true {avg(true)} / false {avg(false)}")
    print(f"   issues: {len(issues)}")
    for i in issues:
        print('    ', i)
    return cards


if __name__ == '__main__':
    for p in sys.argv[1:]:
        check(p)
