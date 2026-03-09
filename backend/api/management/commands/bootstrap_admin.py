import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from api.models import Corps, Rank, Speciality, UserProfile


class Command(BaseCommand):
    help = "Create or update a bootstrap admin account and sync its profile role."

    def add_arguments(self, parser):
        parser.add_argument("--username", default=os.getenv("DJANGO_ADMIN_USERNAME", "admin"))
        parser.add_argument("--email", default=os.getenv("DJANGO_ADMIN_EMAIL", "admin@example.com"))
        parser.add_argument("--password", default=os.getenv("DJANGO_ADMIN_PASSWORD"))
        parser.add_argument("--matricule", default=os.getenv("DJANGO_ADMIN_MATRICULE", "ADM-0001"))

    def handle(self, *args, **options):
        username = options["username"]
        email = options["email"]
        password = options["password"]
        matricule = options["matricule"]

        if not password:
            raise CommandError(
                "Admin password is required. Use --password or set DJANGO_ADMIN_PASSWORD."
            )

        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )

        changed_fields = []
        if user.email != email:
            user.email = email
            changed_fields.append("email")
        if not user.is_staff:
            user.is_staff = True
            changed_fields.append("is_staff")
        if not user.is_superuser:
            user.is_superuser = True
            changed_fields.append("is_superuser")
        if not user.is_active:
            user.is_active = True
            changed_fields.append("is_active")

        user.set_password(password)
        changed_fields.append("password")
        user.save(update_fields=list(dict.fromkeys(changed_fields)))

        profile, _ = UserProfile.objects.get_or_create(user=user)
        corps = Corps.objects.order_by("label").first()
        rank = Rank.objects.filter(corps=corps).order_by("label").first() if corps else None
        speciality = Speciality.objects.order_by("label").first()
        profile.role = UserProfile.ROLE_ADMIN
        profile.est_civil = False
        profile.matricule = matricule
        profile.corps = corps
        profile.rank = rank
        profile.speciality = speciality
        profile.save(update_fields=["role", "matricule", "est_civil", "corps", "rank", "speciality"])

        action = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{action} admin account '{username}' successfully."))
