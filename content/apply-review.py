"""Builds reviewed/<deck>.json from raw/<deck>-*.json plus review/<deck>-edits.json.

Usage: python3 apply-review.py aws-clf-c02
Raw files are never modified. Each card gets a "revision" field (original, source-fixed or rewritten) and "conflictGroups":
cards sharing a group must not be dealt in the same round. The optional "appliesTo" section maps a card id to a new
qualifier for a card that is not rewritten; it keeps the card's revision, since the statement and answer are unchanged.
"""
import glob
import json
import pathlib
import sys

deck = sys.argv[1]
here = pathlib.Path(__file__).parent
edits = json.loads((here / 'review' / f'{deck}-edits.json').read_text(encoding='utf-8'))

cards = []
for path in sorted(glob.glob(str(here / 'raw' / f'{deck}-*.json'))):
    cards += json.loads(pathlib.Path(path).read_text(encoding='utf-8'))['cards']

known = {c['id'] for c in cards}
group_of = {}
for name, ids in edits.get('conflictGroups', {}).items():
    for cid in ids:
        group_of.setdefault(cid, []).append(name)

qualifiers = edits.get('appliesTo', {})
for section in ('drop', 'source', 'rewrite', 'appliesTo'):
    unknown = set(edits.get(section, {})) - known
    if unknown:
        sys.exit(f'{section}: unknown card ids {sorted(unknown)}')
overlap = sorted(set(qualifiers) & set(edits['rewrite']))
if overlap:
    sys.exit(f'appliesTo: {overlap} are rewritten, so their qualifier belongs in rewrite')

out = []
for card in cards:
    cid = card['id']
    if cid in edits['drop']:
        continue
    card = {**card, 'revision': 'original', 'conflictGroups': group_of.get(cid, [])}
    if cid in edits['source']:
        card.update(source=edits['source'][cid], revision='source-fixed')
    if cid in edits['rewrite']:
        new = {k: v for k, v in edits['rewrite'][cid].items() if k != 'reason'}
        card.update({'volatility': 'stable', 'volatilityNote': '', **new}, revision='rewritten')
    if cid in qualifiers:
        card['appliesTo'] = qualifiers[cid]
    out.append(card)

target = here / 'reviewed' / f'{deck}.json'
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps({'deck': deck, 'block': 'reviewed', 'cards': out}, ensure_ascii=False, indent=2) + '\n',
                  encoding='utf-8')
counts = {r: sum(c['revision'] == r for c in out) for r in ('original', 'source-fixed', 'rewritten')}
print(f'{len(cards)} raw cards -> {len(out)} reviewed cards {counts}, {len(edits["drop"])} dropped -> {target}')
