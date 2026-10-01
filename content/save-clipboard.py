"""Saves a card batch from the clipboard to raw/<deck>-<block>.json, named from the JSON itself."""
import json
import pathlib
import re
import subprocess
import sys

raw = subprocess.run(['pbpaste'], capture_output=True, text=True).stdout.strip()
raw = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw)
try:
    data = json.loads(raw)
    deck, block, cards = data['deck'], data['block'], data['cards']
except Exception as e:
    sys.exit(f"Clipboard does not hold a card batch ({type(e).__name__}). It starts with: {raw[:80]!r}")

path = pathlib.Path(__file__).parent / 'raw' / f'{deck}-{block}.json'
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'saved {len(cards)} cards to {path}')
