from django.urls import path
from . import views

urlpatterns = [
    path('messages/<str:room>/', views.messages_api, name='messages_api_slash'),
    path('messages/<str:room>', views.messages_api, name='messages_api_no_slash'),

    path('room/<str:room>/nuke/', views.nuke_room, name='nuke_room_slash'),
    path('room/<str:room>/nuke', views.nuke_room, name='nuke_room_no_slash'),
]
