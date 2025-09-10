from pathlib import Path
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.views.decorators.cache import never_cache
from django.db import transaction
from .models import Message, NukedRoom
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json


def _no_cache_json(data, status=200):
    response = JsonResponse(data, status=status, safe=isinstance(data, dict))
    response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response


@csrf_exempt
@never_cache
@require_http_methods(["POST"])
def nuke_room(request, room):
    if len(room) != 32:
        return HttpResponseBadRequest()

    count_before = Message.objects.filter(room=room).count()
    print(f"[NUKE] room={room} count_before={count_before}")

    try:
        with transaction.atomic():
            deleted_count, deleted_details = Message.objects.filter(room=room).delete()
    except Exception as e:
        print(f"[NUKE] delete error: {e}")
        return _no_cache_json({"error": "delete_failed", "details": str(e)}, status=500)

    NukedRoom.objects.get_or_create(room=room)

    count_after = Message.objects.filter(room=room).count()
    print(f"[NUKE] room={room} deleted_count={deleted_count} count_after={count_after} details={deleted_details}")

    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"room_{room}",
            {"type": "room_nuked", "room": room, "deleted_count": deleted_count},
        )
    except Exception as e:
        print(f"[NUKE] broadcast error: {e}")

    payload = {
        "status": "nuked",
        "deleted_messages_reported": deleted_count,
        "count_before": count_before,
        "count_after": count_after,
        "deleted_details": deleted_details,
    }
    return _no_cache_json(payload, status=200)