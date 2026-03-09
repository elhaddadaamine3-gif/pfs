import csv
import io

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.db import models
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AffectationInstructeurClasse,
    AffectationSujetStage,
    Brigade,
    Classe,
    Controle,
    ControleCorrection,
    Corps,
    Cours,
    Evaluation,
    EventAudit,
    Inscription,
    Notification,
    Rank,
    Specialite,
    Speciality,
    StagiaireClasse,
    SoumissionControle,
    UserProfile,
)


def resolve_reference_entities(corps_id, rank_id, speciality_id):
    corps = Corps.objects.filter(id_corps=corps_id).first() if corps_id else None
    rank = Rank.objects.filter(id_rank=rank_id).first() if rank_id else None
    speciality = Speciality.objects.filter(id_speciality=speciality_id).first() if speciality_id else None
    if corps_id and not corps:
        return None, None, None, Response({"detail": "corps not found"}, status=status.HTTP_400_BAD_REQUEST)
    if rank_id and not rank:
        return None, None, None, Response({"detail": "rank not found"}, status=status.HTTP_400_BAD_REQUEST)
    if speciality_id and not speciality:
        return None, None, None, Response({"detail": "speciality not found"}, status=status.HTTP_400_BAD_REQUEST)
    if corps and rank and rank.corps_id != corps.id_corps:
        return None, None, None, Response({"detail": "rank does not belong to selected corps"}, status=status.HTTP_400_BAD_REQUEST)
    return corps, rank, speciality, None


def validate_profile_requirements(role, matricule, est_civil, corps_id, rank_id, speciality_id):
    if role != UserProfile.ROLE_INSTRUCTEUR and est_civil:
        return Response({"detail": "Only instructeur can be civil"}, status=status.HTTP_400_BAD_REQUEST)

    requires_military_profile = not (role == UserProfile.ROLE_INSTRUCTEUR and est_civil)
    if requires_military_profile and not matricule:
        return Response({"detail": "matricule is required for military roles"}, status=status.HTTP_400_BAD_REQUEST)
    if requires_military_profile and (not corps_id or not rank_id or not speciality_id):
        return Response(
            {"detail": "corps, rank and speciality are required for military roles"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


def log_event(
    *,
    request,
    event_type,
    target_type="",
    target_id="",
    message="",
    metadata=None,
):
    actor = getattr(request, "user", None)
    actor_profile = getattr(actor, "profile", None) if actor and getattr(actor, "is_authenticated", False) else None
    EventAudit.objects.create(
        actor=actor if actor and getattr(actor, "is_authenticated", False) else None,
        actor_username=getattr(actor, "username", "") if actor and getattr(actor, "is_authenticated", False) else "",
        actor_role=getattr(actor_profile, "role", "") if actor_profile else "",
        event_type=event_type,
        target_type=target_type,
        target_id=str(target_id) if target_id else "",
        message=message,
        metadata=metadata or {},
    )


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


class PublicReferenceDataView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "corps": [{"id": c.id_corps, "code": c.code, "label": c.label} for c in Corps.objects.all().order_by("label")],
                "ranks": [
                    {"id": r.id_rank, "code": r.code, "label": r.label, "corps_id": r.corps_id}
                    for r in Rank.objects.select_related("corps").all().order_by("corps__label", "label")
                ],
                "specialities": [
                    {"id": s.id_speciality, "code": s.code, "label": s.label}
                    for s in Speciality.objects.all().order_by("label")
                ],
            }
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": profile.role,
                "matricule": profile.matricule,
                "est_civil": profile.est_civil,
                "corps": {"id": profile.corps_id, "label": profile.corps.label} if profile.corps else None,
                "rank": {"id": profile.rank_id, "label": profile.rank.label} if profile.rank else None,
                "speciality": {"id": profile.speciality_id, "label": profile.speciality.label} if profile.speciality else None,
            }
        )


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        email = request.data.get("email", "")
        role = request.data.get("role", UserProfile.ROLE_STAGEAIRE)
        matricule = (request.data.get("matricule") or "").strip()
        est_civil = bool(request.data.get("est_civil", False))
        corps_id = request.data.get("corps_id")
        rank_id = request.data.get("rank_id")
        speciality_id = request.data.get("speciality_id")

        if not username or not password:
            return Response(
                {"detail": "username and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_roles = {choice[0] for choice in UserProfile.ROLE_CHOICES}
        if role not in valid_roles:
            return Response(
                {"detail": "Invalid role"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if role == UserProfile.ROLE_ADMIN:
            return Response(
                {"detail": "Admin profile cannot be created from signup"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        validation_error = validate_profile_requirements(role, matricule, est_civil, corps_id, rank_id, speciality_id)
        if validation_error:
            return validation_error

        corps, rank, speciality, references_error = resolve_reference_entities(corps_id, rank_id, speciality_id)
        if references_error:
            return references_error

        user_model = get_user_model()
        try:
            user = user_model.objects.create_user(
                username=username,
                password=password,
                email=email,
            )
        except IntegrityError:
            return Response(
                {"detail": "Username already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        UserProfile.objects.create(
            user=user,
            role=role,
            matricule=matricule,
            est_civil=est_civil,
            corps=corps,
            rank=rank,
            speciality=speciality,
        )
        log_event(
            request=request,
            event_type="signup.created",
            target_type="user",
            target_id=user.id,
            message=f"Signup created user {user.username}",
            metadata={"role": role, "est_civil": est_civil},
        )
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": role,
                "matricule": matricule,
                "est_civil": est_civil,
                "corps_id": corps.id_corps if corps else None,
                "rank_id": rank.id_rank if rank else None,
                "speciality_id": speciality.id_speciality if speciality else None,
            },
            status=status.HTTP_201_CREATED,
        )


class InstructeurDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_INSTRUCTEUR:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        classes = (
            AffectationInstructeurClasse.objects.filter(instructeur=request.user)
            .filter(Q(date_fin__isnull=True) | Q(date_fin__gte=timezone.now().date()))
            .select_related("classe", "classe__brigade")
        )
        cours_queryset = Cours.objects.filter(instructeur=request.user)
        controles_queryset = Controle.objects.filter(instructeur=request.user)
        pending_corrections = SoumissionControle.objects.filter(
            controle__instructeur=request.user
        ).filter(evaluation__isnull=True)
        sujets = AffectationSujetStage.objects.filter(encadrant=request.user)
        unread_notifications = Notification.objects.filter(destinataire=request.user, est_lue=False)

        return Response(
            {
                "role": profile.role,
                "classes_count": classes.count(),
                "classes": [
                    {
                        "code": item.classe.code_classe,
                        "label": item.classe.libelle,
                        "brigade": item.classe.brigade.code_brigade,
                    }
                    for item in classes[:10]
                ],
                "cours": {
                    "total": cours_queryset.count(),
                    "published": cours_queryset.filter(statut=Cours.STATUT_PUBLIE).count(),
                },
                "cours_list": [
                    {"id": c.id_cours, "title": c.titre, "status": c.statut}
                    for c in cours_queryset.order_by("-date_depot")[:20]
                ],
                "controles": {
                    "total": controles_queryset.count(),
                    "published": controles_queryset.filter(statut=Controle.STATUT_PUBLIE).count(),
                    "pending_corrections": pending_corrections.count(),
                },
                "controles_list": [
                    {
                        "id": c.id_controle,
                        "name": c.nom,
                        "status": c.statut,
                        "cours_title": c.cours.titre,
                        "deadline": c.date_limite,
                    }
                    for c in controles_queryset.select_related("cours").order_by("-id_controle")[:20]
                ],
                "pending_submissions": [
                    {
                        "soumission_id": s.id_soumission,
                        "controle_id": s.controle_id,
                        "controle_name": s.controle.nom,
                        "stagiaire_id": s.stagiaire_id,
                        "submitted_at": s.date_soumission,
                    }
                    for s in pending_corrections.select_related("controle").order_by("-date_soumission")[:20]
                ],
                "sujets_fin_stage": {
                    "total": sujets.count(),
                    "active": sujets.filter(etat=AffectationSujetStage.ETAT_EN_COURS).count(),
                    "list": [
                        {
                            "sujet": s.sujet.titre,
                            "stagiaire_id": s.stagiaire_id,
                            "etat": s.etat,
                        }
                        for s in sujets.select_related("sujet").order_by("-date_affectation")[:20]
                    ],
                },
                "notifications": {
                    "unread_count": unread_notifications.count(),
                    "latest": [
                        {
                            "id": n.id_notification,
                            "title": n.titre,
                            "type": n.type_notification,
                            "created_at": n.date_creation,
                        }
                        for n in unread_notifications.order_by("-date_creation")[:10]
                    ],
                },
            }
        )


class StageaireDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_STAGEAIRE:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        active_inscriptions = Inscription.objects.filter(
            stagiaire=request.user,
            statut=Inscription.STATUT_ACTIVE,
        ).select_related("cours")
        controle_ids = Controle.objects.filter(
            cours__in=active_inscriptions.values_list("cours_id", flat=True),
            statut=Controle.STATUT_PUBLIE,
        )
        soumissions = SoumissionControle.objects.filter(stagiaire=request.user).select_related("controle")
        notes = Evaluation.objects.filter(
            soumission__stagiaire=request.user,
            est_publiee=True,
        ).select_related("soumission", "soumission__controle")
        unread_notifications = Notification.objects.filter(destinataire=request.user, est_lue=False)

        return Response(
            {
                "role": profile.role,
                "classes": [
                    {
                        "classe_code": s.classe.code_classe,
                        "classe_label": s.classe.libelle,
                        "brigade_code": s.classe.brigade.code_brigade,
                        "brigade_label": s.classe.brigade.libelle,
                    }
                    for s in StagiaireClasse.objects.filter(stagiaire=request.user)
                    .filter(Q(date_fin__isnull=True) | Q(date_fin__gte=timezone.now().date()))
                    .select_related("classe", "classe__brigade")[:10]
                ],
                "controls": {
                    "available_count": controle_ids.count(),
                    "submitted_count": soumissions.count(),
                    "pending_count": max(controle_ids.count() - soumissions.count(), 0),
                },
                "controls_list": [
                    {
                        "id": c.id_controle,
                        "name": c.nom,
                        "deadline": c.date_limite,
                        "cours": c.cours.titre,
                    }
                    for c in controle_ids.select_related("cours").order_by("date_limite")[:20]
                ],
                "submitted_control_ids": list(soumissions.values_list("controle_id", flat=True)),
                "notes": [
                    {
                        "controle": note.soumission.controle.nom,
                        "note": note.note,
                        "published_at": note.date_publication,
                    }
                    for note in notes.order_by("-date_publication")[:20]
                ],
                "notifications": {
                    "unread_count": unread_notifications.count(),
                    "latest": [
                        {
                            "id": n.id_notification,
                            "title": n.titre,
                            "type": n.type_notification,
                            "created_at": n.date_creation,
                        }
                        for n in unread_notifications.order_by("-date_creation")[:10]
                    ],
                },
            }
        )


class SuperviseurDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_SUPERVISEUR:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.now().date()
        classes_data = []
        for classe in Classe.objects.select_related("brigade").all()[:100]:
            stagiaires_ids = list(
                StagiaireClasse.objects.filter(classe=classe)
                .filter(Q(date_fin__isnull=True) | Q(date_fin__gte=today))
                .values_list("stagiaire_id", flat=True)
            )
            controles_qs = Controle.objects.filter(cours__inscriptions__stagiaire_id__in=stagiaires_ids).distinct()
            notes_qs = Evaluation.objects.filter(
                soumission__stagiaire_id__in=stagiaires_ids,
                est_publiee=True,
            )
            avg_note = notes_qs.aggregate(avg=models.Avg("note"))["avg"]

            classes_data.append(
                {
                    "classe_code": classe.code_classe,
                    "brigade_code": classe.brigade.code_brigade,
                    "stagiaires_count": len(stagiaires_ids),
                    "controles_count": controles_qs.count(),
                    "notes_published_count": notes_qs.count(),
                    "note_moyenne": round(float(avg_note), 2) if avg_note is not None else None,
                }
            )

        return Response(
            {
                "role": profile.role,
                "monitoring": {
                    "classes_count": Classe.objects.count(),
                    "brigades_count": Brigade.objects.count(),
                    "controles_count": Controle.objects.count(),
                    "published_notes_count": Evaluation.objects.filter(est_publiee=True).count(),
                },
                "classes": classes_data,
                "notifications": {
                    "unread_count": Notification.objects.filter(destinataire=request.user, est_lue=False).count(),
                },
            }
        )


class CoordinateurDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_COORDINATEUR:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        brigades_data = []
        for brigade in Brigade.objects.all()[:100]:
            classes = Classe.objects.filter(brigade=brigade)
            class_ids = list(classes.values_list("id_classe", flat=True))
            stagiaires_ids = list(
                StagiaireClasse.objects.filter(classe_id__in=class_ids).values_list("stagiaire_id", flat=True)
            )
            notes_qs = Evaluation.objects.filter(soumission__stagiaire_id__in=stagiaires_ids, est_publiee=True)
            avg_note = notes_qs.aggregate(avg=models.Avg("note"))["avg"]
            brigades_data.append(
                {
                    "brigade_code": brigade.code_brigade,
                    "classes_count": classes.count(),
                    "stagiaires_count": len(set(stagiaires_ids)),
                    "published_notes_count": notes_qs.count(),
                    "note_moyenne": round(float(avg_note), 2) if avg_note is not None else None,
                }
            )

        return Response(
            {
                "role": profile.role,
                "monitoring": {
                    "brigades": brigades_data,
                    "controls_total": Controle.objects.count(),
                    "controls_published": Controle.objects.filter(statut=Controle.STATUT_PUBLIE).count(),
                    "notes_published": Evaluation.objects.filter(est_publiee=True).count(),
                },
                "notifications": {
                    "unread_count": Notification.objects.filter(destinataire=request.user, est_lue=False).count(),
                },
            }
        )


class AdminDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        users = get_user_model().objects.all().order_by("-date_joined")[:100]
        return Response(
            {
                "role": profile.role,
                "platform": {
                    "users_total": get_user_model().objects.count(),
                    "users_active": get_user_model().objects.filter(is_active=True).count(),
                    "cours_total": Cours.objects.count(),
                    "controles_total": Controle.objects.count(),
                    "soumissions_total": SoumissionControle.objects.count(),
                },
                "users": [
                    {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "is_active": user.is_active,
                        "role": getattr(getattr(user, "profile", None), "role", ""),
                    }
                    for user in users
                ],
            }
        )


class AdminToggleUserStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        user_model = get_user_model()
        target = user_model.objects.filter(id=user_id).first()
        if not target:
            return Response({"detail": "user not found"}, status=status.HTTP_404_NOT_FOUND)
        if target.id == request.user.id:
            return Response({"detail": "cannot disable self"}, status=status.HTTP_400_BAD_REQUEST)

        target.is_active = not target.is_active
        target.save(update_fields=["is_active"])
        log_event(
            request=request,
            event_type="admin.user.toggled",
            target_type="user",
            target_id=target.id,
            message=f"Admin toggled active status for {target.username}",
            metadata={"is_active": target.is_active},
        )
        return Response({"id": target.id, "is_active": target.is_active})


class AdminCreateAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        username = (request.data.get("username") or "").strip()
        email = (request.data.get("email") or "").strip()
        password = request.data.get("password")
        role = request.data.get("role")
        matricule = (request.data.get("matricule") or "").strip()
        est_civil = bool(request.data.get("est_civil", False))
        corps_id = request.data.get("corps_id")
        rank_id = request.data.get("rank_id")
        speciality_id = request.data.get("speciality_id")

        valid_roles = {choice[0] for choice in UserProfile.ROLE_CHOICES}
        if not username or not password or not role:
            return Response({"detail": "username, password and role are required"}, status=status.HTTP_400_BAD_REQUEST)
        if role not in valid_roles:
            return Response({"detail": "Invalid role"}, status=status.HTTP_400_BAD_REQUEST)
        validation_error = validate_profile_requirements(role, matricule, est_civil, corps_id, rank_id, speciality_id)
        if validation_error:
            return validation_error

        corps, rank, speciality, references_error = resolve_reference_entities(corps_id, rank_id, speciality_id)
        if references_error:
            return references_error

        user_model = get_user_model()
        if user_model.objects.filter(username=username).exists():
            return Response({"detail": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

        user = user_model.objects.create_user(username=username, email=email, password=password)
        if role == UserProfile.ROLE_ADMIN:
            user.is_staff = True
            user.is_superuser = True
            user.save(update_fields=["is_staff", "is_superuser"])

        UserProfile.objects.create(
            user=user,
            role=role,
            matricule=matricule,
            est_civil=est_civil,
            corps=corps,
            rank=rank,
            speciality=speciality,
        )
        log_event(
            request=request,
            event_type="admin.account.created",
            target_type="user",
            target_id=user.id,
            message=f"Admin created account {user.username}",
            metadata={"role": role, "est_civil": est_civil},
        )
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": role,
                "matricule": matricule,
                "est_civil": est_civil,
                "corps_id": corps.id_corps if corps else None,
                "rank_id": rank.id_rank if rank else None,
                "speciality_id": speciality.id_speciality if speciality else None,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminBulkCreateAccountsCsvView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        csv_content = request.data.get("csv_content")
        if not csv_content:
            return Response({"detail": "csv_content is required"}, status=status.HTTP_400_BAD_REQUEST)

        reader = csv.DictReader(io.StringIO(csv_content))
        expected = {"username", "email", "password", "role", "matricule", "est_civil", "corps_id", "rank_id", "speciality_id"}
        if not reader.fieldnames or set(reader.fieldnames) != expected:
            return Response(
                {
                    "detail": "CSV headers must be: username,email,password,role,matricule,est_civil,corps_id,rank_id,speciality_id"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_roles = {choice[0] for choice in UserProfile.ROLE_CHOICES}
        user_model = get_user_model()
        created = []
        errors = []

        for idx, row in enumerate(reader, start=2):
            username = (row.get("username") or "").strip()
            email = (row.get("email") or "").strip()
            password = row.get("password") or ""
            role = (row.get("role") or "").strip()
            matricule = (row.get("matricule") or "").strip()
            est_civil = (row.get("est_civil") or "").strip().lower() in {"1", "true", "yes", "y"}
            corps_id = (row.get("corps_id") or "").strip()
            rank_id = (row.get("rank_id") or "").strip()
            speciality_id = (row.get("speciality_id") or "").strip()

            if not username or not password or not role:
                errors.append({"line": idx, "error": "username, password and role are required"})
                continue
            if role not in valid_roles:
                errors.append({"line": idx, "error": "Invalid role"})
                continue
            validation_error = validate_profile_requirements(
                role=role,
                matricule=matricule,
                est_civil=est_civil,
                corps_id=corps_id,
                rank_id=rank_id,
                speciality_id=speciality_id,
            )
            if validation_error:
                errors.append({"line": idx, "error": validation_error.data.get("detail", "invalid profile data")})
                continue
            corps, rank, speciality, references_error = resolve_reference_entities(corps_id, rank_id, speciality_id)
            if references_error:
                errors.append({"line": idx, "error": references_error.data.get("detail", "invalid references")})
                continue
            if user_model.objects.filter(username=username).exists():
                errors.append({"line": idx, "error": "Username already exists"})
                continue

            user = user_model.objects.create_user(username=username, email=email, password=password)
            if role == UserProfile.ROLE_ADMIN:
                user.is_staff = True
                user.is_superuser = True
                user.save(update_fields=["is_staff", "is_superuser"])
            UserProfile.objects.create(
                user=user,
                role=role,
                matricule=matricule,
                est_civil=est_civil,
                corps=corps,
                rank=rank,
                speciality=speciality,
            )
            created.append({"username": username, "role": role})

        if created or errors:
            log_event(
                request=request,
                event_type="admin.account.bulk_csv",
                target_type="users",
                message="Admin bulk account import",
                metadata={"created_count": len(created), "error_count": len(errors)},
            )

        return Response(
            {
                "created_count": len(created),
                "error_count": len(errors),
                "created": created,
                "errors": errors,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST,
        )


class AdminReferenceDataView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)
        return Response(
            {
                "corps": [{"id": c.id_corps, "code": c.code, "label": c.label} for c in Corps.objects.all().order_by("label")],
                "ranks": [
                    {"id": r.id_rank, "code": r.code, "label": r.label, "corps_id": r.corps_id}
                    for r in Rank.objects.select_related("corps").all().order_by("corps__label", "label")
                ],
                "specialities": [
                    {"id": s.id_speciality, "code": s.code, "label": s.label}
                    for s in Speciality.objects.all().order_by("label")
                ],
            }
        )


class AdminEventsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)
        limit = int(request.query_params.get("limit", 100))
        limit = max(1, min(limit, 300))
        events = EventAudit.objects.all()[:limit]
        return Response(
            {
                "events": [
                    {
                        "id": event.id_event,
                        "created_at": event.created_at,
                        "actor_username": event.actor_username,
                        "actor_role": event.actor_role,
                        "event_type": event.event_type,
                        "target_type": event.target_type,
                        "target_id": event.target_id,
                        "message": event.message,
                        "metadata": event.metadata,
                    }
                    for event in events
                ]
            }
        )


class AdminCorpsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)
        code = (request.data.get("code") or "").strip()
        label = (request.data.get("label") or "").strip()
        if not code or not label:
            return Response({"detail": "code and label are required"}, status=status.HTTP_400_BAD_REQUEST)
        if Corps.objects.filter(models.Q(code__iexact=code) | models.Q(label__iexact=label)).exists():
            return Response({"detail": "corps already exists"}, status=status.HTTP_400_BAD_REQUEST)
        corps = Corps.objects.create(code=code, label=label)
        log_event(
            request=request,
            event_type="admin.reference.corps.created",
            target_type="corps",
            target_id=corps.id_corps,
            message=f"Admin created corps {corps.label}",
        )
        return Response({"id": corps.id_corps, "code": corps.code, "label": corps.label}, status=status.HTTP_201_CREATED)

    def patch(self, request, corps_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)
        corps = Corps.objects.filter(id_corps=corps_id).first()
        if not corps:
            return Response({"detail": "corps not found"}, status=status.HTTP_404_NOT_FOUND)
        code = (request.data.get("code") or corps.code).strip()
        label = (request.data.get("label") or corps.label).strip()
        duplicate = Corps.objects.exclude(id_corps=corps_id).filter(models.Q(code__iexact=code) | models.Q(label__iexact=label)).exists()
        if duplicate:
            return Response({"detail": "corps already exists"}, status=status.HTTP_400_BAD_REQUEST)
        corps.code = code
        corps.label = label
        corps.save(update_fields=["code", "label"])
        log_event(
            request=request,
            event_type="admin.reference.corps.updated",
            target_type="corps",
            target_id=corps.id_corps,
            message=f"Admin updated corps {corps.label}",
        )
        return Response({"id": corps.id_corps, "code": corps.code, "label": corps.label})


class AdminRanksView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)
        code = (request.data.get("code") or "").strip()
        label = (request.data.get("label") or "").strip()
        corps_id = request.data.get("corps_id")
        if not code or not label or not corps_id:
            return Response({"detail": "code, label and corps_id are required"}, status=status.HTTP_400_BAD_REQUEST)
        corps = Corps.objects.filter(id_corps=corps_id).first()
        if not corps:
            return Response({"detail": "corps not found"}, status=status.HTTP_400_BAD_REQUEST)
        if Rank.objects.filter(models.Q(code__iexact=code) | (models.Q(label__iexact=label) & models.Q(corps=corps))).exists():
            return Response({"detail": "rank already exists"}, status=status.HTTP_400_BAD_REQUEST)
        rank = Rank.objects.create(code=code, label=label, corps=corps)
        log_event(
            request=request,
            event_type="admin.reference.rank.created",
            target_type="rank",
            target_id=rank.id_rank,
            message=f"Admin created rank {rank.label}",
            metadata={"corps_id": rank.corps_id},
        )
        return Response(
            {"id": rank.id_rank, "code": rank.code, "label": rank.label, "corps_id": rank.corps_id},
            status=status.HTTP_201_CREATED,
        )

    def patch(self, request, rank_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)
        rank = Rank.objects.filter(id_rank=rank_id).first()
        if not rank:
            return Response({"detail": "rank not found"}, status=status.HTTP_404_NOT_FOUND)
        target_corps = rank.corps
        if request.data.get("corps_id"):
            target_corps = Corps.objects.filter(id_corps=request.data.get("corps_id")).first()
            if not target_corps:
                return Response({"detail": "corps not found"}, status=status.HTTP_400_BAD_REQUEST)
        code = (request.data.get("code") or rank.code).strip()
        label = (request.data.get("label") or rank.label).strip()
        duplicate = Rank.objects.exclude(id_rank=rank_id).filter(
            models.Q(code__iexact=code) | (models.Q(label__iexact=label) & models.Q(corps=target_corps))
        ).exists()
        if duplicate:
            return Response({"detail": "rank already exists"}, status=status.HTTP_400_BAD_REQUEST)
        rank.code = code
        rank.label = label
        rank.corps = target_corps
        rank.save(update_fields=["code", "label", "corps"])
        log_event(
            request=request,
            event_type="admin.reference.rank.updated",
            target_type="rank",
            target_id=rank.id_rank,
            message=f"Admin updated rank {rank.label}",
            metadata={"corps_id": rank.corps_id},
        )
        return Response({"id": rank.id_rank, "code": rank.code, "label": rank.label, "corps_id": rank.corps_id})


class AdminSpecialitiesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)
        code = (request.data.get("code") or "").strip()
        label = (request.data.get("label") or "").strip()
        if not code or not label:
            return Response({"detail": "code and label are required"}, status=status.HTTP_400_BAD_REQUEST)
        if Speciality.objects.filter(models.Q(code__iexact=code) | models.Q(label__iexact=label)).exists():
            return Response({"detail": "speciality already exists"}, status=status.HTTP_400_BAD_REQUEST)
        speciality = Speciality.objects.create(code=code, label=label)
        log_event(
            request=request,
            event_type="admin.reference.speciality.created",
            target_type="speciality",
            target_id=speciality.id_speciality,
            message=f"Admin created speciality {speciality.label}",
        )
        return Response(
            {"id": speciality.id_speciality, "code": speciality.code, "label": speciality.label},
            status=status.HTTP_201_CREATED,
        )

    def patch(self, request, speciality_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)
        speciality = Speciality.objects.filter(id_speciality=speciality_id).first()
        if not speciality:
            return Response({"detail": "speciality not found"}, status=status.HTTP_404_NOT_FOUND)
        code = (request.data.get("code") or speciality.code).strip()
        label = (request.data.get("label") or speciality.label).strip()
        duplicate = Speciality.objects.exclude(id_speciality=speciality_id).filter(
            models.Q(code__iexact=code) | models.Q(label__iexact=label)
        ).exists()
        if duplicate:
            return Response({"detail": "speciality already exists"}, status=status.HTTP_400_BAD_REQUEST)
        speciality.code = code
        speciality.label = label
        speciality.save(update_fields=["code", "label"])
        log_event(
            request=request,
            event_type="admin.reference.speciality.updated",
            target_type="speciality",
            target_id=speciality.id_speciality,
            message=f"Admin updated speciality {speciality.label}",
        )
        return Response({"id": speciality.id_speciality, "code": speciality.code, "label": speciality.label})


class AdminSubjectsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        return Response(
            {
                "subjects": [
                    {"id": s.id_specialite, "label": s.libelle}
                    for s in Specialite.objects.all().order_by("libelle")
                ]
            }
        )

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        label = (request.data.get("label") or "").strip()
        if not label:
            return Response({"detail": "label is required"}, status=status.HTTP_400_BAD_REQUEST)
        if Specialite.objects.filter(libelle__iexact=label).exists():
            return Response({"detail": "subject already exists"}, status=status.HTTP_400_BAD_REQUEST)

        subject = Specialite.objects.create(libelle=label)
        log_event(
            request=request,
            event_type="admin.subject.created",
            target_type="subject",
            target_id=subject.id_specialite,
            message=f"Admin created subject {subject.libelle}",
        )
        return Response({"id": subject.id_specialite, "label": subject.libelle}, status=status.HTTP_201_CREATED)


class AdminSubjectControlsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, subject_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        subject = Specialite.objects.filter(id_specialite=subject_id).first()
        if not subject:
            return Response({"detail": "subject not found"}, status=status.HTTP_404_NOT_FOUND)

        controls = (
            Controle.objects.filter(cours__specialite=subject)
            .select_related("cours", "instructeur")
            .order_by("-id_controle")
        )
        return Response(
            {
                "subject": {"id": subject.id_specialite, "label": subject.libelle},
                "controls": [
                    {
                        "id": c.id_controle,
                        "name": c.nom,
                        "status": c.statut,
                        "cours_id": c.cours_id,
                        "cours_title": c.cours.titre,
                        "instructeur_username": c.instructeur.username,
                        "deadline": c.date_limite,
                    }
                    for c in controls[:200]
                ],
            }
        )


class AdminSubjectCoursesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, subject_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        subject = Specialite.objects.filter(id_specialite=subject_id).first()
        if not subject:
            return Response({"detail": "subject not found"}, status=status.HTTP_404_NOT_FOUND)

        courses = (
            Cours.objects.filter(specialite=subject)
            .select_related("instructeur")
            .order_by("-date_depot")
        )
        return Response(
            {
                "subject": {"id": subject.id_specialite, "label": subject.libelle},
                "courses": [
                    {
                        "id": c.id_cours,
                        "title": c.titre,
                        "status": c.statut,
                        "instructeur_username": c.instructeur.username,
                        "date_depot": c.date_depot,
                    }
                    for c in courses[:200]
                ],
            }
        )


class AdminUpdateControlStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, controle_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        controle = Controle.objects.filter(id_controle=controle_id).first()
        if not controle:
            return Response({"detail": "controle not found"}, status=status.HTTP_404_NOT_FOUND)

        target_status = request.data.get("status")
        valid_status = {choice[0] for choice in Controle.STATUT_CHOICES}
        if target_status not in valid_status:
            return Response({"detail": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)

        controle.statut = target_status
        if target_status == Controle.STATUT_PUBLIE and controle.date_publication is None:
            controle.date_publication = timezone.now()
            controle.save(update_fields=["statut", "date_publication"])
        else:
            controle.save(update_fields=["statut"])
        log_event(
            request=request,
            event_type="admin.controle.status_updated",
            target_type="controle",
            target_id=controle.id_controle,
            message=f"Admin updated controle status to {target_status}",
        )
        return Response({"id": controle.id_controle, "status": controle.statut})


class AdminUpdateCourseStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, cours_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        cours = Cours.objects.filter(id_cours=cours_id).first()
        if not cours:
            return Response({"detail": "cours not found"}, status=status.HTTP_404_NOT_FOUND)

        target_status = request.data.get("status")
        valid_status = {choice[0] for choice in Cours.STATUT_CHOICES}
        if target_status not in valid_status:
            return Response({"detail": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)

        cours.statut = target_status
        cours.save(update_fields=["statut"])
        log_event(
            request=request,
            event_type="admin.cours.status_updated",
            target_type="cours",
            target_id=cours.id_cours,
            message=f"Admin updated cours status to {target_status}",
        )
        return Response({"id": cours.id_cours, "status": cours.statut})


class AdminClassesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.now().date()
        classes_payload = []
        for classe in Classe.objects.select_related("brigade").all().order_by("code_classe"):
            instructeur_links = (
                AffectationInstructeurClasse.objects.filter(classe=classe)
                .filter(Q(date_fin__isnull=True) | Q(date_fin__gte=today))
                .select_related("instructeur")
            )
            stageaire_links = (
                StagiaireClasse.objects.filter(classe=classe)
                .filter(Q(date_fin__isnull=True) | Q(date_fin__gte=today))
                .select_related("stagiaire")
            )
            classes_payload.append(
                {
                    "id": classe.id_classe,
                    "code": classe.code_classe,
                    "label": classe.libelle,
                    "brigade": {
                        "code": classe.brigade.code_brigade,
                        "label": classe.brigade.libelle,
                    },
                    "instructeurs": [
                        {"id": link.instructeur.id, "username": link.instructeur.username}
                        for link in instructeur_links
                    ],
                    "stageaires": [
                        {"id": link.stagiaire.id, "username": link.stagiaire.username}
                        for link in stageaire_links
                    ],
                }
            )

        return Response({"classes": classes_payload})

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        code_classe = (request.data.get("code_classe") or "").strip()
        libelle = (request.data.get("libelle") or "").strip()
        brigade_code = (request.data.get("brigade_code") or "").strip()
        brigade_label = (request.data.get("brigade_label") or "").strip() or brigade_code

        if not code_classe or not libelle or not brigade_code:
            return Response(
                {"detail": "code_classe, libelle and brigade_code are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if Classe.objects.filter(code_classe=code_classe).exists():
            return Response({"detail": "class already exists"}, status=status.HTTP_400_BAD_REQUEST)

        brigade, created = Brigade.objects.get_or_create(
            code_brigade=brigade_code,
            defaults={"libelle": brigade_label},
        )
        if not created and brigade_label and brigade.libelle != brigade_label:
            brigade.libelle = brigade_label
            brigade.save(update_fields=["libelle"])

        classe = Classe.objects.create(code_classe=code_classe, libelle=libelle, brigade=brigade)
        log_event(
            request=request,
            event_type="admin.class.created",
            target_type="class",
            target_id=classe.id_classe,
            message=f"Admin created class {classe.code_classe}",
            metadata={"brigade_code": brigade.code_brigade},
        )
        return Response(
            {
                "id": classe.id_classe,
                "code": classe.code_classe,
                "label": classe.libelle,
                "brigade": {"code": brigade.code_brigade, "label": brigade.libelle},
            },
            status=status.HTTP_201_CREATED,
        )


class AdminAssignStageaireToClassView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, class_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        classe = Classe.objects.filter(id_classe=class_id).first()
        if not classe:
            return Response({"detail": "class not found"}, status=status.HTTP_404_NOT_FOUND)

        stageaire_id = request.data.get("stageaire_id")
        if not stageaire_id:
            return Response({"detail": "stageaire_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        user_model = get_user_model()
        stageaire = user_model.objects.filter(id=stageaire_id).first()
        if not stageaire:
            return Response({"detail": "stageaire not found"}, status=status.HTTP_404_NOT_FOUND)
        if getattr(getattr(stageaire, "profile", None), "role", None) != UserProfile.ROLE_STAGEAIRE:
            return Response({"detail": "target user is not Stageaire"}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.now().date()
        StagiaireClasse.objects.filter(stagiaire=stageaire, date_fin__isnull=True).exclude(classe=classe).update(date_fin=today)

        assignment, created = StagiaireClasse.objects.get_or_create(
            stagiaire=stageaire,
            classe=classe,
            date_fin__isnull=True,
            defaults={"date_debut": today},
        )
        if not created:
            return Response(
                {"assignment_id": assignment.id_stagiaire_classe, "status": "already_assigned"},
                status=status.HTTP_200_OK,
            )

        log_event(
            request=request,
            event_type="admin.class.stageaire_assigned",
            target_type="class",
            target_id=classe.id_classe,
            message=f"Stageaire assigned to class {classe.code_classe}",
            metadata={"stageaire_id": stageaire.id},
        )

        return Response(
            {"assignment_id": assignment.id_stagiaire_classe, "status": "assigned"},
            status=status.HTTP_201_CREATED,
        )


class AdminAssignInstructeurToClassView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, class_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_ADMIN:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        classe = Classe.objects.filter(id_classe=class_id).first()
        if not classe:
            return Response({"detail": "class not found"}, status=status.HTTP_404_NOT_FOUND)

        instructeur_id = request.data.get("instructeur_id")
        if not instructeur_id:
            return Response({"detail": "instructeur_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        user_model = get_user_model()
        instructeur = user_model.objects.filter(id=instructeur_id).first()
        if not instructeur:
            return Response({"detail": "instructeur not found"}, status=status.HTTP_404_NOT_FOUND)
        if getattr(getattr(instructeur, "profile", None), "role", None) != UserProfile.ROLE_INSTRUCTEUR:
            return Response({"detail": "target user is not Instructeur"}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.now().date()
        assignment, created = AffectationInstructeurClasse.objects.get_or_create(
            instructeur=instructeur,
            classe=classe,
            date_debut=today,
            defaults={"date_fin": None},
        )
        if created:
            log_event(
                request=request,
                event_type="admin.class.instructeur_assigned",
                target_type="class",
                target_id=classe.id_classe,
                message=f"Instructeur assigned to class {classe.code_classe}",
                metadata={"instructeur_id": instructeur.id},
            )
        return Response(
            {"assignment_id": assignment.id_affectation, "status": "assigned" if created else "already_assigned"},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class InstructeurCoursCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_INSTRUCTEUR:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        titre = (request.data.get("titre") or "").strip()
        description = (request.data.get("description") or "").strip()
        specialite_id = request.data.get("specialite_id")
        publier = bool(request.data.get("publier", False))

        if not titre:
            return Response({"detail": "titre is required"}, status=status.HTTP_400_BAD_REQUEST)

        specialite = None
        if specialite_id:
            specialite = Specialite.objects.filter(id_specialite=specialite_id).first()
            if not specialite:
                return Response({"detail": "specialite not found"}, status=status.HTTP_400_BAD_REQUEST)

        cours = Cours.objects.create(
            titre=titre,
            description=description,
            instructeur=request.user,
            specialite=specialite,
            statut=Cours.STATUT_PUBLIE if publier else Cours.STATUT_BROUILLON,
            date_depot=timezone.now().date(),
        )
        log_event(
            request=request,
            event_type="instructeur.cours.created",
            target_type="cours",
            target_id=cours.id_cours,
            message=f"Instructeur created cours {cours.titre}",
            metadata={"status": cours.statut},
        )
        return Response(
            {"id": cours.id_cours, "titre": cours.titre, "statut": cours.statut},
            status=status.HTTP_201_CREATED,
        )


class InstructeurControleCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_INSTRUCTEUR:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        cours_id = request.data.get("cours_id")
        nom = (request.data.get("nom") or "").strip()
        enonce = (request.data.get("enonce") or "").strip()
        bareme = request.data.get("bareme", 20)
        date_limite = request.data.get("date_limite")
        publier = bool(request.data.get("publier", False))

        cours = Cours.objects.filter(id_cours=cours_id, instructeur=request.user).first()
        if not cours:
            return Response({"detail": "cours not found"}, status=status.HTTP_400_BAD_REQUEST)
        if not nom:
            return Response({"detail": "nom is required"}, status=status.HTTP_400_BAD_REQUEST)

        controle = Controle.objects.create(
            cours=cours,
            instructeur=request.user,
            nom=nom,
            enonce=enonce,
            bareme=bareme,
            date_limite=date_limite,
            statut=Controle.STATUT_PUBLIE if publier else Controle.STATUT_BROUILLON,
            date_publication=timezone.now() if publier else None,
        )
        log_event(
            request=request,
            event_type="instructeur.controle.created",
            target_type="controle",
            target_id=controle.id_controle,
            message=f"Instructeur created controle {controle.nom}",
            metadata={"status": controle.statut},
        )
        return Response(
            {"id": controle.id_controle, "nom": controle.nom, "statut": controle.statut},
            status=status.HTTP_201_CREATED,
        )


class StageaireSubmitControleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, controle_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_STAGEAIRE:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        controle = Controle.objects.filter(id_controle=controle_id, statut=Controle.STATUT_PUBLIE).first()
        if not controle:
            return Response({"detail": "controle not found"}, status=status.HTTP_404_NOT_FOUND)

        is_enrolled = Inscription.objects.filter(
            stagiaire=request.user,
            cours=controle.cours,
            statut=Inscription.STATUT_ACTIVE,
        ).exists()
        if not is_enrolled:
            return Response({"detail": "not enrolled in this course"}, status=status.HTTP_403_FORBIDDEN)

        commentaire = (request.data.get("commentaire") or "").strip()
        if not commentaire:
            return Response({"detail": "commentaire is required"}, status=status.HTTP_400_BAD_REQUEST)

        soumission, created = SoumissionControle.objects.get_or_create(
            controle=controle,
            stagiaire=request.user,
            defaults={
                "commentaire": commentaire,
                "date_soumission": timezone.now(),
                "statut": SoumissionControle.STATUT_SOUMIS,
            },
        )
        if not created:
            soumission.commentaire = commentaire
            soumission.date_soumission = timezone.now()
            soumission.statut = SoumissionControle.STATUT_SOUMIS
            soumission.save(update_fields=["commentaire", "date_soumission", "statut"])

        log_event(
            request=request,
            event_type="stageaire.controle.submitted",
            target_type="controle",
            target_id=controle.id_controle,
            message=f"Stageaire submitted controle {controle.nom}",
            metadata={"soumission_id": soumission.id_soumission},
        )

        return Response(
            {"soumission_id": soumission.id_soumission, "statut": soumission.statut},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class InstructeurEvaluateSoumissionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, soumission_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_INSTRUCTEUR:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        soumission = SoumissionControle.objects.filter(id_soumission=soumission_id).select_related(
            "controle"
        ).first()
        if not soumission or soumission.controle.instructeur_id != request.user.id:
            return Response({"detail": "soumission not found"}, status=status.HTTP_404_NOT_FOUND)

        note = request.data.get("note")
        correction = (request.data.get("correction") or "").strip()
        publier_note = bool(request.data.get("publier_note", True))
        if note is None:
            return Response({"detail": "note is required"}, status=status.HTTP_400_BAD_REQUEST)

        evaluation, _ = Evaluation.objects.update_or_create(
            soumission=soumission,
            defaults={
                "instructeur": request.user,
                "note": note,
                "correction": correction,
                "date_eval": timezone.now(),
                "est_publiee": publier_note,
                "date_publication": timezone.now() if publier_note else None,
            },
        )
        log_event(
            request=request,
            event_type="instructeur.soumission.evaluated",
            target_type="soumission",
            target_id=soumission.id_soumission,
            message="Instructeur evaluated soumission",
            metadata={"published": bool(evaluation.est_publiee), "note": str(evaluation.note)},
        )
        return Response(
            {"evaluation_id": evaluation.id_evaluation, "note": evaluation.note, "published": evaluation.est_publiee}
        )


class InstructeurPublishCorrectionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, controle_id):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.role != UserProfile.ROLE_INSTRUCTEUR:
            return Response({"detail": "Forbidden for this role"}, status=status.HTTP_403_FORBIDDEN)

        controle = Controle.objects.filter(id_controle=controle_id, instructeur=request.user).first()
        if not controle:
            return Response({"detail": "controle not found"}, status=status.HTTP_404_NOT_FOUND)

        titre = (request.data.get("titre") or "").strip()
        texte = (request.data.get("texte_correction") or "").strip()
        if not texte:
            return Response({"detail": "texte_correction is required"}, status=status.HTTP_400_BAD_REQUEST)

        last_version = controle.corrections.order_by("-version_no").values_list("version_no", flat=True).first() or 0
        correction = ControleCorrection.objects.create(
            controle=controle,
            version_no=last_version + 1,
            titre=titre,
            texte_correction=texte,
            publie_par=request.user,
            date_publication=timezone.now(),
        )
        controle.statut = Controle.STATUT_CORRIGE
        controle.save(update_fields=["statut"])
        log_event(
            request=request,
            event_type="instructeur.controle.correction_published",
            target_type="controle",
            target_id=controle.id_controle,
            message=f"Instructeur published correction for {controle.nom}",
            metadata={"version": correction.version_no},
        )

        return Response(
            {
                "correction_id": correction.id_correction,
                "version": correction.version_no,
                "controle_statut": controle.statut,
            },
            status=status.HTTP_201_CREATED,
        )
