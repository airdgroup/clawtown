#!/usr/bin/env python3

import json
import sys
import time
import urllib.error
import urllib.request


def parse_join_token(raw: str):
    raw = (raw or "").strip()
    parts = raw.split("|")
    if len(parts) != 3:
        return None
    version, base_url, join_code = parts[0].strip(), parts[1].strip().rstrip("/"), parts[2].strip()
    if version != "CT1" or not base_url or not join_code:
        return None
    return {"raw": raw, "baseUrl": base_url, "joinCode": join_code}


def api_json(url: str, method="GET", headers=None, body=None, timeout=10):
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(text)
            except Exception:
                payload = {"raw": text}
            return resp.status, payload
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(text)
        except Exception:
            payload = {"raw": text}
        return e.code, payload
    except Exception as e:
        return 0, {"ok": False, "error": str(e)}


def nearest_alive_monster(you, monsters):
    if not you:
        return None
    best = None
    best_d2 = 10**18
    for m in monsters or []:
        if not m or m.get("alive") is False:
            continue
        dx = float(m.get("x") or 0) - float(you.get("x") or 0)
        dy = float(m.get("y") or 0) - float(you.get("y") or 0)
        d2 = dx * dx + dy * dy
        if d2 < best_d2:
            best_d2 = d2
            best = m
    if not best:
        return None
    return {"m": best, "d2": best_d2}


def main(argv):
    join_token = ""
    poll_ms = 1200
    run_for_sec = 0
    verbose = False

    i = 1
    while i < len(argv):
        a = argv[i]
        if not join_token and a.startswith("CT1|") and "|" in a:
            join_token = a
        elif a == "--pollMs" and i + 1 < len(argv):
            i += 1
            poll_ms = int(float(argv[i] or "0"))
        elif a == "--runForSec" and i + 1 < len(argv):
            i += 1
            run_for_sec = int(float(argv[i] or "0"))
        elif a == "--verbose":
            verbose = True
        i += 1

    parsed = parse_join_token(join_token)
    if not parsed:
        print('Usage: python3 examples/python-agent/bot.py "CT1|<baseUrl>|<joinCode>" [--runForSec 60] [--pollMs 1200] [--verbose]', file=sys.stderr)
        return 2

    base_url = parsed["baseUrl"]
    poll_ms = max(500, int(poll_ms or 1200))
    run_for_sec = max(0, int(run_for_sec or 0))

    st, linked = api_json(f"{base_url}/api/bot/link", method="POST", body={"joinToken": parsed["raw"]})
    if st < 200 or st >= 300 or not linked.get("ok") or not linked.get("botToken"):
        print("link failed", st, linked, file=sys.stderr)
        return 2

    bot_token = str(linked["botToken"])
    headers = {"Authorization": f"Bearer {bot_token}"}

    st, mode = api_json(f"{base_url}/api/bot/mode", method="POST", headers=headers, body={"mode": "agent"})
    if st < 200 or st >= 300 or not mode.get("ok"):
        print("mode failed", st, mode, file=sys.stderr)
        return 2

    print(f"Connected. baseUrl={base_url} playerId={linked.get('playerId','')}")
    print("Loop: world → goal/cast. Ctrl+C to stop.")

    started = time.time()
    last_cast_at = 0.0
    last_goal_at = 0.0
    last_thought_at = 0.0
    hit_range = 140.0

    try:
        while True:
            if run_for_sec > 0 and (time.time() - started) > run_for_sec:
                break

            st, w = api_json(f"{base_url}/api/bot/world", headers=headers)
            if st < 200 or st >= 300 or not w.get("ok"):
                if verbose:
                    print("world error", st, w, file=sys.stderr)
                time.sleep(poll_ms / 1000.0)
                continue

            snap = w.get("snapshot") or {}
            you = snap.get("you") or None
            nearest = nearest_alive_monster(you, snap.get("monsters") or [])
            now = time.time()

            if nearest and you:
                if nearest["d2"] <= hit_range * hit_range:
                    if (now - last_cast_at) > 0.85:
                        last_cast_at = now
                        st2, r = api_json(f"{base_url}/api/bot/cast", method="POST", headers=headers, body={"spell": "signature"})
                        if verbose:
                            print("cast", st2, ("ok" if r.get("ok") else r), file=sys.stderr)
                elif (now - last_goal_at) > 1.2:
                    last_goal_at = now
                    st2, r = api_json(
                        f"{base_url}/api/bot/goal",
                        method="POST",
                        headers=headers,
                        body={"x": float(nearest["m"].get("x") or 0), "y": float(nearest["m"].get("y") or 0)},
                    )
                    if verbose:
                        print("goal", st2, ("ok" if r.get("ok") else r), file=sys.stderr)

            if (now - last_thought_at) > 8.0:
                last_thought_at = now
                api_json(f"{base_url}/api/bot/thought", method="POST", headers=headers, body={"text": "Auto-grinding… (tiny agent)"})

            time.sleep(poll_ms / 1000.0)
    except KeyboardInterrupt:
        pass

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

