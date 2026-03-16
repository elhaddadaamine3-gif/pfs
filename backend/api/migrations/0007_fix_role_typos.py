from django.db import migrations


def fix_role_typos(apps, schema_editor):
    UserProfile = apps.get_model("api", "UserProfile")
    UserProfile.objects.filter(role="Stageaire").update(role="Stagiaire")
    UserProfile.objects.filter(role="Corrdinateur").update(role="Coordinateur")


def reverse_fix_role_typos(apps, schema_editor):
    UserProfile = apps.get_model("api", "UserProfile")
    UserProfile.objects.filter(role="Stagiaire").update(role="Stageaire")
    UserProfile.objects.filter(role="Coordinateur").update(role="Corrdinateur")


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0006_speciality_corps"),
    ]

    operations = [
        migrations.RunPython(fix_role_typos, reverse_fix_role_typos),
    ]
