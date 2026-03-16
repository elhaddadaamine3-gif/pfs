from django.db import migrations
from uuid import uuid4


def forwards_func(apps, schema_editor):
    Corps = apps.get_model("api", "Corps")
    Rank = apps.get_model("api", "Rank")
    Speciality = apps.get_model("api", "Speciality")

    trans_corps, _ = Corps.objects.get_or_create(
        code="TRANS",
        defaults={
            "id_corps": str(uuid4()),
            "label": "Corps des Transmissions",
        },
    )

    ranks = [
        ("SOL2", "Soldat 2ème classe"),
        ("SOL1", "Soldat 1ère classe"),
        ("CPL", "Caporal"),
        ("CPLC", "Caporal-Chef"),
        ("SGT", "Sergent"),
        ("SGTC", "Sergent-Chef"),
        ("ADJ", "Adjudant"),
        ("ADJC", "Adjudant-Chef"),
        ("MAJ", "Major"),
        ("ASPR", "Aspirant"),
        ("SLTL", "Sous-Lieutenant"),
        ("LTN", "Lieutenant"),
        ("CPT", "Capitaine"),
        ("CDT", "Commandant"),
        ("LTNCL", "Lieutenant-Colonel"),
        ("COL", "Colonel"),
        ("GENBR", "Général de Brigade"),
        ("GENDV", "Général de Division"),
        ("GENCA", "Général de Corps d'Armée"),
        ("GENA", "Général d'Armée"),
    ]

    for code, label in ranks:
        # Skip if a rank with this code or label already exists (idempotent)
        if Rank.objects.filter(code=code).exists() or Rank.objects.filter(label=label).exists():
            continue
        Rank.objects.create(
            id_rank=str(uuid4()),
            code=code,
            label=label,
            corps=trans_corps,
        )

    specialities = [
        ("SIC", "Systèmes d'Information et de Communication"),
        ("RT", "Réseaux et Télécommunications"),
        ("CC", "Cryptologie et Cybersécurité"),
        ("GE", "Guerre Électronique"),
        ("MET", "Maintenance des Équipements de Transmission"),
        ("SR", "Systèmes Radio"),
        ("ER", "Exploitation des Réseaux"),
    ]

    for code, label in specialities:
        # Skip if a speciality with this code or label already exists (idempotent)
        if Speciality.objects.filter(code=code).exists() or Speciality.objects.filter(label=label).exists():
            continue
        Speciality.objects.create(
            id_speciality=str(uuid4()),
            code=code,
            label=label,
            corps=trans_corps,
        )


def reverse_func(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0008_controle_fichier_enonce"),
    ]

    operations = [
        migrations.RunPython(forwards_func, reverse_func),
    ]
