import json
from pathlib import Path
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Message, NukedRoom
from django.conf import settings

AES_GCM_IV_BYTES = 12
AES_GCM_TAG_BYTES = 16

CONFIG_PATH = Path(settings.BASE_DIR) / "config.json"
with open(CONFIG_PATH) as f:
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


class MessageConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room = self.scope["url_route"]["kwargs"]["room"]

        if len(self.room) != 32 or await self.room_is_nuked():
            await self.close()
            return

        self.room_group_name = f"room_{self.room}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive_json(self, data):
        if await self.room_is_nuked():
            await self.send_json({
                "type": "room_nuked",
                "room": self.room,
                "deleted_count": await self.get_deleted_count(),
            })
            await self.close()
            return

        if data.get("action") == "fetch":
            since_id = data.get("since_id")
            messages = await self.get_messages(since_id)
            await self.send_json({"type": "history", "messages": messages})
            return

        if data.get("type") == "new_message":
            required_fields = ["user", "user_iv", "content", "iv"]
            if not all(field in data for field in required_fields):
                return

            if (len(data["user"]) > CONFIG.get("max_user_len", 256) or
                len(data["user_iv"]) > CONFIG.get("max_iv_len", 24) or
                len(data["iv"]) > CONFIG.get("max_iv_len", 24) or
                len(data["content"]) > CONFIG.get("max_content_len", 4096)):
                return

            if not valid_hex_len(data["user_iv"], AES_GCM_IV_BYTES, AES_GCM_IV_BYTES):
                return
            if not valid_hex_len(data["iv"], AES_GCM_IV_BYTES, AES_GCM_IV_BYTES):
                return
            if not valid_hex_len(data["content"], AES_GCM_TAG_BYTES):
                return
            if not valid_hex_len(data["user"], AES_GCM_TAG_BYTES):
                return

            message_obj = await self.create_message(
                user=data["user"],
                user_iv=data["user_iv"],
                content=data["content"],
                iv=data["iv"],
            )

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "send_message",
                    "message": {
                        "id": message_obj.id,
                        "room": message_obj.room,
                        "user": message_obj.user,
                        "user_iv": message_obj.user_iv,
                        "content": message_obj.content,
                        "iv": message_obj.iv,
                        "timestamp": message_obj.timestamp.isoformat().replace("+00:00", "Z"),
                    },
                },
            )

    async def send_message(self, event):
        await self.send_json({"type": "message", "message": event["message"]})

    async def room_nuked(self, event):
        await self.send_json({
            "type": "room_nuked",
            "room": event["room"],
            "deleted_count": event["deleted_count"],
        })
        await self.close()

    @database_sync_to_async
    def get_deleted_count(self):
        return NukedRoom.objects.filter(room=self.room).count()

    @database_sync_to_async
    def get_messages(self, since_id=None):
        qs = Message.objects.filter(room=self.room)
        if since_id:
            qs = qs.filter(id__gt=since_id)
        qs = qs.order_by("id")[:100]
        return [
            {
                "id": m.id,
                "room": m.room,
                "user": m.user,
                "user_iv": m.user_iv,
                "content": m.content,
                "iv": m.iv,
                "timestamp": m.timestamp.isoformat().replace("+00:00", "Z"),
            }
            for m in qs
        ]

    @database_sync_to_async
    def create_message(self, user, user_iv, content, iv):
        return Message.objects.create(
            room=self.room,
            user=user,
            user_iv=user_iv,
            content=content,
            iv=iv,
        )

    @database_sync_to_async
    def room_is_nuked(self):
        return NukedRoom.objects.filter(room=self.room).exists()