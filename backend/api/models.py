from django.db import models

class Message(models.Model):
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


class NukedRoom(models.Model):
    room = models.CharField(max_length=16, unique=True)
    nuked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-nuked_at']

    def __str__(self):
        return f"Nuked room {self.room} at {self.nuked_at}"
