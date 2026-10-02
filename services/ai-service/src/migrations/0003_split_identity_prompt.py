from django.db import migrations, models

NEW_DEFAULT = 'Keep replies short and conversational, like a chat message. Use plain text; light markdown is fine.\nYou remember the earlier messages of this conversation, so build on them naturally.'
OLD_IDENTITY = 'You are {name}, a friendly assistant living in a Messenger-style chat widget.\n'


def strip_identity(apps, schema_editor):
    """The identity line is now prepended by the model, so drop it from stored prompts."""
    Conversation = apps.get_model('ethos', 'Conversation')
    for conversation in Conversation.objects.filter(system_prompt__startswith=OLD_IDENTITY):
        conversation.system_prompt = conversation.system_prompt[len(OLD_IDENTITY):]
        conversation.save(update_fields=['system_prompt'])


class Migration(migrations.Migration):

    dependencies = [
        ('ethos', '0002_conversation_system_prompt'),
    ]

    operations = [
        migrations.AlterField(
            model_name='conversation',
            name='system_prompt',
            field=models.TextField(default=NEW_DEFAULT, max_length=4000),
        ),
        migrations.RunPython(strip_identity, migrations.RunPython.noop),
    ]
