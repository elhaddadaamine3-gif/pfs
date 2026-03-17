from django.db import migrations, models
import django.db.models.deletion
from uuid import uuid4


BROCHURE_SEED = {
    "Systèmes d'exploitation": [
        (0, "Aperçu sur les systèmes d'exploitation"),
        (1, "Système d'exploitation"),
        (2, "Système de gestion des fichiers"),
    ],
    "Développement Web avec HTML et CSS": [
        (0, "Développement web avec HTML et CSS"),
        (1, "Initiation au développement web"),
    ],
}


def seed_brochures(apps, schema_editor):
    Matiere = apps.get_model("api", "Matiere")
    Brochure = apps.get_model("api", "Brochure")
    for matiere_nom, brochures in BROCHURE_SEED.items():
        matiere = Matiere.objects.filter(nom=matiere_nom).first()
        if not matiere:
            continue
        for ordre, nom in brochures:
            Brochure.objects.get_or_create(
                nom=nom,
                matiere=matiere,
                defaults={"id_brochure": str(uuid4()), "ordre": ordre},
            )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0013_coursefichier_filefield"),
    ]

    operations = [
        migrations.CreateModel(
            name="Brochure",
            fields=[
                ("id_brochure", models.CharField(default=uuid4, editable=False, max_length=50, primary_key=True, serialize=False)),
                ("nom", models.CharField(max_length=255)),
                ("matiere", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="brochures", to="api.matiere")),
                ("ordre", models.IntegerField(default=0)),
            ],
            options={"ordering": ["ordre", "nom"]},
        ),
        migrations.AddField(
            model_name="cours",
            name="brochure",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="cours",
                to="api.brochure",
            ),
        ),
        migrations.RunPython(seed_brochures, migrations.RunPython.noop),
    ]
