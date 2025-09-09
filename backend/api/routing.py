from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/messages/(?P<room>[0-9a-fA-F]{16})/$", consumers.MessageConsumer.as_asgi()),
]
