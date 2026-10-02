import django.db.models.deletion
import django.utils.timezone
import django_mongodb_backend.fields
import src.models.session
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ethos', '0003_split_identity_prompt'),
    ]

    operations = [
        migrations.CreateModel(
            name='BrowserSession',
            fields=[
                ('id', django_mongodb_backend.fields.ObjectIdAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(default=src.models.session.new_session_key, max_length=64, unique=True)),
                ('user_agent', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_seen_at', models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                'db_table': 'sessions',
            },
        ),
        migrations.AddField(
            model_name='conversation',
            name='session',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='conversations', to='ethos.browsersession'),
        ),
    ]
