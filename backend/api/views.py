from pathlib import Path
from datetime import datetime, timedelta
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.dateparse import parse_datetime
from django.utils import timezone
import json

from .models import Message

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

AES_GCM_IV_BYTES = 12
AES_GCM_TAG_BYTES = 16
MAX_LIMIT = 1000

with open(Path(settings.BASE_DIR) / "config.json") as f:
    CONFIG = json.load(f)

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

def cleanup_expired_messages():
    expiration = timedelta(days=30)
    cutoff = timezone.now() - expiration
    deleted_count, _ = Message.objects.filter(timestamp__lt=cutoff).delete()
    if deleted_count > 0:
        print(f"Removed {deleted_count} expired messages")

def get_messages(request, room):
    if len(room) != 16 or not is_hex(room):
        return HttpResponseBadRequest()

    params = {k: v for k, v in request.GET.items() if k in ["since_id", "since_ts", "limit", "sort", "order"]}

    queryset = Message.objects.filter(room=room)

    since_id = params.get("since_id")
    since_ts = params.get("since_ts")
    if since_id:
        try:
            queryset = queryset.filter(id__gt=int(since_id))
        except (ValueError, TypeError):
            pass
    if since_ts:
        try:
            dt = parse_datetime(since_ts)
            if dt:
                queryset = queryset.filter(timestamp__gt=dt)
        except Exception:
            pass

    sort = params.get("sort", "id")
    order = params.get("order", "asc").lower()
    if sort not in ["id", "timestamp"]:
        sort = "id"
    if order not in ["asc", "desc"]:
        order = "asc"
    order_by_field = f'{"-" if order == "desc" else ""}{sort}'
    queryset = queryset.order_by(order_by_field)

    limit = min(int(params.get("limit", 100)), MAX_LIMIT)
    messages = list(queryset[:limit].values())

    for msg in messages:
        if isinstance(msg['timestamp'], datetime):
            msg['timestamp'] = msg['timestamp'].isoformat().replace('+00:00', 'Z')

    return JsonResponse(messages, safe=False)

def broadcast_message(message_obj):
    """
    Send the message to all WebSocket clients connected to the room.
    """
    channel_layer = get_channel_layer()
    message_data = {
        "id": message_obj.id,
        "room": message_obj.room,
        "user": message_obj.user,
        "user_iv": message_obj.user_iv,
        "content": message_obj.content,
        "iv": message_obj.iv,
        "timestamp": message_obj.timestamp.isoformat().replace('+00:00', 'Z')
    }
    async_to_sync(channel_layer.group_send)(
        f"room_{message_obj.room}",
        {"type": "send_message", "message": message_data},
    )

@csrf_exempt
def create_message(request, room):
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

    try:
        message_obj = Message.objects.create(
            room=room,
            user=data["user"],
            user_iv=data["user_iv"],
            content=data["content"],
            iv=data["iv"],
        )
    except Exception as e:
        print(f"Save error: {e}")
        return HttpResponseBadRequest()

    broadcast_message(message_obj)

    message_data = {
        "id": message_obj.id,
        "room": message_obj.room,
        "user": message_obj.user,
        "user_iv": message_obj.user_iv,
        "content": message_obj.content,
        "iv": message_obj.iv,
        "timestamp": message_obj.timestamp.isoformat().replace('+00:00', 'Z')
    }
    return JsonResponse(message_data)

@csrf_exempt
@require_http_methods(["GET", "POST"])
def messages_api(request, room):
    if request.method == "GET":
        return get_messages(request, room)
    elif request.method == "POST":
        return create_message(request, room)
