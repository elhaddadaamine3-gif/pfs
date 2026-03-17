from django.db import migrations, models
import django.db.models.deletion
from uuid import uuid4


MATIERE_SEED = {
    "Bureautique & Architectures des ordinateurs": [
        (0, "Analyse de données"),
        (1, "Structure & fonctionnement des ordinateurs"),
        (2, "Systèmes d'exploitation"),
    ],
    "Algorithme & Programmation": [
        (0, "Algorithme"),
        (1, "Programmation en langage C"),
        (2, "Structure de données"),
    ],
    "Bases de données & Modélisation": [
        (0, "Système d'information & Merise"),
        (1, "Base de données et langage SQL"),
    ],
    "Système, Réseaux & SSI": [
        (0, "Système d'exploitation Unix"),
        (1, "Réseau informatique"),
        (2, "Fondements SSI"),
    ],
    "Architectures & Développement Web": [
        (0, "Architectures Web"),
        (1, "Développement Web avec HTML et CSS"),
    ],
}


def seed_matieres(apps, schema_editor):
    Module = apps.get_model("api", "Module")
    Matiere = apps.get_model("api", "Matiere")
    for module_nom, matieres in MATIERE_SEED.items():
        module = Module.objects.filter(nom=module_nom).first()
        if not module:
            continue
        for ordre, nom in matieres:
            Matiere.objects.get_or_create(
                nom=nom,
                module=module,
                defaults={"id_matiere": str(uuid4()), "ordre": ordre},
            )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0011_module"),
    ]

    operations = [
        migrations.CreateModel(
            name="Matiere",
            fields=[
                ("id_matiere", models.CharField(default=uuid4, editable=False, max_length=50, primary_key=True, serialize=False)),
                ("nom", models.CharField(max_length=255)),
                ("module", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="matieres", to="api.module")),
                ("ordre", models.IntegerField(default=0)),
            ],
            options={
                "ordering": ["ordre", "nom"],
            },
        ),
        migrations.AddField(
            model_name="cours",
            name="matiere",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="cours",
                to="api.matiere",
            ),
        ),
        migrations.RunPython(seed_matieres, migrations.RunPython.noop),
    ]
