from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ethos', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='conversation',
            name='system_prompt',
            field=models.TextField(default='You are {name}, a friendly assistant living in a Messenger-style chat widget.\nKeep replies short and conversational, like a chat message. Use plain text; light markdown is fine.\nYou remember the earlier messages of this conversation, so build on them naturally.', max_length=4000),
        ),
    ]
