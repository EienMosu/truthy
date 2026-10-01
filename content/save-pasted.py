"""Saves card batches that were pasted into the Claude Code session (or are on the clipboard) to raw/.

Usage: python3 save-pasted.py
Looks at the clipboard, the paste cache and the session transcript, and writes every batch
(raw/<deck>-<block>.json) that is not on disk yet. Existing files are never overwritten.
"""
import glob
import json
import os
import pathlib
import re
import subprocess

HERE = pathlib.Path(__file__).parent
# Claude Code names a project's transcript folder after its path, with / and . replaced by -.
TRANSCRIPTS = os.path.join(os.path.expanduser('~/.claude/projects'), re.sub(r'[/.]', '-', str(pathlib.Path.home())), '*.jsonl')
PASTE_CACHE = os.path.expanduser('~/.claude/paste-cache/*')
START = re.compile(r'\{\s*"deck":\s*"([\w-]+)",\s*"block":\s*"(\w+)"')
found = {}


def scan(text):
    for m in START.finditer(text):
        try:
            obj, _ = json.JSONDecoder().raw_decode(text[m.start():])
        except ValueError:
            continue
        if isinstance(obj.get('cards'), list):
            found[(obj['deck'], obj['block'])] = obj


def walk(node):
    if isinstance(node, str):
        if '"deck"' in node:
            scan(node)
    elif isinstance(node, dict):
        for v in node.values():
            walk(v)
    elif isinstance(node, list):
        for v in node:
            walk(v)


scan(subprocess.run(['pbpaste'], capture_output=True, text=True).stdout)
for path in glob.glob(PASTE_CACHE):
    try:
        scan(pathlib.Path(path).read_text(encoding='utf-8', errors='ignore'))
    except OSError:
        pass
newest = sorted(glob.glob(TRANSCRIPTS), key=os.path.getmtime)[-3:]
for path in newest:
    for line in open(path, encoding='utf-8', errors='ignore'):
        if 'deck' not in line:
            continue
        try:
            walk(json.loads(line))
        except ValueError:
            pass

for (deck, block), obj in sorted(found.items()):
    target = HERE / 'raw' / f'{deck}-{block}.json'
    if target.exists():
        continue
    target.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'saved {len(obj["cards"])} cards to {target}')
