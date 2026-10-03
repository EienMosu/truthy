"""Writes a deck's raw batches with the Codex CLI instead of a chat window.

Usage: python3 generate_codex.py <deck id> [--model gpt-6-sol] [--effort xhigh]

It sends prompts/ready-v2-<deck>.txt to `codex exec` (web search on, read-only sandbox, run in an empty
folder), saves the answer as raw/<deck>-b1.json, then resumes the same Codex session with `next` for each
following batch, exactly as a person would in one chat. The session keeps every earlier batch in its
context, so the deck plan and the duplicate checks of the prompt still work.

An answer that is not one JSON object for the expected batch is sent back once with the error. A deck that
already has raw files continues after the last one only if the session id was saved (.codex-sessions/,
git-ignored).
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
FENCE = re.compile(r"```(?:json)?\s*(\{.*\})\s*```", re.S)


def batches_of(prompt: str) -> list[str]:
    return re.findall(r"^(b\d+): sections? ", prompt, re.M)


def parse(answer: str) -> dict:
    match = FENCE.search(answer)
    text = match.group(1) if match else answer.strip()
    return json.loads(text)


def run(args: list[str], stdin: str, workdir: pathlib.Path) -> tuple[str, str]:
    """Runs codex exec; returns the session id and the final message."""
    last = workdir / "last.txt"
    last.unlink(missing_ok=True)
    proc = subprocess.run(
        ["codex", "exec", *args, "--skip-git-repo-check", "--json", "-o", str(last)],
        input=stdin, capture_output=True, text=True, cwd=workdir,
    )
    session = ""
    errors = []
    for line in proc.stdout.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") == "thread.started":
            session = event["thread_id"]
        if event.get("type") in ("turn.failed", "error"):
            errors.append(json.dumps(event)[:400])
    if proc.returncode != 0 or not last.exists():
        sys.exit(f"codex exec failed ({proc.returncode}): {' | '.join(errors) or proc.stderr[-400:]}")
    return session, last.read_text()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("deck")
    parser.add_argument("--model", default="gpt-6-sol")
    parser.add_argument("--effort", default="max")
    opts = parser.parse_args()

    prompt = (HERE / "prompts" / f"ready-v2-{opts.deck}.txt").read_text(encoding="utf-8")
    batches = batches_of(prompt)
    raw = HERE / "raw"
    session_file = HERE / ".codex-sessions" / f"{opts.deck}.session"
    session_file.parent.mkdir(exist_ok=True)
    common = ["-m", opts.model, "-c", f'model_reasoning_effort="{opts.effort}"', "-c", 'web_search="live"']
    workdir = pathlib.Path(tempfile.mkdtemp(prefix=f"truthy-{opts.deck}-"))

    done = [b for b in batches if (raw / f"{opts.deck}-{b}.json").exists()]
    session = session_file.read_text().strip() if session_file.exists() else ""
    if done and not session:
        sys.exit(f"{opts.deck}: raw files exist but no saved session; remove them or add {session_file.name}")

    for batch in batches[len(done):]:
        if not session:
            session, answer = run([*common, "-s", "read-only", "-"], prompt, workdir)
            session_file.write_text(session + "\n")
        else:
            _, answer = run(["resume", session, *common, "-"], "next", workdir)
        for attempt in (1, 2):
            try:
                data = parse(answer)
                if data.get("deck") != opts.deck or data.get("block") != batch or not data.get("cards"):
                    raise ValueError(f'expected deck "{opts.deck}", block "{batch}" and cards')
                break
            except (ValueError, json.JSONDecodeError) as error:
                if attempt == 2:
                    sys.exit(f"{opts.deck} {batch}: no valid answer after a retry: {error}")
                note = (f"Your last answer could not be used ({error}). Answer again with batch {batch} only, "
                        "as a single JSON code block in the shape the instructions give, and nothing else.")
                _, answer = run(["resume", session, *common, "-"], note, workdir)
        path = raw / f"{opts.deck}-{batch}.json"
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{opts.deck} {batch}: {len(data['cards'])} cards -> {path.name}", flush=True)


if __name__ == "__main__":
    main()
