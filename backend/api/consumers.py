import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Message


class MessageConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room = self.scope["url_route"]["kwargs"]["room"]

        if len(self.room) != 32:
            await self.close()
            return

        self.room_group_name = f"room_{self.room}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        if data.get("action") == "fetch":
            since_id = data.get("since_id")
            messages = await self.get_messages(since_id)
            await self.send(text_data=json.dumps({
                "type": "history",
                "messages": messages,
            }))

    async def send_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "message",
            "message": event["message"],
        }))

    async def room_nuked(self, event):
        await self.send(text_data=json.dumps({
            "type": "room_nuked",
            "room": event["room"],
            "deleted_count": event["deleted_count"],
        }))

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
