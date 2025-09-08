from django.db import models

class Message(models.Model):
    """Represents a message in a chat room."""
    room = models.CharField(max_length=16)
    user = models.TextField()
    user_iv = models.CharField(max_length=24)
    content = models.TextField()
    iv = models.CharField(max_length=24)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"Message {self.id} in room {self.room} at {self.timestamp}"