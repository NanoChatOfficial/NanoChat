from django.urls import path
from . import views

urlpatterns = [
    path('room/<str:room>/nuke/', views.nuke_room, name='nuke_room_slash'),
    path('room/<str:room>/nuke', views.nuke_room, name='nuke_room_no_slash'),
]