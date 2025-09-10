from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='NukedRoom',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('room', models.CharField(max_length=16, unique=True)),
                ('nuked_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-nuked_at'],
            },
        ),
    ]
