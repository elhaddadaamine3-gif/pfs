from django.db import migrations, models


def seed_specialities_for_corps(apps, schema_editor):
    Corps = apps.get_model("api", "Corps")
    Speciality = apps.get_model("api", "Speciality")

    terre = Corps.objects.filter(code="ARMEE_TERRE").first()
    if not terre:
        return

    for code, label in [
        ("TRANS", "Transmission"),
        ("BLD", "Blindé"),
        ("INF", "Infanterie"),
        ("GEN", "Génie"),
        ("SANTE", "Santé"),
        ("INT", "Intendance"),
        ("PARA", "Para"),
        ("SPORT", "Centre sportif"),
    ]:
        speciality, created = Speciality.objects.get_or_create(
            code=code,
            defaults={"label": label, "corps": terre},
        )
        if not created and speciality.corps_id is None:
            speciality.corps = terre
            speciality.save(update_fields=["corps"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0005_eventaudit"),
    ]

    operations = [
        migrations.AddField(
            model_name="speciality",
            name="corps",
            field=models.ForeignKey(blank=True, null=True, on_delete=models.CASCADE, related_name="specialities", to="api.corps"),
        ),
        migrations.RunPython(seed_specialities_for_corps, migrations.RunPython.noop),
    ]
