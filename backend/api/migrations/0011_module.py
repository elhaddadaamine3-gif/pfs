from django.db import migrations, models
import django.db.models.deletion
from uuid import uuid4


MODULE_SEED = [
    (0, "Bureautique & Architectures des ordinateurs"),
    (1, "Algorithme & Programmation"),
    (2, "Bases de données & Modélisation"),
    (3, "Système, Réseaux & SSI"),
    (4, "Architectures & Développement Web"),
]


def seed_modules(apps, schema_editor):
    Module = apps.get_model("api", "Module")
    for ordre, nom in MODULE_SEED:
        Module.objects.get_or_create(nom=nom, defaults={"id_module": str(uuid4()), "ordre": ordre})


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0010_alter_userprofile_role"),
    ]

    operations = [
        migrations.CreateModel(
            name="Module",
            fields=[
                ("id_module", models.CharField(default=uuid4, editable=False, max_length=50, primary_key=True, serialize=False)),
                ("nom", models.CharField(max_length=255)),
                ("ordre", models.IntegerField(default=0)),
            ],
            options={
                "ordering": ["ordre", "nom"],
            },
        ),
        migrations.AddField(
            model_name="cours",
            name="module",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="cours",
                to="api.module",
            ),
        ),
        migrations.RunPython(seed_modules, migrations.RunPython.noop),
    ]
