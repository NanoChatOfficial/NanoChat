from django.urls import path
from . import views

urlpatterns = [
    path('messages/<str:room>/', views.messages_api, name='messages_api_slash'),
    path('messages/<str:room>', views.messages_api, name='messages_api_no_slash'),
]
