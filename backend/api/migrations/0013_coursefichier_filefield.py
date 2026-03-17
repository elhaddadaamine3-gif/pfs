import os

from django.db import migrations, models


def migrate_binary_to_files(apps, schema_editor):
    """Write existing BinaryField content to disk files."""
    from django.conf import settings

    CoursFichier = apps.get_model("api", "CoursFichier")
    media_root = settings.MEDIA_ROOT
    dir_path = os.path.join(media_root, "cours_fichiers")
    os.makedirs(dir_path, exist_ok=True)

    for cf in CoursFichier.objects.all():
        if not cf.contenu:
            continue
        ext = os.path.splitext(cf.nom_fichier)[1] if cf.nom_fichier else ".bin"
        file_name = f"{cf.id_cours_fichier}{ext}"
        file_path = os.path.join(dir_path, file_name)
        with open(file_path, "wb") as fh:
            fh.write(bytes(cf.contenu))
        cf.fichier = f"cours_fichiers/{file_name}"
        cf.save(update_fields=["fichier"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0012_matiere"),
    ]

    operations = [
        migrations.AddField(
            model_name="coursfichier",
            name="fichier",
            field=models.FileField(blank=True, null=True, upload_to="cours_fichiers/"),
        ),
        migrations.RunPython(migrate_binary_to_files, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="coursfichier",
            name="contenu",
        ),
    ]
