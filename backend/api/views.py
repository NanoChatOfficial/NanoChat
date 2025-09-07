import sqlite3
from pathlib import Path
from datetime import datetime, timedelta
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.dateparse import parse_datetime
import json
import os

AES_GCM_IV_BYTES = 12
AES_GCM_TAG_BYTES = 16
MAX_LIMIT = 1000

DB_PATH = Path(settings.BASE_DIR) / "messages.db"

with open(Path(settings.BASE_DIR) / "config.json") as f:
    CONFIG = json.load(f)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room TEXT NOT NULL,
            user TEXT NOT NULL,
            user_iv TEXT NOT NULL,
            content TEXT NOT NULL,
            iv TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

def is_hex(s: str) -> bool:
    return all(c in "0123456789abcdefABCDEF" for c in s)

def valid_hex_len(hex_str: str, min_bytes: int, exact_bytes=None) -> bool:
    if not hex_str or not is_hex(hex_str) or len(hex_str) % 2 != 0:
        return False
    bytes_len = len(hex_str) // 2
    if bytes_len < min_bytes:
        return False
    if exact_bytes and bytes_len != exact_bytes:
        return False
    return True

def utc_now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

def load_messages(room: str) -> list:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM messages WHERE room = ? ORDER BY id ASC", (room,))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def next_id(room: str) -> int:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT MAX(id) FROM messages WHERE room = ?", (room,))
    max_id = c.fetchone()[0]
    conn.close()
    return (max_id or 0) + 1

def apply_query(messages: list, params: dict) -> list:
    if not params:
        return messages[:MAX_LIMIT]

    since_id = params.get("since_id")
    since_ts = params.get("since_ts")
    limit = min(int(params.get("limit", 100)), MAX_LIMIT)
    sort = params.get("sort")
    order = params.get("order", "asc")

    if since_id:
        messages = [m for m in messages if m["id"] > int(since_id)]
    if since_ts:
        try:
            dt = parse_datetime(since_ts)
            messages = [m for m in messages if parse_datetime(m["timestamp"]) > dt]
        except Exception:
            pass

    reverse = order.lower() == "desc"
    if sort == "timestamp":
        messages.sort(key=lambda m: parse_datetime(m["timestamp"]), reverse=reverse)
    else:
        messages.sort(key=lambda m: m["id"], reverse=reverse)

    return messages[:limit]

def save_message_to_db(message: dict):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO messages (id, room, user, user_iv, content, iv, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (message["id"], message["room"], message["user"], message["user_iv"],
          message["content"], message["iv"], message["timestamp"]))
    conn.commit()
    conn.close()

def cleanup_expired_messages():
    expiration = timedelta(days=30)
    cutoff = datetime.utcnow() - expiration
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM messages WHERE timestamp < ?", (cutoff.isoformat() + "Z",))
    deleted = c.rowcount
    conn.commit()
    conn.close()
    if deleted > 0:
        print(f"Removed {deleted} expired messages")

def apply_query_sql(room: str, params: dict) -> list:
    conn = get_db_connection()
    c = conn.cursor()

    query = "SELECT * FROM messages WHERE room = ?"
    args = [room]

    since_id = params.get("since_id")
    since_ts = params.get("since_ts")
    if since_id:
        query += " AND id > ?"
        args.append(int(since_id))
    if since_ts:
        try:
            dt = parse_datetime(since_ts)
            if dt:
                query += " AND timestamp > ?"
                args.append(dt.isoformat() + "Z")
        except Exception:
            pass

    sort = params.get("sort", "id")
    order = params.get("order", "asc").lower()
    if sort not in ["id", "timestamp"]:
        sort = "id"
    if order not in ["asc", "desc"]:
        order = "asc"
    query += f" ORDER BY {sort} {order}"

    limit = min(int(params.get("limit", 100)), MAX_LIMIT)
    query += " LIMIT ?"
    args.append(limit)

    c.execute(query, tuple(args))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_messages(request, room):
    if len(room) != 16 or not is_hex(room):
        return HttpResponseBadRequest()

    params = {k: v for k, v in request.GET.items() if k in ["since_id", "since_ts", "limit", "sort", "order"]}
    selected = apply_query_sql(room, params)
    return JsonResponse(selected, safe=False)

@csrf_exempt
def create_message(request, room):
    if request.method != "POST":
        return HttpResponseBadRequest()
    if len(room) != 16 or not is_hex(room):
        return HttpResponseBadRequest()

    try:
        data = json.loads(request.body)
    except Exception:
        return HttpResponseBadRequest()

    if (len(data.get("user", "")) > CONFIG["max_user_len"] or
        len(data.get("user_iv", "")) > CONFIG["max_iv_len"] or
        len(data.get("iv", "")) > CONFIG["max_iv_len"] or
        len(data.get("content", "")) > CONFIG["max_content_len"]):
        return HttpResponseBadRequest()

    if not valid_hex_len(data.get("user_iv", ""), AES_GCM_IV_BYTES, AES_GCM_IV_BYTES):
        return HttpResponseBadRequest()
    if not valid_hex_len(data.get("iv", ""), AES_GCM_IV_BYTES, AES_GCM_IV_BYTES):
        return HttpResponseBadRequest()
    if not valid_hex_len(data.get("content", ""), AES_GCM_TAG_BYTES, None):
        return HttpResponseBadRequest()
    if not valid_hex_len(data.get("user", ""), AES_GCM_TAG_BYTES, None):
        return HttpResponseBadRequest()

    message = {
        "id": next_id(room),
        "room": room,
        "user": data["user"],
        "user_iv": data["user_iv"],
        "content": data["content"],
        "iv": data["iv"],
        "timestamp": utc_now_iso()
    }

    try:
        save_message_to_db(message)
    except Exception as e:
        print(f"Save error: {e}")
        return HttpResponseBadRequest()

    return JsonResponse(message)

@csrf_exempt
@require_http_methods(["GET", "POST"])
def messages_api(request, room):
    if request.method == "GET":
        return get_messages(request, room)
    elif request.method == "POST":
        return create_message(request, room)