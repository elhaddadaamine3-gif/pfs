from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0007_fix_role_typos"),
    ]

    operations = [
        migrations.AddField(
            model_name="controle",
            name="fichier_enonce",
            field=models.BinaryField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="controle",
            name="nom_fichier_enonce",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="controle",
            name="mime_type_enonce",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="soumissioncontrole",
            name="nom_fichier_reponse",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="soumissioncontrole",
            name="mime_type_reponse",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
    ]
