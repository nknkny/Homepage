#!/usr/bin/env python3
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone, timedelta

BASE = "https://piano-lesson-system-default-rtdb.asia-southeast1.firebasedatabase.app/event_notice_platform_v2"
REPORT_THRESHOLD = 3
MATCH_THRESHOLD = 60
STALE_DAYS = 180
TIMEOUT = 30


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def today_jst():
    return (datetime.now(timezone.utc) + timedelta(hours=9)).date().isoformat()


def parse_iso(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def request_json(path="", method="GET", payload=None):
    url = f"{BASE}/{path}.json" if path else f"{BASE}.json"
    data = None
    headers = {"User-Agent": "event-platform-maintenance/2"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Firebase {method} {path}: HTTP {e.code}: {body[:500]}") from e


def patch_listing(listing_id, patch):
    request_json(f"listings/{listing_id}", "PATCH", patch)


def put_notification(owner_id, notification_id, data, existing):
    if not owner_id:
        return False
    if notification_id in (existing.get(owner_id) or {}):
        return False
    request_json(f"notifications/{owner_id}/{notification_id}", "PUT", data)
    existing.setdefault(owner_id, {})[notification_id] = data
    return True


def effective_status(r, today):
    status = r.get("status") or "published"
    if status in {"deleted", "rejected", "auto_hidden", "expired", "stale", "review_required"}:
        return status
    if r.get("type") == "event" and r.get("dateEnd") and r["dateEnd"] < today:
        return "expired"
    if r.get("type") != "event":
        updated = parse_iso(r.get("updatedAt") or r.get("createdAt"))
        if updated and datetime.now(timezone.utc) - updated > timedelta(days=STALE_DAYS):
            return "stale"
    return status


def normalize(s):
    return " ".join(str(s or "").strip().lower().split())


def score(event, resource):
    if event.get("type") != "event" or resource.get("type") == "event":
        return 0
    if resource.get("type") not in (event.get("needs") or []):
        return 0
    s = 10
    ea, ra = normalize(event.get("area")), normalize(resource.get("area"))
    if ea and ra:
        if ea == ra:
            s += 30
        elif ea in ra or ra in ea:
            s += 20
        else:
            ep = ea.split("市")[0].split("町")[0].split("村")[0].split("区")[0]
            rp = ra.split("市")[0].split("町")[0].split("村")[0].split("区")[0]
            if ep and rp and ep == rp:
                s += 10
    if event.get("category") and event.get("category") == resource.get("category"):
        s += 18
    et, rt = set(event.get("tags") or []), set(resource.get("tags") or [])
    s += min(20, 5 * len(et & rt))
    if resource.get("availableFrom") and event.get("dateEnd") and resource["availableFrom"] > event["dateEnd"]:
        return 0
    if resource.get("availableTo") and event.get("dateStart") and resource["availableTo"] < event["dateStart"]:
        return 0
    if resource.get("availableFrom") or resource.get("availableTo"):
        s += 12
    if resource.get("type") == "venue" and int(resource.get("capacity") or 0) > 0:
        s += 5
    return min(100, s)


def nid(*parts):
    return hashlib.sha256(":".join(map(str, parts)).encode()).hexdigest()[:28]


def main():
    root = request_json() or {}
    listings = root.get("listings") or {}
    reports = root.get("reports") or {}
    requests = root.get("requests") or {}
    notifications = root.get("notifications") or {}
    today = today_jst()
    changed = {"expired": 0, "stale": 0, "hidden": 0, "notifications": 0}

    report_people = defaultdict(set)
    for r in reports.values():
        if not r or r.get("status") == "dismissed" or not r.get("listingId"):
            continue
        report_people[r["listingId"]].add(r.get("reporterId") or r.get("id"))

    for listing_id, r in list(listings.items()):
        if not r:
            continue
        st = effective_status(r, today)
        if st == "expired" and r.get("status") not in {"expired", "deleted", "rejected", "auto_hidden"}:
            patch_listing(listing_id, {"status": "expired", "autoStatusAt": now_iso(), "autoStatusSource": "github-actions"})
            r["status"] = "expired"
            changed["expired"] += 1
        elif st == "stale" and r.get("status") == "published":
            patch_listing(listing_id, {"status": "stale", "autoStatusAt": now_iso(), "autoStatusSource": "github-actions"})
            r["status"] = "stale"
            changed["stale"] += 1
        if len(report_people.get(listing_id, set())) >= REPORT_THRESHOLD and r.get("status") == "published":
            n = len(report_people[listing_id])
            patch_listing(listing_id, {"status": "auto_hidden", "autoHiddenAt": now_iso(), "autoHiddenReason": f"{n}件の独立通報", "autoStatusSource": "github-actions"})
            r["status"] = "auto_hidden"
            changed["hidden"] += 1

    published = {i: r for i, r in listings.items() if r and effective_status(r, today) == "published"}
    events = [(i, r) for i, r in published.items() if r.get("type") == "event"]
    resources = [(i, r) for i, r in published.items() if r.get("type") != "event"]
    for eid, event in events:
        for rid, resource in resources:
            match_score = score(event, resource)
            if match_score < MATCH_THRESHOLD:
                continue
            mid = nid("match", eid, rid)
            common = {"id": mid, "kind": "match", "eventId": eid, "resourceId": rid, "score": match_score, "createdAt": now_iso(), "status": "unread"}
            eo, ro = event.get("ownerId"), resource.get("ownerId")
            if put_notification(eo, mid, {**common, "title": f"高一致候補 {match_score}点", "message": f"{event.get('title','イベント')} ↔ {resource.get('title','候補')}"}, notifications):
                changed["notifications"] += 1
            if ro and ro != eo and put_notification(ro, mid, {**common, "title": f"イベント候補 {match_score}点", "message": f"{resource.get('title','提供内容')} ↔ {event.get('title','イベント')}"}, notifications):
                changed["notifications"] += 1

    for req_id, r in requests.items():
        if not r:
            continue
        status = r.get("status") or "pending"
        if status == "pending":
            owner = r.get("toOwnerId")
            qid = nid("request", req_id, "pending")
            data = {"id": qid, "kind": "request", "requestId": req_id, "title": "新しいマッチ希望", "message": "マッチ希望が届いています。", "createdAt": r.get("createdAt") or now_iso(), "status": "unread"}
            if put_notification(owner, qid, data, notifications):
                changed["notifications"] += 1
        elif status in {"accepted", "declined"}:
            owner = r.get("fromOwnerId")
            qid = nid("request", req_id, status)
            title = "マッチ希望が承認されました" if status == "accepted" else "マッチ希望への回答があります"
            data = {"id": qid, "kind": "request_result", "requestId": req_id, "title": title, "message": status, "createdAt": r.get("updatedAt") or now_iso(), "status": "unread"}
            if put_notification(owner, qid, data, notifications):
                changed["notifications"] += 1

    health = {"ok": True, "runAt": now_iso(), "source": "github-actions", "build": "2026-08-15-autopilot-v2", "counts": {"listings": len(listings), "reports": len(reports), "requests": len(requests)}, "changes": changed}
    request_json("health/background", "PUT", health)
    print(json.dumps(health, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"maintenance failed: {exc}", file=sys.stderr)
        sys.exit(1)
