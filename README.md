# Platform par Correspondence

Full-stack training/education platform monorepo.

## Stack

- Backend: Django + Django REST Framework + SimpleJWT + SQLite + Poetry
- Frontend: React + Vite + TypeScript + Tailwind + Material UI
- Dev orchestration: Docker Compose (optional) or native local setup

## Repository Structure

- `backend/` Django API and business logic
- `frontend/` React web application
- `scripts/` helper scripts
- `docker-compose.yml` containerized dev environment

## Quick Start (Docker)

From repository root:

```powershell
docker compose up --build
```

App URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:8000`

Stop:

```powershell
docker compose down
```

Bootstrap admin (optional):

```powershell
docker compose exec backend python -m poetry run python manage.py bootstrap_admin --password "<STRONG_PASSWORD>"
```

## Quick Start (Local, no Docker)

### Backend

```powershell
cd backend
python -m poetry install
python -m poetry run python manage.py migrate
python -m poetry run python manage.py bootstrap_admin --password "<STRONG_PASSWORD>"
python -m poetry run python manage.py runserver
```

### Frontend

```powershell
cd frontend
Copy-Item .env.example .env
npm.cmd install
npm.cmd run dev
```

## Useful Commands

### Backend

```powershell
cd backend
python -m poetry run python manage.py check
python -m poetry run python manage.py test
```

### Frontend

```powershell
cd frontend
npm.cmd run build
```

## Environment Variables

### Backend

- `DJANGO_ADMIN_USERNAME` (default: `admin`)
- `DJANGO_ADMIN_EMAIL` (default: `admin@example.com`)
- `DJANGO_ADMIN_PASSWORD` (required for bootstrap command)
- `DJANGO_ADMIN_MATRICULE` (default: `ADM-0001`)

### Frontend

- `VITE_API_BASE_URL` (default local: `http://127.0.0.1:8000`)

## Main Roles

- `Instructeur`
- `Stageaire`
- `Admin`
- `Superviseur`
- `Corrdinateur`

Notes:

- Admin profile cannot be created via public signup.
- Civil `Instructeur` can exist without matricule.
- Other roles are military profiles and require matricule + reference data.

## Feature Highlights

- JWT auth with refresh flow
- Role-based dashboards
- Admin management tabs (accounts, classes, subjects, references, events)
- Platform event auditing API and UI tab
- i18n (French default + English)
- UI animation layer (toasts, route transitions, skeletons, modal/list animations)
