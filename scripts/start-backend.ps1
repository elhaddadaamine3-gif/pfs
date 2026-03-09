Set-Location "$PSScriptRoot\..\backend"
python -m poetry install
python -m poetry run python manage.py migrate
if ($env:DJANGO_ADMIN_PASSWORD) {
  python -m poetry run python manage.py bootstrap_admin --password "${env:DJANGO_ADMIN_PASSWORD}"
} else {
  Write-Host "Skipping admin bootstrap: set DJANGO_ADMIN_PASSWORD to enable."
}
python -m poetry run python manage.py runserver
