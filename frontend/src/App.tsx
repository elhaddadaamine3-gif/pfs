import React, { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import PdfViewer, { InlinePdfViewer } from "./PdfViewer";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

type MeResponse = {
  id: number;
  username: string;
  email: string;
  role: Role;
  matricule: string;
  est_civil?: boolean;
  corps?: { id: string; label: string } | null;
  rank?: { id: string; label: string } | null;
  speciality?: { id: string; label: string } | null;
};
type TokenResponse = { access: string; refresh: string };
type RefreshResponse = { access: string };
type Role = "Instructeur" | "Stagiaire" | "Admin" | "Superviseur" | "Coordinateur";

type InstructeurDashboardData = {
  role: Role;
  classes_count: number;
  classes: Array<{ code: string; label: string; brigade: string }>;
  cours: { total: number; published: number };
  cours_list: Array<{ id: string; title: string; status: string }>;
  controles: { total: number; published: number; pending_corrections: number };
  controles_list: Array<{ id: string; name: string; status: string; cours_title: string; deadline: string | null }>;
  pending_submissions: Array<{ soumission_id: string; controle_id: string; controle_name: string; stagiaire_id: number; submitted_at: string }>;
  sujets_fin_stage: { total: number; active: number; list: Array<{ sujet: string; stagiaire_id: number; etat: string }> };
  notifications: { unread_count: number; latest: Array<{ id: string; title: string; type: string; created_at: string }> };
};

type StageaireDashboardData = {
  role: Role;
  classes: Array<{ classe_code: string; classe_label: string; brigade_code: string; brigade_label: string }>;
  cours_list: Array<{ id: string; titre: string; description: string; instructeur: string; controles_count: number }>;
  controls: { available_count: number; submitted_count: number; pending_count: number };
  controls_list: Array<{ id: string; name: string; deadline: string | null; cours: string }>;
  submitted_control_ids: string[];
  soumissions_detail: Array<{ soumission_id: string; controle_id: string; controle_name: string; statut: string; submitted_at: string; has_fichier: boolean; note: string | null; correction_publiee: string | null; correction_titre: string | null }>;
  notes: Array<{ controle: string; note: string; published_at: string | null }>;
  sujet_fin_stage: { titre: string; description: string; etat: string; encadrant: string; date_affectation: string } | null;
  notifications: { unread_count: number; latest: Array<{ id: string; title: string; type: string; created_at: string }> };
};

type SuperviseurDashboardData = {
  role: Role;
  monitoring: {
    classes_count: number;
    brigades_count: number;
    controles_count: number;
    published_notes_count: number;
  };
  classes: Array<{
    classe_code: string;
    brigade_code: string;
    stagiaires_count: number;
    controles_count: number;
    notes_published_count: number;
    note_moyenne: number | null;
  }>;
  notifications: { unread_count: number };
};

type CoordinateurDashboardData = {
  role: Role;
  monitoring: {
    brigades: Array<{
      brigade_code: string;
      classes_count: number;
      stagiaires_count: number;
      published_notes_count: number;
      note_moyenne: number | null;
    }>;
    controls_total: number;
    controls_published: number;
    notes_published: number;
  };
  notifications: { unread_count: number };
};

type AdminDashboardData = {
  role: Role;
  platform: {
    users_total: number;
    users_active: number;
    cours_total: number;
    controles_total: number;
    soumissions_total: number;
  };
  users: Array<{
    id: number;
    username: string;
    email: string;
    is_active: boolean;
    role: string;
  }>;
};

type SubjectData = { id: string; label: string };
type SubjectControlData = {
  id: string;
  name: string;
  status: string;
  cours_id: string;
  cours_title: string;
  instructeur_username: string;
  deadline: string | null;
};

type SubjectCourseData = {
  id: string;
  title: string;
  status: string;
  instructeur_username: string;
  date_depot: string;
};

type AdminClassData = {
  id: string;
  code: string;
  label: string;
  brigade: { code: string; label: string };
  instructeurs: Array<{ id: number; username: string }>;
  stageaires: Array<{ id: number; username: string }>;
};

type ReferenceCorp = { id: string; code: string; label: string };
type ReferenceRank = { id: string; code: string; label: string; corps_id: string };
type ReferenceSpeciality = { id: string; code: string; label: string; corps_id?: string | null };
type AdminEventData = {
  id: string;
  created_at: string;
  actor_username: string;
  actor_role: string;
  event_type: string;
  target_type: string;
  target_id: string;
  message: string;
  metadata: Record<string, unknown>;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const ROLE_OPTIONS: Role[] = ["Instructeur", "Stagiaire", "Superviseur", "Coordinateur"];

function Layout({
  user,
  children,
}: {
  user: MeResponse | null;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-app-soft text-app-dark">
      <header className="sticky top-0 z-20 border-b border-app-muted/60 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link className="text-lg font-semibold tracking-tight text-app-dark" to="/">
            {t("nav.brand")}
          </Link>
          <nav className="flex items-center gap-2">
            <HeaderLink to="/">{t("nav.home")}</HeaderLink>
            {!user ? (
              <>
                <HeaderLink to="/login">{t("nav.login")}</HeaderLink>
                <HeaderLink to="/signup">{t("nav.signup")}</HeaderLink>
              </>
            ) : (
              <>
                <HeaderLink to="/dashboard">
                  {user.role === "Admin" ? t("workspace.Admin.title") : t("nav.dashboard")}
                </HeaderLink>
                <Link
                  aria-label={t("nav.settings")}
                  className="inline-flex h-10 w-10 items-center justify-center text-2xl font-bold text-app-dark transition hover:text-app-accent"
                  title={t("nav.settings")}
                  to="/settings"
                >
                  <span aria-hidden="true">⚙</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

function HeaderLink({ to, children }: { to: string; children: string }) {
  return (
    <Button component={NavLink} size="small" sx={{ textTransform: "none", fontWeight: 600 }} to={to} variant="text">
      {children}
    </Button>
  );
}

function PanelSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <section className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-app-dark/70">{subtitle}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

function SubCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-xl border border-app-muted bg-app-soft/40 p-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-app-muted/70 bg-app-soft px-3 py-2">
      <p className="text-xs uppercase tracking-[0.08em] text-app-dark/70">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button color={active ? "primary" : "inherit"} onClick={onClick} size="small" variant={active ? "contained" : "outlined"}>
      {children}
    </Button>
  );
}

function AdminNavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button fullWidth onClick={onClick} size="small" sx={{ justifyContent: "flex-start", textTransform: "none" }} variant={active ? "contained" : "outlined"}>
      {children}
    </Button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} size="small" sx={{ mb: 2 }} variant="outlined">
      Back
    </Button>
  );
}

function EmptyState({ message }: { message: string }) {
  return <Alert severity="info" sx={{ mt: 1 }}>{message}</Alert>;
}

type ReferenceManagementSectionProps = {
  referencesData: {
    corps: ReferenceCorp[];
    ranks: ReferenceRank[];
    specialities: ReferenceSpeciality[];
  };
  referenceTab: "corps" | "ranks" | "specialities";
  setReferenceTab: (value: "corps" | "ranks" | "specialities") => void;
  newCorps: { code: string; label: string };
  setNewCorps: React.Dispatch<React.SetStateAction<{ code: string; label: string }>>;
  newRank: { code: string; label: string; corps_id: string };
  setNewRank: React.Dispatch<React.SetStateAction<{ code: string; label: string; corps_id: string }>>;
  newSpeciality: { code: string; label: string; corps_id: string };
  setNewSpeciality: React.Dispatch<React.SetStateAction<{ code: string; label: string; corps_id: string }>>;
  handleCreateCorps: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleCreateRank: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleCreateSpeciality: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleRenameCorps: (corpsId: string, current: string) => void;
  handleRenameRank: (rankId: string, current: string) => void;
  handleRenameSpeciality: (specialityId: string, current: string) => void;
};

function ReferenceManagementSection({
  referencesData,
  referenceTab,
  setReferenceTab,
  newCorps,
  setNewCorps,
  newRank,
  setNewRank,
  newSpeciality,
  setNewSpeciality,
  handleCreateCorps,
  handleCreateRank,
  handleCreateSpeciality,
  handleRenameCorps,
  handleRenameRank,
  handleRenameSpeciality,
}: ReferenceManagementSectionProps) {
  return (
    <div className="grid gap-6">
      <PanelSection title="Corps, ranks et specialities">
        <p className="text-sm text-app-dark/70">
          Ces tables sont bootstrappées à partir des données des corps et peuvent être ajustées par les superviseurs au besoin.
        </p>
      </PanelSection>

      <div className="flex flex-wrap items-center gap-2">
        <TabButton active={referenceTab === "corps"} onClick={() => setReferenceTab("corps")}>
          Corps
        </TabButton>
        <TabButton active={referenceTab === "ranks"} onClick={() => setReferenceTab("ranks")}>
          Ranks
        </TabButton>
        <TabButton active={referenceTab === "specialities"} onClick={() => setReferenceTab("specialities")}>
          Specialities
        </TabButton>
      </div>

      {referenceTab === "corps" ? (
        <SubCard title="Corps">
          <form className="grid gap-2" onSubmit={handleCreateCorps}>
            <Input label="Code" value={newCorps.code} onChange={(value) => setNewCorps((prev) => ({ ...prev, code: value }))} />
            <Input label="Libelle" value={newCorps.label} onChange={(value) => setNewCorps((prev) => ({ ...prev, label: value }))} />
            <button className="rounded bg-app-dark px-3 py-2 text-xs font-semibold text-white" type="submit">
              Ajouter corp
            </button>
          </form>
          <div className="mt-3 space-y-2">
            {referencesData.corps.map((corp) => (
              <button
                className="w-full rounded border border-app-muted px-2 py-1 text-left text-xs hover:bg-app-soft"
                key={corp.id}
                onClick={() => void handleRenameCorps(corp.id, corp.label)}
                type="button"
              >
                {corp.label} ({corp.code})
              </button>
            ))}
            {referencesData.corps.length === 0 ? <EmptyState message="Aucun corp." /> : null}
          </div>
        </SubCard>
      ) : null}

      {referenceTab === "ranks" ? (
        <SubCard title="Ranks">
          <form className="grid gap-2" onSubmit={handleCreateRank}>
            <Input label="Code" value={newRank.code} onChange={(value) => setNewRank((prev) => ({ ...prev, code: value }))} />
            <Input label="Libelle" value={newRank.label} onChange={(value) => setNewRank((prev) => ({ ...prev, label: value }))} />
            <label className="grid gap-1 text-sm font-medium text-app-dark">
              Corp
              <select
                className="rounded border border-app-muted bg-white px-3 py-2"
                onChange={(event) => setNewRank((prev) => ({ ...prev, corps_id: event.target.value }))}
                value={newRank.corps_id}
              >
                <option value="">Selectionner</option>
                {referencesData.corps.map((corp) => (
                  <option key={corp.id} value={corp.id}>
                    {corp.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded bg-app-dark px-3 py-2 text-xs font-semibold text-white" type="submit">
              Ajouter rank
            </button>
          </form>
          <div className="mt-3 space-y-2">
            {referencesData.ranks.map((rank) => (
              <button
                className="w-full rounded border border-app-muted px-2 py-1 text-left text-xs hover:bg-app-soft"
                key={rank.id}
                onClick={() => void handleRenameRank(rank.id, rank.label)}
                type="button"
              >
                {rank.label} ({rank.code})
              </button>
            ))}
            {referencesData.ranks.length === 0 ? <EmptyState message="Aucun rank." /> : null}
          </div>
        </SubCard>
      ) : null}

      {referenceTab === "specialities" ? (
        <SubCard title="Specialities">
          <form className="grid gap-2" onSubmit={handleCreateSpeciality}>
            <Input label="Code" value={newSpeciality.code} onChange={(value) => setNewSpeciality((prev) => ({ ...prev, code: value }))} />
            <Input label="Libelle" value={newSpeciality.label} onChange={(value) => setNewSpeciality((prev) => ({ ...prev, label: value }))} />
            <label className="grid gap-1 text-sm font-medium text-app-dark">
              Corp (optionnel)
              <select
                className="rounded border border-app-muted bg-white px-3 py-2"
                onChange={(event) => setNewSpeciality((prev) => ({ ...prev, corps_id: event.target.value }))}
                value={newSpeciality.corps_id}
              >
                <option value="">Selectionner</option>
                {referencesData.corps.map((corp) => (
                  <option key={corp.id} value={corp.id}>
                    {corp.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded bg-app-dark px-3 py-2 text-xs font-semibold text-white" type="submit">
              Ajouter speciality
            </button>
          </form>
          <div className="mt-3 space-y-2">
            {referencesData.specialities.map((speciality) => (
              <button
                className="w-full rounded border border-app-muted px-2 py-1 text-left text-xs hover:bg-app-soft"
                key={speciality.id}
                onClick={() => void handleRenameSpeciality(speciality.id, speciality.label)}
                type="button"
              >
                {speciality.label} ({speciality.code})
                {speciality.corps_id
                  ? ` - ${referencesData.corps.find((c) => c.id === speciality.corps_id)?.label ?? ""}`
                  : ""}
              </button>
            ))}
            {referencesData.specialities.length === 0 ? <EmptyState message="Aucune speciality." /> : null}
          </div>
        </SubCard>
      ) : null}
    </div>
  );
}

function HomePage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <section className="grid gap-8 rounded-2xl border border-app-muted bg-white p-8 shadow-sm md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-app-accent">{t("home.badge")}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-app-dark">{t("home.title")}</h1>
          <p className="mt-4 text-sm leading-6 text-app-dark/80">{t("home.subtitle")}</p>
          <div className="mt-6 flex gap-3">
            <Link className="rounded-md bg-app-dark px-4 py-2 text-sm font-semibold text-white hover:opacity-90" to="/login">
              {t("home.ctaLogin")}
            </Link>
            <Link className="rounded-md border border-app-dark px-4 py-2 text-sm font-semibold text-app-dark hover:bg-app-dark hover:text-white" to="/signup">
              {t("home.ctaSignup")}
            </Link>
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-app-soft to-app-muted p-5">
          <h2 className="text-lg font-semibold text-app-dark">{t("home.highlightsTitle")}</h2>
          <ul className="mt-4 space-y-3 text-sm text-app-dark/80">
            <li className="rounded-md border border-white/80 bg-white/70 p-3">{t("home.highlight1")}</li>
            <li className="rounded-md border border-white/80 bg-white/70 p-3">{t("home.highlight2")}</li>
            <li className="rounded-md border border-white/80 bg-white/70 p-3">{t("home.highlight3")}</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function LoginPage({
  onLogin,
  error,
}: {
  onLogin: (username: string, password: string) => Promise<void>;
  error: string | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onLogin(username, password);
      navigate("/dashboard");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto grid w-full max-w-md gap-5 px-4 py-10">
      <section className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-app-dark">{t("login.title")}</h1>
        <p className="mt-1 text-sm text-app-dark/70">{t("login.subtitle")}</p>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <Input label={t("labels.username")} value={username} onChange={setUsername} />
          <Input label={t("labels.password")} type="password" value={password} onChange={setPassword} />
          <button
            className="w-full rounded-md bg-app-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? t("login.loading") : t("login.submit")}
          </button>
        </form>
        {error ? <p className="mt-4 rounded-md bg-app-accent/15 px-3 py-2 text-sm text-app-dark">{error}</p> : null}
      </section>
    </main>
  );
}

function SignupPage({
  onSignup,
  error,
  references,
}: {
  onSignup: (payload: {
    username: string;
    password: string;
    email: string;
    role: Role;
    matricule: string;
    est_civil: boolean;
    corps_id: string;
    rank_id: string;
    speciality_id: string;
  }) => Promise<void>;
  error: string | null;
  references: { corps: ReferenceCorp[]; ranks: ReferenceRank[]; specialities: ReferenceSpeciality[] };
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("Stagiaire");
  const [matricule, setMatricule] = useState("");
  const [estCivil, setEstCivil] = useState(false);
  const [corpsId, setCorpsId] = useState("");
  const [rankId, setRankId] = useState("");
  const [specialityId, setSpecialityId] = useState("");
  const [busy, setBusy] = useState(false);
  const requiresMilitaryProfile = !(role === "Instructeur" && estCivil);
  const matriculeRequired = requiresMilitaryProfile;
  const ranksForCorps = references.ranks.filter((rank) => rank.corps_id === corpsId);
  const specialitiesForCorps = references.specialities.filter(
    (speciality) => !speciality.corps_id || speciality.corps_id === corpsId
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (matriculeRequired && !matricule.trim()) {
      return;
    }
    if (requiresMilitaryProfile && (!corpsId || !rankId || !specialityId)) {
      return;
    }
    setBusy(true);
    try {
      await onSignup({
        username,
        password,
        email,
        role,
        matricule: matricule.trim(),
        est_civil: role === "Instructeur" ? estCivil : false,
        corps_id: requiresMilitaryProfile ? corpsId : "",
        rank_id: requiresMilitaryProfile ? rankId : "",
        speciality_id: requiresMilitaryProfile ? specialityId : "",
      });
      navigate("/dashboard");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto grid w-full max-w-md gap-5 px-4 py-10">
      <section className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-app-dark">{t("signup.title")}</h1>
        <p className="mt-1 text-sm text-app-dark/70">{t("signup.subtitle")}</p>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <Input label={t("labels.username")} value={username} onChange={setUsername} />
          <Input label={t("labels.email")} value={email} onChange={setEmail} />
          <Input label={t("labels.password")} type="password" value={password} onChange={setPassword} />
          <Input
            label={matriculeRequired ? t("labels.matriculeRequired") : t("labels.matriculeOptional")}
            value={matricule}
            onChange={setMatricule}
            required={matriculeRequired}
          />
          <label className="grid gap-1 text-sm font-medium text-app-dark">
            {t("signup.profile")}
            <select
              className="rounded-md border border-app-muted bg-white px-3 py-2 outline-none focus:border-app-accent"
              value={role}
              onChange={(event) => {
                const nextRole = event.target.value as Role;
                setRole(nextRole);
                if (nextRole !== "Instructeur") {
                  setEstCivil(false);
                }
              }}
            >
              {ROLE_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {t(`roles.${entry}`)}
                </option>
              ))}
            </select>
          </label>
          {role === "Instructeur" ? (
            <label className="flex items-center gap-2 text-sm font-medium text-app-dark">
              <input checked={estCivil} onChange={(event) => setEstCivil(event.target.checked)} type="checkbox" />
              Instructeur civil
            </label>
          ) : null}
          {requiresMilitaryProfile ? (
            <>
              <label className="grid gap-1 text-sm font-medium text-app-dark">
                Corp
                <select
                  className="rounded-md border border-app-muted bg-white px-3 py-2 outline-none focus:border-app-accent"
                  onChange={(event) => {
                    setCorpsId(event.target.value);
                    setRankId("");
                    setSpecialityId("");
                  }}
                  required
                  value={corpsId}
                >
                  <option value="">Selectionner</option>
                  {references.corps.map((corp) => (
                    <option key={corp.id} value={corp.id}>
                      {corp.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-app-dark">
                Rank
                <select
                  className="rounded-md border border-app-muted bg-white px-3 py-2 outline-none focus:border-app-accent"
                  onChange={(event) => setRankId(event.target.value)}
                  required
                  value={rankId}
                >
                  <option value="">Selectionner</option>
                  {ranksForCorps.map((rank) => (
                    <option key={rank.id} value={rank.id}>
                      {rank.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-app-dark">
                Speciality
                <select
                  className="rounded-md border border-app-muted bg-white px-3 py-2 outline-none focus:border-app-accent"
                  onChange={(event) => setSpecialityId(event.target.value)}
                  required
                  value={specialityId}
                >
                  <option value="">Selectionner</option>
                  {specialitiesForCorps.map((speciality) => (
                    <option key={speciality.id} value={speciality.id}>
                      {speciality.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <button
            className="w-full rounded-md bg-app-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? t("signup.loading") : t("signup.submit")}
          </button>
        </form>
        {error ? <p className="mt-4 rounded-md bg-app-accent/15 px-3 py-2 text-sm text-app-dark">{error}</p> : null}
      </section>
    </main>
  );
}

function DashboardPage({
  user,
  onLoadProfile,
  apiFetch,
  onSessionInvalid,
}: {
  user: MeResponse | null;
  onLoadProfile: () => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onSessionInvalid: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [instructeurData, setInstructeurData] = useState<InstructeurDashboardData | null>(null);
  const [stageaireData, setStageaireData] = useState<StageaireDashboardData | null>(null);
  const [selectedCours, setSelectedCours] = useState<{
    id: string; titre: string; description: string; instructeur: string; date_depot: string;
    fichiers: Array<{ id_cours_fichier: string; nom_fichier: string; mime_type: string; taille_octets: number }>;
    controles: Array<{ id: string; nom: string; enonce: string; bareme: number; date_limite: string | null; has_fichier: boolean; nom_fichier_enonce: string }>;
  } | null>(null);
  const [coursFileCache, setCoursFileCache] = useState<Record<string, { base64: string; name: string; mimeType: string }>>({});
  const [superviseurData, setSuperviseurData] = useState<SuperviseurDashboardData | null>(null);
  const [coordinateurData, setCoordinateurData] = useState<CoordinateurDashboardData | null>(null);
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseFichierFile, setCourseFichierFile] = useState<File | null>(null);
  const [controlCoursId, setControlCoursId] = useState("");
  const [controlName, setControlName] = useState("");
  const [controlPrompt, setControlPrompt] = useState("");
  const [controlEnonceFichier, setControlEnonceFichier] = useState<File | null>(null);
  const [submissionAnswers, setSubmissionAnswers] = useState<Record<string, string>>({});
  const [submissionFiles, setSubmissionFiles] = useState<Record<string, File>>({});
  const [evalNote, setEvalNote] = useState<Record<string, string>>({});
  const [evalCorrection, setEvalCorrection] = useState<Record<string, string>>({});
  const [correctionText, setCorrectionText] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ base64: string; name: string; mimeType: string } | null>(null);
  const [instructeurView, setInstructeurView] = useState<"dashboard" | "cours" | "controles" | "corriger" | "reponse_controle" | "sujet">("dashboard");
  const [stageaireView, setStageaireView] = useState<"dashboard" | "cours" | "controles" | "reponse_controle" | "sujet">("dashboard");
  const [adminView, setAdminView] = useState<"overview" | "users" | "accounts" | "subjects" | "classes" | "references" | "events">("overview");
  const [selectedAdminUser, setSelectedAdminUser] = useState<AdminDashboardData["users"][number] | null>(null);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [subjectControls, setSubjectControls] = useState<SubjectControlData[]>([]);
  const [subjectCourses, setSubjectCourses] = useState<SubjectCourseData[]>([]);
  const [subjectTab, setSubjectTab] = useState<"subjects" | "controls" | "courses">("subjects");
  const [newSubjectLabel, setNewSubjectLabel] = useState("");
  const [accountForm, setAccountForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "Stagiaire",
    matricule: "",
    est_civil: false,
    corps_id: "",
    rank_id: "",
    speciality_id: "",
  });
  const [csvFileName, setCsvFileName] = useState("");
  const [csvErrors, setCsvErrors] = useState<Array<{ line: number; error: string }>>([]);
  const [classesData, setClassesData] = useState<AdminClassData[]>([]);
  const [newClassForm, setNewClassForm] = useState({ code_classe: "", libelle: "", brigade_code: "", brigade_label: "" });
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStageaireId, setSelectedStageaireId] = useState("");
  const [selectedInstructeurId, setSelectedInstructeurId] = useState("");
  const [referencesData, setReferencesData] = useState<{
    corps: ReferenceCorp[];
    ranks: ReferenceRank[];
    specialities: ReferenceSpeciality[];
  }>({ corps: [], ranks: [], specialities: [] });
  const [referenceTab, setReferenceTab] = useState<"corps" | "ranks" | "specialities">("corps");
  const [newCorps, setNewCorps] = useState({ code: "", label: "" });
  const [newRank, setNewRank] = useState({ code: "", label: "", corps_id: "" });
  const [newSpeciality, setNewSpeciality] = useState({ code: "", label: "", corps_id: "" });
  const [adminEvents, setAdminEvents] = useState<AdminEventData[]>([]);
  const [toastState, setToastState] = useState<{ kind: "success" | "error"; message: string; closing: boolean } | null>(null);
  const [renameModal, setRenameModal] = useState<{
    open: boolean;
    target: "corps" | "rank" | "speciality" | null;
    id: string;
    value: string;
  }>({ open: false, target: null, id: "", value: "" });

  useEffect(() => {
    void onLoadProfile();
  }, [onLoadProfile]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "Admin") {
      let suffix = t("titles.adminOverview");
      if (adminView === "users") suffix = selectedAdminUser ? t("titles.adminUserDetails") : t("titles.adminUsers");
      if (adminView === "accounts") suffix = t("titles.adminAccounts");
      if (adminView === "subjects") {
        suffix =
          subjectTab === "controls"
            ? t("titles.adminSubjectsControls")
            : subjectTab === "courses"
              ? t("titles.adminSubjectsCourses")
              : t("titles.adminSubjects");
      }
      if (adminView === "classes") suffix = t("titles.adminClasses");
      if (adminView === "references") {
        suffix = referenceTab === "corps" ? "References - Corps" : referenceTab === "ranks" ? "References - Ranks" : "References - Specialities";
      }
      if (adminView === "events") suffix = "Events";
      document.title = `${t("titles.adminWorkspace")} - ${suffix}`;
      return;
    }
    if (user.role === "Instructeur") document.title = `${t("titles.instructorDashboard")} - ${t("titles.appName")}`;
    if (user.role === "Stagiaire") document.title = `${t("titles.traineeDashboard")} - ${t("titles.appName")}`;
    if (user.role === "Superviseur") document.title = `${t("titles.supervisorDashboard")} - ${t("titles.appName")}`;
    if (user.role === "Coordinateur") document.title = `${t("titles.coordinatorDashboard")} - ${t("titles.appName")}`;
  }, [user, adminView, selectedAdminUser, subjectTab, referenceTab, t]);

  const loadDashboard = async () => {
    if (!user) return;
    setLoading(true);
    setDashboardError(null);
    if (user.role !== "Admin") {
      setSelectedAdminUser(null);
      setAdminView("overview");
    }
    try {
      if (user.role === "Instructeur") {
        const response = await apiFetch("/api/dashboard/instructeur/");
        if (response.status === 403) { onSessionInvalid(); return; }
        if (!response.ok) throw new Error("failed");
        const data: InstructeurDashboardData = await response.json();
        setInstructeurData(data);
      } else if (user.role === "Stagiaire") {
        const response = await apiFetch("/api/dashboard/stageaire/");
        if (response.status === 403) { onSessionInvalid(); return; }
        if (!response.ok) throw new Error("failed");
        const data: StageaireDashboardData = await response.json();
        setStageaireData(data);
      } else if (user.role === "Superviseur") {
        const response = await apiFetch("/api/dashboard/superviseur/");
        if (response.status === 403) { onSessionInvalid(); return; }
        if (!response.ok) throw new Error("failed");
        const data: SuperviseurDashboardData = await response.json();
        setSuperviseurData(data);
      } else if (user.role === "Coordinateur") {
        const response = await apiFetch("/api/dashboard/coordinateur/");
        if (response.status === 403) { onSessionInvalid(); return; }
        if (!response.ok) throw new Error("failed");
        const data: CoordinateurDashboardData = await response.json();
        setCoordinateurData(data);
      } else if (user.role === "Admin") {
        const response = await apiFetch("/api/dashboard/admin/");
        if (response.status === 403) { onSessionInvalid(); return; }
        if (!response.ok) throw new Error("failed");
        const data: AdminDashboardData = await response.json();
        setAdminData(data);
      }
    } catch {
      setDashboardError(t("errors.profileLoadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadDashboard();
  }, [user?.role]);

  const handleCreateCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await apiFetch("/api/instructeur/cours/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titre: courseTitle, description: courseDescription, publier: true }),
    });
    if (!response.ok) return;
    const created: { id: string } = await response.json();
    if (courseFichierFile) {
      const fichier_base64 = await readFileAsBase64(courseFichierFile);
      await apiFetch(`/api/instructeur/cours/${created.id}/fichier/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fichier_base64, nom_fichier: courseFichierFile.name, mime_type: courseFichierFile.type || "application/rtf" }),
      });
    }
    const withFile = courseFichierFile ? ` + fichier « ${courseFichierFile.name} »` : "";
    setCourseTitle("");
    setCourseDescription("");
    setCourseFichierFile(null);
    setActionMessage(`Cours « ${courseTitle} » publié${withFile}.`);
    await loadDashboard();
  };

  const handleCreateControl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await apiFetch("/api/instructeur/controles/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cours_id: controlCoursId,
        nom: controlName,
        enonce: controlPrompt,
        publier: true,
      }),
    });
    if (!response.ok) return;
    const created: { id: string } = await response.json();
    if (controlEnonceFichier) {
      const fichier_base64 = await readFileAsBase64(controlEnonceFichier);
      await apiFetch(`/api/instructeur/controles/${created.id}/fichier/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fichier_base64, nom_fichier: controlEnonceFichier.name, mime_type: controlEnonceFichier.type || "application/rtf" }),
      });
    }
    const coursName = instructeurData?.cours_list.find((c) => c.id === controlCoursId)?.title ?? controlCoursId;
    const withEnonce = controlEnonceFichier ? ` + énoncé « ${controlEnonceFichier.name} »` : "";
    setControlName("");
    setControlPrompt("");
    setControlEnonceFichier(null);
    setActionMessage(`Contrôle « ${controlName} » publié pour le cours « ${coursName} »${withEnonce}.`);
    await loadDashboard();
  };

  const handleEvaluate = async (soumissionId: string) => {
    const note = evalNote[soumissionId];
    const correction = evalCorrection[soumissionId] ?? "";
    const response = await apiFetch(`/api/instructeur/soumissions/${soumissionId}/evaluate/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, correction, publier_note: true }),
    });
    if (response.ok) {
      const sub = instructeurData?.pending_submissions.find((s) => s.soumission_id === soumissionId);
      const label = sub ? `« ${sub.controle_name} » (stagiaire #${sub.stagiaire_id})` : soumissionId.slice(0, 8);
      setActionMessage(`Note ${note}/20 publiée pour ${label}.`);
      await loadDashboard();
    }
  };

  const handlePublishCorrection = async (controleId: string) => {
    const texte = correctionText[controleId] ?? "";
    const response = await apiFetch(`/api/instructeur/controles/${controleId}/publish-correction/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titre: "Correction", texte_correction: texte }),
    });
    if (response.ok) {
      const ctrl = instructeurData?.controles_list.find((c) => c.id === controleId);
      const label = ctrl ? `« ${ctrl.name} »` : controleId.slice(0, 8);
      setActionMessage(`Correction publiée pour le contrôle ${label}.`);
      await loadDashboard();
    }
  };

  const handleOpenCours = async (coursId: string) => {
    const response = await apiFetch(`/api/stageaire/cours/${coursId}/`);
    if (!response.ok) return;
    const data = await response.json();
    setCoursFileCache({});
    setSelectedCours(data);
    // Fetch all course files so they render inline
    for (const f of data.fichiers ?? []) {
      apiFetch(`/api/stageaire/cours/${coursId}/fichier/${f.id_cours_fichier}/`).then(async (r) => {
        if (!r.ok) return;
        const fd: { fichier_base64: string; nom_fichier: string; mime_type: string } = await r.json();
        setCoursFileCache((prev) => ({ ...prev, [f.id_cours_fichier]: { base64: fd.fichier_base64, name: fd.nom_fichier, mimeType: fd.mime_type } }));
      });
    }
  };

  const handleSubmitAnswer = async (controlId: string) => {
    const commentaire = submissionAnswers[controlId] ?? "";
    const file = submissionFiles[controlId];
    let fichier_base64 = "";
    let nom_fichier = "";
    let mime_type = "";
    if (file) {
      fichier_base64 = await readFileAsBase64(file);
      nom_fichier = file.name;
      mime_type = file.type || "application/rtf";
    }
    const response = await apiFetch(`/api/stageaire/controls/${controlId}/submit/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentaire, fichier_base64, nom_fichier, mime_type }),
    });
    if (response.ok) {
      setSubmissionFiles((prev) => { const next = { ...prev }; delete next[controlId]; return next; });
      const ctrl = stageaireData?.controls_list.find((c) => c.id === controlId);
      const withFile = file ? ` avec fichier « ${file.name} »` : "";
      setActionMessage(`Réponse soumise pour « ${ctrl?.name ?? controlId.slice(0, 8)} »${withFile}.`);
      await loadDashboard();
    }
  };

  const handleToggleUserStatus = async (targetUserId: number) => {
    const response = await apiFetch(`/api/admin/users/${targetUserId}/toggle-active/`, {
      method: "POST",
    });
    if (response.ok) {
      const target = adminData?.users.find((u) => u.id === targetUserId);
      const label = target ? `« ${target.username} » (${target.role})` : `#${targetUserId}`;
      const newStatus = target?.is_active ? "désactivé" : "activé";
      setActionMessage(`Compte ${label} ${newStatus}.`);
      await loadDashboard();
    }
  };

  const loadSubjects = async () => {
    const response = await apiFetch("/api/admin/subjects/");
    if (!response.ok) return;
    const data: { subjects: SubjectData[] } = await response.json();
    setSubjects(data.subjects);
    if (!selectedSubjectId && data.subjects.length > 0) {
      setSelectedSubjectId(data.subjects[0].id);
    }
  };

  const loadClasses = async () => {
    const response = await apiFetch("/api/admin/classes/");
    if (!response.ok) return;
    const data: { classes: AdminClassData[] } = await response.json();
    setClassesData(data.classes);
    if (!selectedClassId && data.classes.length > 0) {
      setSelectedClassId(data.classes[0].id);
    }
  };

  const loadAdminReferences = async () => {
    const response = await apiFetch("/api/admin/references/");
    if (!response.ok) return;
    const data: { corps: ReferenceCorp[]; ranks: ReferenceRank[]; specialities: ReferenceSpeciality[] } = await response.json();
    setReferencesData(data);
    if (!newRank.corps_id && data.corps.length > 0) {
      setNewRank((prev) => ({ ...prev, corps_id: data.corps[0].id }));
    }
  };

  const loadAdminEvents = async () => {
    const response = await apiFetch("/api/admin/events/?limit=200");
    if (!response.ok) return;
    const data: { events: AdminEventData[] } = await response.json();
    setAdminEvents(data.events);
  };

  const loadSubjectControls = async (subjectId: string) => {
    if (!subjectId) return;
    const response = await apiFetch(`/api/admin/subjects/${subjectId}/controls/`);
    if (!response.ok) return;
    const data: { controls: SubjectControlData[] } = await response.json();
    setSubjectControls(data.controls);
  };

  const loadSubjectCourses = async (subjectId: string) => {
    if (!subjectId) return;
    const response = await apiFetch(`/api/admin/subjects/${subjectId}/courses/`);
    if (!response.ok) return;
    const data: { courses: SubjectCourseData[] } = await response.json();
    setSubjectCourses(data.courses);
  };

  const handleCreateSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await apiFetch("/api/admin/subjects/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newSubjectLabel }),
    });
    if (response.ok) {
      setActionMessage(`Sujet « ${newSubjectLabel} » créé.`);
      setNewSubjectLabel("");
      await loadSubjects();
    }
  };

  const handleCreateClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await apiFetch("/api/admin/classes/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClassForm),
    });
    if (response.ok) {
      setActionMessage(`Classe « ${newClassForm.code_classe} — ${newClassForm.libelle} » créée (brigade ${newClassForm.brigade_code}).`);
      setNewClassForm({ code_classe: "", libelle: "", brigade_code: "", brigade_label: "" });
      await loadClasses();
    }
  };

  const handleAssignStageaireToClass = async () => {
    if (!selectedClassId || !selectedStageaireId) return;
    const response = await apiFetch(`/api/admin/classes/${selectedClassId}/assign-stageaire/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageaire_id: Number(selectedStageaireId) }),
    });
    if (response.ok) {
      const cls = classesData.find((c) => c.id === selectedClassId);
      const stag = adminData?.users.find((u) => u.id === Number(selectedStageaireId));
      setActionMessage(`Stagiaire « ${stag?.username ?? selectedStageaireId} » affecté à la classe « ${cls?.code ?? selectedClassId} ».`);
      setSelectedStageaireId("");
      await loadClasses();
    }
  };

  const handleAssignInstructeurToClass = async () => {
    if (!selectedClassId || !selectedInstructeurId) return;
    const response = await apiFetch(`/api/admin/classes/${selectedClassId}/assign-instructeur/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructeur_id: Number(selectedInstructeurId) }),
    });
    if (response.ok) {
      const cls = classesData.find((c) => c.id === selectedClassId);
      const instr = adminData?.users.find((u) => u.id === Number(selectedInstructeurId));
      setActionMessage(`Instructeur « ${instr?.username ?? selectedInstructeurId} » affecté à la classe « ${cls?.code ?? selectedClassId} ».`);
      setSelectedInstructeurId("");
      await loadClasses();
    }
  };

  const handleUpdateControlStatus = async (controlId: string, statusValue: string) => {
    const response = await apiFetch(`/api/admin/controls/${controlId}/status/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusValue }),
    });
    if (response.ok) {
      const ctrl = subjectControls.find((c) => c.id === controlId);
      setActionMessage(`Contrôle « ${ctrl?.name ?? controlId.slice(0, 8)} » passé en ${statusValue}.`);
      await loadSubjectControls(selectedSubjectId);
    }
  };

  const handleUpdateCourseStatus = async (courseId: string, statusValue: string) => {
    const response = await apiFetch(`/api/admin/courses/${courseId}/status/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusValue }),
    });
    if (response.ok) {
      const cours = subjectCourses.find((c) => c.id === courseId);
      setActionMessage(`Cours « ${cours?.title ?? courseId.slice(0, 8)} » passé en ${statusValue}.`);
      await loadSubjectCourses(selectedSubjectId);
    }
  };

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await apiFetch("/api/admin/accounts/create/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accountForm),
    });
    if (response.ok) {
      setActionMessage(`Compte « ${accountForm.username} » créé avec le rôle ${accountForm.role}.`);
      setAccountForm({
        username: "",
        email: "",
        password: "",
        role: "Stagiaire",
        matricule: "",
        est_civil: false,
        corps_id: "",
        rank_id: "",
        speciality_id: "",
      });
      await loadDashboard();
    }
  };

  const handleCreateCorps = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await apiFetch("/api/admin/references/corps/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCorps),
    });
    if (response.ok) {
      setActionMessage(`Corps « ${newCorps.label} » (${newCorps.code}) créé.`);
      setNewCorps({ code: "", label: "" });
      await loadAdminReferences();
    }
  };

  const handleCreateRank = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await apiFetch("/api/admin/references/ranks/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRank),
    });
    if (response.ok) {
      const corpsLabel = referencesData.corps.find((c) => c.id === newRank.corps_id)?.label ?? newRank.corps_id;
      setActionMessage(`Grade « ${newRank.label} » (${newRank.code}) ajouté au corps ${corpsLabel}.`);
      setNewRank((prev) => ({ ...prev, code: "", label: "" }));
      await loadAdminReferences();
    }
  };

  const handleCreateSpeciality = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await apiFetch("/api/admin/references/specialities/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSpeciality),
    });
    if (response.ok) {
      const corpsLabel = referencesData.corps.find((c) => c.id === newSpeciality.corps_id)?.label ?? "";
      const corpsInfo = corpsLabel ? ` (${corpsLabel})` : "";
      setActionMessage(`Spécialité « ${newSpeciality.label} » (${newSpeciality.code})${corpsInfo} créée.`);
      setNewSpeciality({ code: "", label: "", corps_id: "" });
      await loadAdminReferences();
    }
  };

  const handleRenameCorps = async (corpsId: string, current: string) => {
    setRenameModal({ open: true, target: "corps", id: corpsId, value: current });
  };

  const handleRenameRank = async (rankId: string, current: string) => {
    setRenameModal({ open: true, target: "rank", id: rankId, value: current });
  };

  const handleRenameSpeciality = async (specialityId: string, current: string) => {
    setRenameModal({ open: true, target: "speciality", id: specialityId, value: current });
  };

  const handleSubmitRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameModal.target || !renameModal.id || !renameModal.value.trim()) return;
    const endpoint =
      renameModal.target === "corps"
        ? `/api/admin/references/corps/${renameModal.id}/`
        : renameModal.target === "rank"
          ? `/api/admin/references/ranks/${renameModal.id}/`
          : `/api/admin/references/specialities/${renameModal.id}/`;
    const response = await apiFetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: renameModal.value.trim() }),
    });
    if (response.ok) {
      const typeLabel = renameModal.target === "corps" ? "Corps" : renameModal.target === "rank" ? "Grade" : "Spécialité";
      setActionMessage(`${typeLabel} renommé en « ${renameModal.value.trim()} ».`);
      setRenameModal({ open: false, target: null, id: "", value: "" });
      await loadAdminReferences();
    }
  };

  const handleBulkCsvUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fileInput = document.getElementById("accounts-csv-input") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) return;
    const csvContent = await file.text();
    const response = await apiFetch("/api/admin/accounts/bulk-csv/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv_content: csvContent }),
    });
    const result = await response.json();
    if (response.ok) {
      const errNote = result.error_count ? ` (${result.error_count} lignes ignorees)` : "";
      setActionMessage(`Import termine: ${result.created_count} comptes crees${errNote}.`);
      setCsvErrors((result.errors as Array<{ line: number; error: string }>) ?? []);
      await loadDashboard();
    } else if (result.errors?.length) {
      setCsvErrors(result.errors as Array<{ line: number; error: string }>);
      setActionMessage(`Import echoue — ${result.error_count ?? result.errors.length} erreur(s). Voir details ci-dessous.`);
    } else {
      setCsvErrors([]);
      setActionMessage(result.detail ?? "Import echoue.");
    }
  };

  const triggerDownload = (base64: string, name: string, mimeType: string) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const openFichierFromApi = async (url: string, fallbackName: string) => {
    const response = await apiFetch(url);
    if (!response.ok) { setActionMessage(`Fichier introuvable (${url.split("/").filter(Boolean).pop()}).`); return; }
    const data: { fichier_base64: string; nom_fichier: string; mime_type: string } = await response.json();
    const name = data.nom_fichier || fallbackName;
    const mime = data.mime_type || "";
    if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
      setPdfViewer({ base64: data.fichier_base64, name, mimeType: mime });
    } else {
      triggerDownload(data.fichier_base64, name, mime);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  useEffect(() => {
      if (!user) return;
      if (user.role === "Admin") {
        void loadSubjects();
        void loadClasses();
      }
      if (user.role === "Admin" || user.role === "Superviseur") {
        void loadAdminReferences();
      }
    }, [user?.role]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "Admin" && adminView === "events") {
      void loadAdminEvents();
    }
  }, [user?.role, adminView]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "Admin" && adminView === "subjects" && subjectTab === "controls") {
      void loadSubjectControls(selectedSubjectId);
    }
  }, [user?.role, adminView, subjectTab, selectedSubjectId]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "Admin" && adminView === "subjects" && subjectTab === "courses") {
      void loadSubjectCourses(selectedSubjectId);
    }
  }, [user?.role, adminView, subjectTab, selectedSubjectId]);

  useEffect(() => {
    if (actionMessage) {
      setToastState({ kind: "success", message: actionMessage, closing: false });
      const closeTimer = window.setTimeout(() => setToastState((prev) => (prev ? { ...prev, closing: true } : prev)), 2800);
      const clearTimer = window.setTimeout(() => {
        setToastState(null);
        setActionMessage(null);
      }, 3050);
      return () => {
        window.clearTimeout(closeTimer);
        window.clearTimeout(clearTimer);
      };
    }
  }, [actionMessage]);

  useEffect(() => {
    if (dashboardError) {
      setToastState({ kind: "error", message: dashboardError, closing: false });
      const closeTimer = window.setTimeout(() => setToastState((prev) => (prev ? { ...prev, closing: true } : prev)), 3200);
      const clearTimer = window.setTimeout(() => {
        setToastState(null);
        setDashboardError(null);
      }, 3450);
      return () => {
        window.clearTimeout(closeTimer);
        window.clearTimeout(clearTimer);
      };
    }
  }, [dashboardError]);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">

      {user.role !== "Admin" ? (
        <section className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-accent">{t("dashboard.badge")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-app-dark">
            {t(`workspace.${user.role}.title`)}
          </h1>
          <p className="mt-3 text-sm text-app-dark/80">{t(`workspace.${user.role}.summary`)}</p>
        </section>
      ) : null}

      {loading ? (
        <section className="mt-6 grid gap-5">
          <article className="card-hover card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
          </article>
          <article className="card-hover card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <div className="skeleton skeleton-block" />
          </article>
        </section>
      ) : null}

      {pdfViewer ? (
        <PdfViewer
          base64={pdfViewer.base64}
          name={pdfViewer.name}
          onClose={() => setPdfViewer(null)}
          onDownload={() => { triggerDownload(pdfViewer.base64, pdfViewer.name, pdfViewer.mimeType); }}
        />
      ) : null}

      {toastState ? (
        <div className={`fixed right-4 top-20 z-40 max-w-md rounded-lg px-4 py-3 text-sm shadow-lg ${toastState.kind === "success" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"} ${toastState.closing ? "toast-exit" : `toast-enter ${toastState.kind === "error" ? "shake-error" : ""}`}`}>
          <span className={toastState.kind === "success" ? "checkmark-pop font-semibold" : "font-semibold"}>
            {toastState.kind === "success" ? "✓ " : "⚠ "}
          </span>
          {toastState.message}
        </div>
      ) : null}

      {user.role === "Instructeur" && instructeurData ? (
        <section className="mt-6 grid gap-5">
          {/* Tab bar */}
          <div className="flex gap-2 flex-wrap">
            {(["dashboard", "cours", "controles", "corriger", "reponse_controle", "sujet"] as const).map((tab) => {
              const labels = { dashboard: "Tableau de bord", cours: "Cours", controles: "Contrôles", corriger: "Corriger contrôle", reponse_controle: "Réponse contrôle", sujet: "Sujet fin de stage" };
              const badge = tab === "corriger" && instructeurData.controles.pending_corrections > 0
                ? ` (${instructeurData.controles.pending_corrections})`
                : tab === "cours" ? ` (${instructeurData.cours.total})` : tab === "controles" ? ` (${instructeurData.controles.total})` : tab === "sujet" ? ` (${instructeurData.sujets_fin_stage.total})` : "";
              const active = instructeurView === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setInstructeurView(tab)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold transition"
                  style={{
                    background: active ? "#25343F" : "white",
                    color: active ? "white" : "#25343F",
                    border: "1px solid #BFC9D1",
                  }}
                >
                  {labels[tab]}{badge}
                </button>
              );
            })}
          </div>

          {/* Dashboard */}
          {instructeurView === "dashboard" ? (
            <>
              <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Affectations et activité</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded-lg border border-app-muted/70 bg-app-soft px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-app-dark/60">Classes</p>
                    <p className="mt-1 text-xl font-semibold">{instructeurData.classes_count}</p>
                  </div>
                  <div className="rounded-lg border border-app-muted/70 bg-app-soft px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-app-dark/60">Cours publiés</p>
                    <p className="mt-1 text-xl font-semibold">{instructeurData.cours.published} <span className="text-sm font-normal text-app-dark/50">/ {instructeurData.cours.total}</span></p>
                  </div>
                  <div className="rounded-lg border border-app-muted/70 bg-app-soft px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-app-dark/60">À corriger</p>
                    <p className="mt-1 text-xl font-semibold text-app-accent">{instructeurData.controles.pending_corrections}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {instructeurData.classes.map((c) => (
                    <span className="rounded bg-app-soft px-2 py-1 text-xs" key={c.code}>{c.code} / {c.brigade}</span>
                  ))}
                  {instructeurData.classes.length === 0 ? <EmptyState message="Aucune classe assignee." /> : null}
                </div>
                <p className="mt-4 text-sm text-app-dark/60">Notifications non lues: <span className="font-semibold text-app-dark">{instructeurData.notifications.unread_count}</span></p>
              </article>
            </>
          ) : null}

          {/* Cours */}
          {instructeurView === "cours" ? (
            <>
              <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Créer un cours</h3>
                <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={handleCreateCourse}>
                  <Input label="Titre" value={courseTitle} onChange={setCourseTitle} />
                  <Input label="Description" value={courseDescription} onChange={setCourseDescription} />
                  <label className="grid gap-1 text-sm md:col-span-2">
                    Fichier RTF (optionnel)
                    <input
                      accept=".rtf,.doc,.docx,.pdf,application/rtf,text/rtf"
                      className="rounded border border-app-muted bg-white px-3 py-2 text-sm"
                      type="file"
                      onChange={(e) => setCourseFichierFile(e.target.files?.[0] ?? null)}
                    />
                    {courseFichierFile ? <span className="text-xs text-app-dark/60">{courseFichierFile.name}</span> : null}
                  </label>
                  <button className="rounded bg-app-dark px-3 py-2 text-sm font-semibold text-white md:col-span-2" type="submit">
                    Créer et publier le cours
                  </button>
                </form>
              </article>

              <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Mes cours</h3>
                <div className="mt-3 space-y-2">
                  {instructeurData.cours_list.map((c) => (
                    <div className="rounded border border-app-muted p-3" key={c.id}>
                      <p className="text-sm font-semibold">{c.title}</p>
                      <p className="text-xs text-app-dark/60">{c.status}</p>
                    </div>
                  ))}
                  {instructeurData.cours_list.length === 0 ? <EmptyState message="Aucun cours créé." /> : null}
                </div>
              </article>
            </>
          ) : null}

          {/* Contrôles */}
          {instructeurView === "controles" ? (
            <>
              <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Créer un contrôle</h3>
                <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={handleCreateControl}>
                  <label className="grid gap-1 text-sm">
                    Cours
                    <select
                      className="rounded border border-app-muted bg-white px-3 py-2"
                      value={controlCoursId}
                      onChange={(event) => setControlCoursId(event.target.value)}
                      required
                    >
                      <option value="">Selectionner</option>
                      {instructeurData.cours_list.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                    {instructeurData.cours_list.length === 0 ? <EmptyState message="Aucun cours disponible. Créez un cours d'abord." /> : null}
                  </label>
                  <Input label="Nom du contrôle" value={controlName} onChange={setControlName} />
                  <Input label="Énoncé (texte)" value={controlPrompt} onChange={setControlPrompt} />
                  <label className="grid gap-1 text-sm md:col-span-2">
                    Énoncé RTF (optionnel)
                    <input
                      accept=".rtf,.doc,.docx,.pdf,application/rtf,text/rtf"
                      className="rounded border border-app-muted bg-white px-3 py-2 text-sm"
                      type="file"
                      onChange={(e) => setControlEnonceFichier(e.target.files?.[0] ?? null)}
                    />
                    {controlEnonceFichier ? <span className="text-xs text-app-dark/60">{controlEnonceFichier.name}</span> : null}
                  </label>
                  <button className="rounded bg-app-dark px-3 py-2 text-sm font-semibold text-white md:col-span-2" type="submit">
                    Publier contrôle
                  </button>
                </form>
              </article>

              <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Mes contrôles</h3>
                <div className="mt-3 space-y-2">
                  {instructeurData.controles_list.map((c) => (
                    <div className="rounded border border-app-muted p-3" key={c.id}>
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-xs text-app-dark/60">{c.cours_title} — {c.status}</p>
                    </div>
                  ))}
                  {instructeurData.controles_list.length === 0 ? <EmptyState message="Aucun contrôle créé." /> : null}
                </div>
              </article>
            </>
          ) : null}

          {/* Corriger contrôle */}
          {instructeurView === "corriger" ? (
            <>
              <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Soumissions à noter</h3>
                <div className="mt-3 space-y-3">
                  {instructeurData.pending_submissions.length === 0 ? <EmptyState message="Aucune soumission en attente." /> : null}
                  {instructeurData.pending_submissions.map((s) => (
                    <div className="rounded border border-app-muted p-3" key={s.soumission_id}>
                      <p className="text-sm font-semibold">{s.controle_name}</p>
                      <p className="text-xs text-app-dark/70">Stagiaire #{s.stagiaire_id} · soumis le {new Date(s.submitted_at).toLocaleDateString("fr-FR")}</p>
                      <button
                        className="mt-1 rounded border border-app-muted px-2 py-1 text-xs text-app-dark/70 hover:bg-app-muted"
                        type="button"
                        onClick={() => void openFichierFromApi(`/api/instructeur/soumissions/${s.soumission_id}/fichier/`, "reponse.rtf")}
                      >
                        Télécharger réponse RTF
                      </button>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <Input label="Note /20" value={evalNote[s.soumission_id] ?? ""} onChange={(v) => setEvalNote((prev) => ({ ...prev, [s.soumission_id]: v }))} />
                        <Input label="Commentaire" value={evalCorrection[s.soumission_id] ?? ""} onChange={(v) => setEvalCorrection((prev) => ({ ...prev, [s.soumission_id]: v }))} />
                      </div>
                      <button className="mt-2 rounded bg-app-dark px-3 py-1.5 text-xs text-white" type="button" onClick={() => void handleEvaluate(s.soumission_id)}>
                        Publier la note
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Publier la correction</h3>
                <div className="mt-3 space-y-3">
                  {instructeurData.controles_list.map((c) => (
                    <div className="rounded border border-app-muted p-3" key={c.id}>
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-xs text-app-dark/60 mb-2">{c.cours_title}</p>
                      <Input
                        label="Texte de correction"
                        value={correctionText[c.id] ?? ""}
                        onChange={(v) => setCorrectionText((prev) => ({ ...prev, [c.id]: v }))}
                      />
                      <button className="mt-2 rounded bg-app-dark px-3 py-1.5 text-xs text-white" type="button" onClick={() => void handlePublishCorrection(c.id)}>
                        Publier correction
                      </button>
                    </div>
                  ))}
                  {instructeurData.controles_list.length === 0 ? <EmptyState message="Aucun contrôle disponible." /> : null}
                </div>
              </article>
            </>
          ) : null}

          {/* Réponse contrôle */}
          {instructeurView === "reponse_controle" ? (
            <>
              <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Corrections officielles publiées</h3>
                <p className="mt-1 text-sm text-app-dark/60">Publiez la correction modèle pour chaque contrôle. Les stagiaires pourront la consulter.</p>
                <div className="mt-4 space-y-3">
                  {instructeurData.controles_list.map((c) => (
                    <div className="rounded border border-app-muted p-4" key={c.id}>
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-xs text-app-dark/60 mb-3">{c.cours_title} — {c.status}</p>
                      <Input
                        label="Texte de la correction officielle"
                        value={correctionText[c.id] ?? ""}
                        onChange={(v) => setCorrectionText((prev) => ({ ...prev, [c.id]: v }))}
                      />
                      <button className="mt-2 rounded bg-app-dark px-3 py-1.5 text-xs text-white" type="button" onClick={() => void handlePublishCorrection(c.id)}>
                        Publier correction
                      </button>
                    </div>
                  ))}
                  {instructeurData.controles_list.length === 0 ? <EmptyState message="Aucun contrôle pour le moment." /> : null}
                </div>
              </article>
            </>
          ) : null}

          {/* Sujet fin de stage */}
          {instructeurView === "sujet" ? (
            <>
              <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Sujets fin de stage encadrés</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-app-muted/70 bg-app-soft px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-app-dark/60">Total</p>
                    <p className="mt-1 text-xl font-semibold">{instructeurData.sujets_fin_stage.total}</p>
                  </div>
                  <div className="rounded-lg border border-app-muted/70 bg-app-soft px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-app-dark/60">En cours</p>
                    <p className="mt-1 text-xl font-semibold text-app-accent">{instructeurData.sujets_fin_stage.active}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {instructeurData.sujets_fin_stage.list.map((s, i) => (
                    <div className="rounded border border-app-muted p-3" key={i}>
                      <p className="text-sm font-semibold">{s.sujet}</p>
                      <p className="text-xs text-app-dark/60">Stagiaire #{s.stagiaire_id} · État: <span className={s.etat === "EN_COURS" ? "text-app-accent font-semibold" : ""}>{s.etat}</span></p>
                    </div>
                  ))}
                  {instructeurData.sujets_fin_stage.list.length === 0 ? <EmptyState message="Aucun sujet de fin de stage assigné." /> : null}
                </div>
              </article>
            </>
          ) : null}
        </section>
      ) : null}

      {user.role === "Stagiaire" && stageaireData ? (
        <section className="mt-6 flex gap-0 min-h-[calc(100vh-120px)]">
          {/* Sidebar */}
          <aside className="sidebar-animated w-52 min-w-[13rem] flex-shrink-0 flex flex-col overflow-hidden rounded-l-2xl border border-app-muted bg-white shadow-sm">
            {/* User info */}
            <div className="px-4 py-4 border-b border-app-muted/60">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-app-dark text-sm font-bold text-white">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-app-dark">{user.username}</p>
                  <p className="text-xs text-app-dark/50">Stagiaire</p>
                </div>
              </div>
            </div>
            {/* Nav items */}
            <nav className="flex-1 px-2 py-3 space-y-1">
              {(["dashboard", "cours", "controles", "reponse_controle", "sujet"] as const).map((tab) => {
                const labels: Record<string, string> = { dashboard: "Tableau de bord", cours: "Cours", controles: "Contrôles", reponse_controle: "Réponse contrôle", sujet: "Sujet fin de stage" };
                const badge = tab === "controles" && stageaireData.controls.pending_count > 0
                  ? stageaireData.controls.pending_count
                  : tab === "cours" ? (stageaireData.cours_list ?? []).length
                  : tab === "reponse_controle" ? (stageaireData.soumissions_detail ?? []).length
                  : 0;
                const active = stageaireView === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStageaireView(tab)}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition text-left"
                    style={{
                      background: active ? "#25343F" : "transparent",
                      color: active ? "white" : "#25343F",
                      border: active ? "none" : "none",
                    }}
                  >
                    <span className="flex-1 truncate">{labels[tab]}</span>
                    {badge > 0 ? (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-xs font-bold leading-none"
                        style={{ background: active ? "rgba(255,255,255,0.2)" : "#FF9B51", color: "white" }}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
            {/* Stats footer */}
            <div className="px-4 py-3 border-t border-app-muted/60 space-y-1.5">
              <div className="flex justify-between text-xs text-app-dark/50">
                <span>Cours</span>
                <span className="font-semibold text-app-dark">{(stageaireData.cours_list ?? []).length}</span>
              </div>
              <div className="flex justify-between text-xs text-app-dark/50">
                <span>Soumis</span>
                <span className="font-semibold text-app-dark">{stageaireData.controls.submitted_count}</span>
              </div>
              <div className="flex justify-between text-xs text-app-dark/50">
                <span>En attente</span>
                <span className="font-semibold text-app-accent">{stageaireData.controls.pending_count}</span>
              </div>
              {stageaireData.notifications.unread_count > 0 && (
                <div className="flex justify-between text-xs text-app-dark/50">
                  <span>Notifs</span>
                  <span className="font-semibold text-app-accent">{stageaireData.notifications.unread_count}</span>
                </div>
              )}
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 p-6 overflow-y-auto grid gap-5 content-start">

            {/* Dashboard */}
            {stageaireView === "dashboard" ? (
              <>
                <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold">Vue d'ensemble</h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <div className="rounded-lg border border-app-muted/70 bg-app-soft px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-app-dark/60">Cours disponibles</p>
                      <p className="mt-1 text-xl font-semibold">{(stageaireData.cours_list ?? []).length}</p>
                    </div>
                    <div className="rounded-lg border border-app-muted/70 bg-app-soft px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-app-dark/60">Contrôles soumis</p>
                      <p className="mt-1 text-xl font-semibold">{stageaireData.controls.submitted_count}</p>
                    </div>
                    <div className="rounded-lg border border-app-muted/70 bg-app-soft px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-app-dark/60">En attente</p>
                      <p className="mt-1 text-xl font-semibold text-app-accent">{stageaireData.controls.pending_count}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {stageaireData.classes.map((entry) => (
                      <span className="rounded bg-app-soft px-2 py-1 text-xs" key={entry.classe_code}>
                        {entry.classe_code} — {entry.brigade_code}
                      </span>
                    ))}
                    {stageaireData.classes.length === 0 ? <EmptyState message="Aucune classe assignée." /> : null}
                  </div>
                  {stageaireData.notes.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-app-dark/70">Notes publiées</p>
                      <div className="mt-2 space-y-1">
                        {stageaireData.notes.map((note, index) => (
                          <p className="text-sm" key={`${note.controle}-${index}`}>
                            {note.controle}: <span className="font-semibold">{note.note}/20</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="mt-4 text-sm text-app-dark/60">Notifications non lues: <span className="font-semibold text-app-dark">{stageaireData.notifications.unread_count}</span></p>
                  {stageaireData.notifications.latest.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {stageaireData.notifications.latest.map((n) => (
                        <p className="text-xs text-app-dark/60" key={n.id}>[{n.type}] {n.title}</p>
                      ))}
                    </div>
                  )}
                </article>
              </>
            ) : null}

            {/* Cours — list */}
            {stageaireView === "cours" && !selectedCours ? (
              <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Cours disponibles</h3>
                <div className="mt-3 space-y-2">
                  {(stageaireData.cours_list ?? []).map((c) => (
                    <div
                      className="cursor-pointer rounded-xl border border-app-muted p-4 transition-colors hover:border-app-dark/40 hover:bg-app-soft"
                      key={c.id}
                      onClick={() => void handleOpenCours(c.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{c.titre}</p>
                        <span className="text-xs text-app-dark/40">→</span>
                      </div>
                      {c.description ? <p className="mt-1 text-xs text-app-dark/60">{c.description}</p> : null}
                      <p className="mt-1 text-xs text-app-dark/50">Instructeur: {c.instructeur} &mdash; {c.controles_count} contrôle(s)</p>
                    </div>
                  ))}
                  {(stageaireData.cours_list ?? []).length === 0 ? <EmptyState message="Aucun cours publié pour le moment." /> : null}
                </div>
              </article>
            ) : null}

            {/* Cours — detail with PDF viewer */}
            {stageaireView === "cours" && selectedCours ? (
              <>
                {/* Back button + header */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedCours(null); setCoursFileCache({}); }}
                    className="flex items-center gap-1.5 rounded-lg border border-app-muted bg-white px-3 py-2 text-sm font-semibold text-app-dark shadow-sm transition hover:bg-app-soft"
                  >
                    ← Retour aux cours
                  </button>
                  <h3 className="text-lg font-semibold truncate">{selectedCours.titre}</h3>
                </div>

                {/* Course meta */}
                <article className="rounded-2xl border border-app-muted bg-white p-5 shadow-sm">
                  {selectedCours.description ? <p className="text-sm text-app-dark/70">{selectedCours.description}</p> : null}
                  <p className="mt-2 text-xs text-app-dark/50">Instructeur: <span className="font-semibold text-app-dark">{selectedCours.instructeur}</span> &mdash; Déposé le {selectedCours.date_depot}</p>
                </article>

                {/* Course files — inline viewer */}
                {selectedCours.fichiers.map((f) => {
                  const cached = coursFileCache[f.id_cours_fichier];
                  const isPdf = cached
                    ? cached.mimeType === "application/pdf" || cached.name.toLowerCase().endsWith(".pdf")
                    : f.mime_type === "application/pdf" || f.nom_fichier.toLowerCase().endsWith(".pdf");

                  if (!cached) {
                    // Still loading
                    return (
                      <div key={f.id_cours_fichier} className="flex items-center gap-3 rounded-xl border border-app-muted bg-white px-4 py-4">
                        <div className="skeleton h-5 w-5 rounded" />
                        <span className="text-sm text-app-dark/50">Chargement de {f.nom_fichier}…</span>
                      </div>
                    );
                  }

                  if (isPdf) {
                    return (
                      <InlinePdfViewer key={f.id_cours_fichier} base64={cached.base64} name={cached.name} />
                    );
                  }

                  // Non-PDF: show label only, no download button
                  return (
                    <div key={f.id_cours_fichier} className="flex items-center gap-3 rounded-xl border border-app-muted bg-white px-4 py-4">
                      <span className="text-base">📎</span>
                      <div>
                        <p className="text-sm font-semibold text-app-dark">{f.nom_fichier}</p>
                        <p className="text-xs text-app-dark/40">Aperçu non disponible pour ce format</p>
                      </div>
                    </div>
                  );
                })}
                {selectedCours.fichiers.length === 0 && (
                  <p className="text-sm text-app-dark/40 italic">Aucun fichier joint à ce cours.</p>
                )}

                {/* Contrôles */}
                {selectedCours.controles.length > 0 ? (
                  <article className="rounded-2xl border border-app-muted bg-white p-5 shadow-sm">
                    <h4 className="font-semibold text-app-dark">Contrôles associés</h4>
                    <div className="mt-3 space-y-2">
                      {selectedCours.controles.map((ctrl) => (
                        <div className="rounded-xl border border-app-muted p-3" key={ctrl.id}>
                          <p className="text-sm font-semibold">{ctrl.nom}</p>
                          {ctrl.enonce ? <p className="mt-1 text-xs text-app-dark/60">{ctrl.enonce}</p> : null}
                          <p className="mt-1 text-xs text-app-dark/40">Barème: {ctrl.bareme}{ctrl.date_limite ? ` | Limite: ${ctrl.date_limite}` : ""}</p>
                          {ctrl.has_fichier && (
                            <p className="mt-1 text-xs text-app-dark/40">📎 Énoncé: {ctrl.nom_fichier_enonce}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </article>
                ) : null}
              </>
            ) : null}

            {/* Contrôles */}
            {stageaireView === "controles" ? (
              <>
                <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold">Contrôles à réaliser</h3>
                  <p className="mt-1 text-sm text-app-dark/60">Disponibles: {stageaireData.controls.available_count} · Soumis: {stageaireData.controls.submitted_count} · En attente: {stageaireData.controls.pending_count}</p>
                  <div className="mt-3 space-y-3">
                    {stageaireData.controls_list.map((control) => {
                      const submitted = stageaireData.submitted_control_ids.includes(control.id);
                      return (
                        <div className="rounded border border-app-muted p-3" key={control.id}>
                          <p className="text-sm font-semibold">{control.name}</p>
                          <p className="text-xs text-app-dark/70">{control.cours}{control.deadline ? ` · Limite: ${new Date(control.deadline).toLocaleDateString("fr-FR")}` : ""}</p>
                          {submitted ? (
                            <p className="mt-1 text-xs font-semibold text-emerald-700">✓ Réponse déjà soumise.</p>
                          ) : (
                            <>
                              <Input
                                label="Commentaire (optionnel)"
                                value={submissionAnswers[control.id] ?? ""}
                                onChange={(v) => setSubmissionAnswers((prev) => ({ ...prev, [control.id]: v }))}
                              />
                              <label className="mt-2 grid gap-1 text-xs">
                                Fichier réponse RTF
                                <input
                                  accept=".rtf,.doc,.docx,.pdf,application/rtf,text/rtf"
                                  className="rounded border border-app-muted bg-white px-2 py-1 text-xs"
                                  type="file"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) setSubmissionFiles((prev) => ({ ...prev, [control.id]: f }));
                                  }}
                                />
                                {submissionFiles[control.id] ? <span className="text-app-dark/60">{submissionFiles[control.id].name}</span> : null}
                              </label>
                              <button className="mt-2 rounded bg-app-dark px-3 py-1.5 text-xs text-white" type="button" onClick={() => void handleSubmitAnswer(control.id)}>
                                Envoyer la réponse
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {stageaireData.controls_list.length === 0 ? <EmptyState message="Aucun contrôle disponible pour le moment." /> : null}
                  </div>
                </article>

                {stageaireData.notes.length > 0 ? (
                  <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold">Notes publiées</h3>
                    <div className="mt-3 space-y-2">
                      {stageaireData.notes.map((note, index) => (
                        <div className="flex items-center justify-between rounded border border-app-muted px-3 py-2" key={`${note.controle}-${index}`}>
                          <p className="text-sm">{note.controle}</p>
                          <p className="text-sm font-semibold">{note.note}/20</p>
                        </div>
                      ))}
                    </div>
                  </article>
                ) : null}
              </>
            ) : null}

            {/* Réponse contrôle */}
            {stageaireView === "reponse_controle" ? (
              <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Mes réponses aux contrôles</h3>
                <p className="mt-1 text-sm text-app-dark/60">Historique de vos soumissions et corrections officielles.</p>
                <div className="mt-4 space-y-3">
                  {(stageaireData.soumissions_detail ?? []).map((s) => (
                    <div className="rounded border border-app-muted p-4" key={s.soumission_id}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{s.controle_name}</p>
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${s.statut === "SOUMIS" ? "bg-blue-100 text-blue-700" : s.statut === "RETARD" ? "bg-red-100 text-red-700" : "bg-app-soft text-app-dark/60"}`}>
                          {s.statut}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-app-dark/50">Soumis le {new Date(s.submitted_at).toLocaleDateString("fr-FR")}{s.has_fichier ? " · fichier joint" : ""}</p>
                      {s.note !== null && (
                        <p className="mt-2 text-sm font-semibold text-emerald-700">Note: {s.note}/20</p>
                      )}
                      {s.correction_publiee ? (
                        <div className="mt-3 rounded bg-app-soft p-3">
                          <p className="text-xs font-semibold text-app-dark/70 mb-1">{s.correction_titre ? `Correction — ${s.correction_titre}` : "Correction officielle"}</p>
                          <p className="text-sm text-app-dark/80 whitespace-pre-wrap">{s.correction_publiee}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-app-dark/40 italic">Aucune correction publiée pour ce contrôle.</p>
                      )}
                    </div>
                  ))}
                  {(stageaireData.soumissions_detail ?? []).length === 0 ? <EmptyState message="Vous n'avez encore soumis aucune réponse." /> : null}
                </div>
              </article>
            ) : null}

            {/* Sujet fin de stage */}
            {stageaireView === "sujet" ? (
              <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Sujet de fin de stage</h3>
                {stageaireData.sujet_fin_stage ? (
                  <div className="mt-4">
                    <div className="rounded-xl border border-app-muted bg-app-soft p-4">
                      <p className="text-base font-semibold">{stageaireData.sujet_fin_stage.titre}</p>
                      {stageaireData.sujet_fin_stage.description ? (
                        <p className="mt-2 text-sm text-app-dark/70 whitespace-pre-wrap">{stageaireData.sujet_fin_stage.description}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-app-dark/60">
                        <span>Encadrant: <span className="font-semibold text-app-dark">{stageaireData.sujet_fin_stage.encadrant}</span></span>
                        <span>État: <span className={`font-semibold ${stageaireData.sujet_fin_stage.etat === "EN_COURS" ? "text-app-accent" : stageaireData.sujet_fin_stage.etat === "TERMINE" ? "text-emerald-600" : "text-red-500"}`}>{stageaireData.sujet_fin_stage.etat}</span></span>
                        {stageaireData.sujet_fin_stage.date_affectation ? (
                          <span>Affecté le: {new Date(stageaireData.sujet_fin_stage.date_affectation).toLocaleDateString("fr-FR")}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <EmptyState message="Aucun sujet de fin de stage ne vous a encore été affecté." />
                  </div>
                )}
              </article>
            ) : null}

          </div>
        </section>
      ) : null}

        {user.role === "Superviseur" && superviseurData ? (
          <section className="mt-6 grid gap-5">
            <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">Monitoring formation</h3>
              <p className="mt-2 text-sm">Classes: {superviseurData.monitoring.classes_count}</p>
              <p className="text-sm">Brigades: {superviseurData.monitoring.brigades_count}</p>
              <p className="text-sm">Controles: {superviseurData.monitoring.controles_count}</p>
              <p className="text-sm">Notes publiees: {superviseurData.monitoring.published_notes_count}</p>
              <p className="text-sm">Notifications non lues: {superviseurData.notifications.unread_count}</p>
            </article>
            <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">Controles et notes par classe/brigade</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                  <tr className="border-b border-app-muted text-left">
                    <th className="py-2">Classe</th>
                    <th className="py-2">Brigade</th>
                    <th className="py-2">Controles</th>
                    <th className="py-2">Notes publiees</th>
                    <th className="py-2">Moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  {superviseurData.classes.map((c) => (
                    <tr className="border-b border-app-muted/40" key={`${c.classe_code}-${c.brigade_code}`}>
                      <td className="py-2">{c.classe_code}</td>
                      <td className="py-2">{c.brigade_code}</td>
                      <td className="py-2">{c.controles_count}</td>
                      <td className="py-2">{c.notes_published_count}</td>
                      <td className="py-2">{c.note_moyenne ?? "-"}</td>
                    </tr>
                  ))}
                  {superviseurData.classes.length === 0 ? (
                    <tr>
                      <td className="py-2 text-sm text-app-dark/70" colSpan={5}>Aucune classe a afficher.</td>
                    </tr>
                  ) : null}
                    </tbody>
                  </table>
                </div>
              </article>
              <ReferenceManagementSection
                referencesData={referencesData}
                referenceTab={referenceTab}
                setReferenceTab={setReferenceTab}
                newCorps={newCorps}
                setNewCorps={setNewCorps}
                newRank={newRank}
                setNewRank={setNewRank}
                newSpeciality={newSpeciality}
                setNewSpeciality={setNewSpeciality}
                handleCreateCorps={handleCreateCorps}
                handleCreateRank={handleCreateRank}
                handleCreateSpeciality={handleCreateSpeciality}
                handleRenameCorps={handleRenameCorps}
                handleRenameRank={handleRenameRank}
                handleRenameSpeciality={handleRenameSpeciality}
              />
          </section>
        ) : null}

      {user.role === "Coordinateur" && coordinateurData ? (
        <section className="mt-6 grid gap-5">
          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Monitoring global (niveau coordinateur)</h3>
            <p className="mt-2 text-sm">Controles total: {coordinateurData.monitoring.controls_total}</p>
            <p className="text-sm">Controles publies: {coordinateurData.monitoring.controls_published}</p>
            <p className="text-sm">Notes publiees: {coordinateurData.monitoring.notes_published}</p>
            <p className="text-sm">Notifications non lues: {coordinateurData.notifications.unread_count}</p>
          </article>
          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Vue par brigade</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-app-muted text-left">
                    <th className="py-2">Brigade</th>
                    <th className="py-2">Classes</th>
                    <th className="py-2">Stagiaires</th>
                    <th className="py-2">Notes publiees</th>
                    <th className="py-2">Moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  {coordinateurData.monitoring.brigades.map((b) => (
                    <tr className="border-b border-app-muted/40" key={b.brigade_code}>
                      <td className="py-2">{b.brigade_code}</td>
                      <td className="py-2">{b.classes_count}</td>
                      <td className="py-2">{b.stagiaires_count}</td>
                      <td className="py-2">{b.published_notes_count}</td>
                      <td className="py-2">{b.note_moyenne ?? "-"}</td>
                    </tr>
                  ))}
                  {coordinateurData.monitoring.brigades.length === 0 ? (
                    <tr>
                      <td className="py-2 text-sm text-app-dark/70" colSpan={5}>Aucune brigade a afficher.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {user.role === "Admin" && adminData ? (
        <section className="mt-6 grid gap-5 md:grid-cols-[220px_1fr]">
          <aside className="sidebar-animated card-hover rounded-2xl border border-app-muted bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-accent">{t("admin.panelTitle")}</p>
            <div className="mt-3 grid gap-2">
              <AdminNavButton active={adminView === "overview"} onClick={() => {
                setAdminView("overview");
                setSelectedAdminUser(null);
              }}>
                {t("admin.navOverview")}
              </AdminNavButton>
              <AdminNavButton active={adminView === "users"} onClick={() => {
                setAdminView("users");
                setSelectedAdminUser(null);
              }}>
                {t("admin.navUsers")}
              </AdminNavButton>
              <AdminNavButton active={adminView === "accounts"} onClick={() => {
                setAdminView("accounts");
                setSelectedAdminUser(null);
              }}>
                {t("admin.navAccounts")}
              </AdminNavButton>
              <AdminNavButton active={adminView === "subjects"} onClick={() => {
                setAdminView("subjects");
                setSelectedAdminUser(null);
              }}>
                {t("admin.navSubjects")}
              </AdminNavButton>
              <AdminNavButton active={adminView === "classes"} onClick={() => {
                setAdminView("classes");
                setSelectedAdminUser(null);
              }}>
                {t("admin.navClasses")}
              </AdminNavButton>
              <AdminNavButton active={adminView === "references"} onClick={() => {
                setAdminView("references");
                setSelectedAdminUser(null);
              }}>
                References
              </AdminNavButton>
              <AdminNavButton active={adminView === "events"} onClick={() => {
                setAdminView("events");
                setSelectedAdminUser(null);
              }}>
                Events
              </AdminNavButton>
            </div>
          </aside>

          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            {adminView === "overview" ? (
              <PanelSection title="Gestion de la plateforme">
                <MetricGrid>
                  <MetricCard label="Utilisateurs" value={adminData.platform.users_total} />
                  <MetricCard label="Utilisateurs actifs" value={adminData.platform.users_active} />
                  <MetricCard label="Cours" value={adminData.platform.cours_total} />
                  <MetricCard label="Controles" value={adminData.platform.controles_total} />
                  <MetricCard label="Soumissions" value={adminData.platform.soumissions_total} />
                </MetricGrid>
              </PanelSection>
            ) : null}

            {adminView === "users" && !selectedAdminUser ? (
              <PanelSection title="Utilisateurs">
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-app-muted text-left">
                        <th className="py-2">Username</th>
                        <th className="py-2">Role</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminData.users.map((u) => (
                        <tr className="border-b border-app-muted/40" key={u.id}>
                          <td className="py-2">
                            <button className="text-left text-app-dark underline-offset-2 hover:underline" onClick={() => setSelectedAdminUser(u)} type="button">
                              {u.username}
                            </button>
                          </td>
                          <td className="py-2">{u.role}</td>
                          <td className="py-2">{u.is_active ? "Actif" : "Inactif"}</td>
                          <td className="py-2">
                            <button
                              className="rounded bg-app-dark px-2 py-1 text-xs text-white disabled:opacity-50"
                              disabled={u.id === user.id}
                              onClick={() => void handleToggleUserStatus(u.id)}
                              type="button"
                            >
                              {u.is_active ? "Desactiver" : "Activer"}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {adminData.users.length === 0 ? (
                        <tr>
                          <td className="py-2 text-sm text-app-dark/70" colSpan={4}>Aucun utilisateur trouve.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </PanelSection>
            ) : null}

            {adminView === "users" && selectedAdminUser ? (
              <PanelSection title="User details">
                <BackButton onClick={() => setSelectedAdminUser(null)} />
                <MetricGrid>
                  <MetricCard label="Username" value={selectedAdminUser.username} />
                  <MetricCard label="Email" value={selectedAdminUser.email || "-"} />
                  <MetricCard label="Role" value={selectedAdminUser.role} />
                  <MetricCard label="Status" value={selectedAdminUser.is_active ? "Actif" : "Inactif"} />
                </MetricGrid>
                <button
                  className="mt-3 rounded bg-app-dark px-3 py-1.5 text-xs text-white disabled:opacity-50"
                  disabled={selectedAdminUser.id === user.id}
                  onClick={async () => {
                    await handleToggleUserStatus(selectedAdminUser.id);
                    setSelectedAdminUser(null);
                  }}
                  type="button"
                >
                  {selectedAdminUser.is_active ? "Desactiver" : "Activer"}
                </button>
              </PanelSection>
            ) : null}

            {adminView === "accounts" ? (
              <div className="grid gap-6">
                <PanelSection
                  title="Gestion des comptes"
                  subtitle="Creer des comptes pour tous les roles ou importer en masse par CSV."
                />

                <SubCard title="Creation unitaire">
                  <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={handleCreateAccount}>
                    <Input
                      label="Username"
                      value={accountForm.username}
                      onChange={(value) => setAccountForm((prev) => ({ ...prev, username: value }))}
                    />
                    <Input
                      label="Email"
                      value={accountForm.email}
                      onChange={(value) => setAccountForm((prev) => ({ ...prev, email: value }))}
                    />
                    <Input
                      label="Password"
                      type="password"
                      value={accountForm.password}
                      onChange={(value) => setAccountForm((prev) => ({ ...prev, password: value }))}
                    />
                    <label className="grid gap-1 text-sm font-medium text-app-dark">
                      Role
                      <select
                        className="rounded-md border border-app-muted bg-white px-3 py-2 outline-none focus:border-app-accent"
                        value={accountForm.role}
                        onChange={(event) =>
                          setAccountForm((prev) => ({
                            ...prev,
                            role: event.target.value,
                            est_civil: event.target.value === "Instructeur" ? prev.est_civil : false,
                          }))
                        }
                      >
                        {["Instructeur", "Stagiaire", "Superviseur", "Coordinateur", "Admin"].map((roleName) => (
                          <option key={roleName} value={roleName}>
                            {roleName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input
                      label={accountForm.role === "Instructeur" && accountForm.est_civil ? "Matricule (optionnel)" : "Matricule"}
                      value={accountForm.matricule}
                      onChange={(value) => setAccountForm((prev) => ({ ...prev, matricule: value }))}
                      required={!(accountForm.role === "Instructeur" && accountForm.est_civil)}
                    />
                    {accountForm.role === "Instructeur" ? (
                      <label className="flex items-center gap-2 text-sm font-medium text-app-dark">
                        <input
                          checked={accountForm.est_civil}
                          onChange={(event) => setAccountForm((prev) => ({ ...prev, est_civil: event.target.checked }))}
                          type="checkbox"
                        />
                        Instructeur civil
                      </label>
                    ) : null}
                    {!(accountForm.role === "Instructeur" && accountForm.est_civil) ? (
                      <>
                        <label className="grid gap-1 text-sm font-medium text-app-dark">
                          Corp
                          <select
                            className="rounded-md border border-app-muted bg-white px-3 py-2 outline-none focus:border-app-accent"
                            onChange={(event) =>
                              setAccountForm((prev) => ({ ...prev, corps_id: event.target.value, rank_id: "", speciality_id: "" }))
                            }
                            required
                            value={accountForm.corps_id}
                          >
                            <option value="">Selectionner</option>
                            {referencesData.corps.map((corp) => (
                              <option key={corp.id} value={corp.id}>
                                {corp.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1 text-sm font-medium text-app-dark">
                          Rank
                          <select
                            className="rounded-md border border-app-muted bg-white px-3 py-2 outline-none focus:border-app-accent"
                            onChange={(event) => setAccountForm((prev) => ({ ...prev, rank_id: event.target.value }))}
                            required
                            value={accountForm.rank_id}
                          >
                            <option value="">Selectionner</option>
                            {referencesData.ranks
                              .filter((rank) => rank.corps_id === accountForm.corps_id)
                              .map((rank) => (
                                <option key={rank.id} value={rank.id}>
                                  {rank.label}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="grid gap-1 text-sm font-medium text-app-dark">
                          Speciality
                          <select
                            className="rounded-md border border-app-muted bg-white px-3 py-2 outline-none focus:border-app-accent"
                            onChange={(event) => setAccountForm((prev) => ({ ...prev, speciality_id: event.target.value }))}
                            required
                            value={accountForm.speciality_id}
                          >
                            <option value="">Selectionner</option>
                            {referencesData.specialities
                              .filter((s) => !s.corps_id || s.corps_id === accountForm.corps_id)
                              .map((speciality) => (
                                <option key={speciality.id} value={speciality.id}>
                                  {speciality.label}
                                </option>
                              ))}
                          </select>
                        </label>
                      </>
                    ) : null}
                    <button className="rounded bg-app-dark px-3 py-2 text-sm font-semibold text-white md:col-span-2" type="submit">
                      Creer le compte
                    </button>
                  </form>
                </SubCard>

                <SubCard title="Import CSV (bulk)">
                  <p className="mt-1 text-xs text-app-dark/70">
                    Headers attendus: username,email,password,role,matricule,est_civil,corps_id,rank_id,speciality_id
                  </p>
                  <p className="mt-1 text-xs text-app-dark/50">
                    Roles valides: Instructeur, Stagiaire, Superviseur, Coordinateur, Admin. Pour Instructeur civil: est_civil=true, laisser corps/rank/speciality vides.
                  </p>
                  {referencesData.corps.length > 0 && (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer font-semibold text-app-dark/70">IDs de reference (corps / ranks / specialites)</summary>
                      <div className="mt-2 grid gap-2">
                        <div>
                          <p className="font-semibold text-app-dark/60">Corps</p>
                          {referencesData.corps.map((c) => (
                            <p key={c.id} className="font-mono text-app-dark/50">{c.id} — {c.label}</p>
                          ))}
                        </div>
                        <div>
                          <p className="font-semibold text-app-dark/60">Ranks</p>
                          {referencesData.ranks.map((r) => (
                            <p key={r.id} className="font-mono text-app-dark/50">{r.id} — {r.label} ({referencesData.corps.find((c) => c.id === r.corps_id)?.label ?? r.corps_id})</p>
                          ))}
                        </div>
                        <div>
                          <p className="font-semibold text-app-dark/60">Specialites</p>
                          {referencesData.specialities.map((s) => (
                            <p key={s.id} className="font-mono text-app-dark/50">{s.id} — {s.label}</p>
                          ))}
                        </div>
                      </div>
                    </details>
                  )}
                  <form className="mt-3 grid gap-3" onSubmit={handleBulkCsvUpload}>
                    <input
                      id="accounts-csv-input"
                      accept=".csv,text/csv"
                      className="rounded border border-app-muted bg-white px-3 py-2 text-sm"
                      onChange={(event) => setCsvFileName(event.target.files?.[0]?.name ?? "")}
                      type="file"
                      required
                    />
                    {csvFileName ? <p className="text-xs text-app-dark/70">Fichier: {csvFileName}</p> : null}
                    <button className="rounded bg-app-dark px-3 py-2 text-sm font-semibold text-white" type="submit">
                      Importer les comptes
                    </button>
                  </form>
                  {csvErrors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-red-600">{csvErrors.length} erreur(s) de validation:</p>
                      <div className="mt-1 max-h-48 overflow-y-auto rounded border border-red-200 bg-red-50 p-2">
                        {csvErrors.map((e, i) => (
                          <p key={i} className="text-xs text-red-700">
                            <span className="font-semibold">Ligne {e.line}:</span> {e.error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </SubCard>
              </div>
            ) : null}

            {adminView === "subjects" ? (
              <div className="grid gap-6">
                <div className="flex flex-wrap items-center gap-2">
                  <TabButton active={subjectTab === "subjects"} onClick={() => setSubjectTab("subjects")}>
                    Subjects
                  </TabButton>
                  <TabButton active={subjectTab === "controls"} onClick={() => setSubjectTab("controls")}>
                    Controls
                  </TabButton>
                  <TabButton active={subjectTab === "courses"} onClick={() => setSubjectTab("courses")}>
                    Cours
                  </TabButton>
                </div>

                {subjectTab === "subjects" ? (
                  <div className="grid gap-4">
                    <SubCard title="Creer un sujet">
                      <form className="mt-3 flex gap-2" onSubmit={handleCreateSubject}>
                        <input
                          className="w-full rounded border border-app-muted bg-white px-3 py-2 text-sm"
                          placeholder="Ex: Mathematiques"
                          value={newSubjectLabel}
                          onChange={(event) => setNewSubjectLabel(event.target.value)}
                          required
                        />
                        <button className="rounded bg-app-dark px-3 py-2 text-sm font-semibold text-white" type="submit">
                          Creer
                        </button>
                      </form>
                    </SubCard>

                    <SubCard title="Liste des sujets">
                      <div className="mt-3 flex flex-wrap gap-2">
                        {subjects.map((subject) => (
                          <button
                            key={subject.id}
                            className={`rounded px-2 py-1 text-xs ${selectedSubjectId === subject.id ? "bg-app-dark text-white" : "bg-app-soft text-app-dark"}`}
                            onClick={() => setSelectedSubjectId(subject.id)}
                            type="button"
                          >
                            {subject.label}
                          </button>
                        ))}
                        {subjects.length === 0 ? <EmptyState message="Aucun sujet disponible. Creez un sujet pour commencer." /> : null}
                      </div>
                    </SubCard>
                  </div>
                ) : (
                  <>
                    {subjectTab === "controls" ? (
                      <SubCard title="Controles crees par sujet">
                        {subjects.length === 0 ? <EmptyState message="Aucun sujet disponible. Creez un sujet avant de gerer les controles." /> : null}
                        <div className="mb-3">
                          <label className="grid gap-1 text-sm font-medium text-app-dark">
                            Sujet
                            <select
                              className="rounded border border-app-muted bg-white px-3 py-2"
                              value={selectedSubjectId}
                              onChange={(event) => setSelectedSubjectId(event.target.value)}
                            >
                              <option value="">Selectionner un sujet</option>
                              {subjects.map((subject) => (
                                <option key={subject.id} value={subject.id}>
                                  {subject.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="mt-3 space-y-2">
                          {subjectControls.map((control) => (
                            <div className="rounded border border-app-muted/60 p-3" key={control.id}>
                              <p className="text-sm font-semibold">{control.name}</p>
                              <p className="text-xs text-app-dark/70">{control.cours_title} - {control.instructeur_username}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {["BROUILLON", "PUBLIE", "CLOTURE", "CORRIGE"].map((statusValue) => (
                                  <button
                                    key={statusValue}
                                    className={`rounded px-2 py-1 text-xs ${control.status === statusValue ? "bg-app-dark text-white" : "bg-app-soft text-app-dark"}`}
                                    onClick={() => void handleUpdateControlStatus(control.id, statusValue)}
                                    type="button"
                                  >
                                    {statusValue}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                          {selectedSubjectId && subjectControls.length === 0 ? <EmptyState message="Aucun controle pour ce sujet." /> : null}
                        </div>
                      </SubCard>
                    ) : null}

                    {subjectTab === "courses" ? (
                      <SubCard title="Cours crees par sujet">
                        {subjects.length === 0 ? <EmptyState message="Aucun sujet disponible. Creez un sujet avant de gerer les cours." /> : null}
                        <div className="mb-3">
                          <label className="grid gap-1 text-sm font-medium text-app-dark">
                            Sujet
                            <select
                              className="rounded border border-app-muted bg-white px-3 py-2"
                              value={selectedSubjectId}
                              onChange={(event) => setSelectedSubjectId(event.target.value)}
                            >
                              <option value="">Selectionner un sujet</option>
                              {subjects.map((subject) => (
                                <option key={subject.id} value={subject.id}>
                                  {subject.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="mt-3 space-y-2">
                          {subjectCourses.map((course) => (
                            <div className="rounded border border-app-muted/60 p-3" key={course.id}>
                              <p className="text-sm font-semibold">{course.title}</p>
                              <p className="text-xs text-app-dark/70">{course.instructeur_username}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {["BROUILLON", "PUBLIE", "ARCHIVE"].map((statusValue) => (
                                  <button
                                    key={statusValue}
                                    className={`rounded px-2 py-1 text-xs ${course.status === statusValue ? "bg-app-dark text-white" : "bg-app-soft text-app-dark"}`}
                                    onClick={() => void handleUpdateCourseStatus(course.id, statusValue)}
                                    type="button"
                                  >
                                    {statusValue}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                          {selectedSubjectId && subjectCourses.length === 0 ? <EmptyState message="Aucun cours pour ce sujet." /> : null}
                        </div>
                      </SubCard>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {adminView === "references" ? (
              <ReferenceManagementSection
                referencesData={referencesData}
                referenceTab={referenceTab}
                setReferenceTab={setReferenceTab}
                newCorps={newCorps}
                setNewCorps={setNewCorps}
                newRank={newRank}
                setNewRank={setNewRank}
                newSpeciality={newSpeciality}
                setNewSpeciality={setNewSpeciality}
                handleCreateCorps={handleCreateCorps}
                handleCreateRank={handleCreateRank}
                handleCreateSpeciality={handleCreateSpeciality}
                handleRenameCorps={handleRenameCorps}
                handleRenameRank={handleRenameRank}
                handleRenameSpeciality={handleRenameSpeciality}
              />
            ) : null}

            {adminView === "events" ? (
              <div className="grid gap-6">
                <PanelSection title="Events audit trail" subtitle="Suivi des operations sur la plateforme.">
                  <button
                    className="mt-3 rounded bg-app-dark px-3 py-1.5 text-xs text-white"
                    onClick={() => void loadAdminEvents()}
                    type="button"
                  >
                    Rafraichir
                  </button>
                </PanelSection>
                <SubCard title="Derniers evenements">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-app-muted text-left">
                          <th className="py-2">Date</th>
                          <th className="py-2">Actor</th>
                          <th className="py-2">Type</th>
                          <th className="py-2">Target</th>
                          <th className="py-2">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminEvents.map((event) => (
                          <tr className="border-b border-app-muted/40" key={event.id}>
                            <td className="py-2">{new Date(event.created_at).toLocaleString()}</td>
                            <td className="py-2">
                              {event.actor_username || "-"}
                              {event.actor_role ? ` (${event.actor_role})` : ""}
                            </td>
                            <td className="py-2">{event.event_type}</td>
                            <td className="py-2">
                              {event.target_type || "-"} {event.target_id ? `#${event.target_id}` : ""}
                            </td>
                            <td className="py-2">{event.message || "-"}</td>
                          </tr>
                        ))}
                        {adminEvents.length === 0 ? (
                          <tr>
                            <td className="py-2 text-sm text-app-dark/70" colSpan={5}>Aucun evenement.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </SubCard>
              </div>
            ) : null}

            {adminView === "classes" ? (
              <div className="grid gap-6">
                <SubCard title="Creer une classe">
                  <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={handleCreateClass}>
                    <Input
                      label="Code classe"
                      value={newClassForm.code_classe}
                      onChange={(value) => setNewClassForm((prev) => ({ ...prev, code_classe: value }))}
                    />
                    <Input
                      label="Libelle classe"
                      value={newClassForm.libelle}
                      onChange={(value) => setNewClassForm((prev) => ({ ...prev, libelle: value }))}
                    />
                    <Input
                      label="Code brigade"
                      value={newClassForm.brigade_code}
                      onChange={(value) => setNewClassForm((prev) => ({ ...prev, brigade_code: value }))}
                    />
                    <Input
                      label="Libelle brigade"
                      value={newClassForm.brigade_label}
                      onChange={(value) => setNewClassForm((prev) => ({ ...prev, brigade_label: value }))}
                    />
                    <button className="rounded bg-app-dark px-3 py-2 text-sm font-semibold text-white md:col-span-2" type="submit">
                      Creer classe
                    </button>
                  </form>
                </SubCard>

                <SubCard title="Gestion des affectations">
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <label className="grid gap-1 text-sm font-medium text-app-dark">
                      Classe
                      <select
                        className="rounded border border-app-muted bg-white px-3 py-2"
                        value={selectedClassId}
                        onChange={(event) => setSelectedClassId(event.target.value)}
                      >
                        <option value="">Selectionner une classe</option>
                        {classesData.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} ({c.brigade.code})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1 text-sm font-medium text-app-dark">
                      Assigner Stagiaire
                      <select
                        className="rounded border border-app-muted bg-white px-3 py-2"
                        value={selectedStageaireId}
                        onChange={(event) => setSelectedStageaireId(event.target.value)}
                      >
                        <option value="">Selectionner</option>
                        {adminData.users
                          .filter((u) => u.role === "Stagiaire")
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username}
                            </option>
                          ))}
                      </select>
                    </label>

                    <button className="self-end rounded bg-app-dark px-3 py-2 text-sm font-semibold text-white" onClick={() => void handleAssignStageaireToClass()} type="button">
                      Assigner stageaire
                    </button>

                    <label className="grid gap-1 text-sm font-medium text-app-dark">
                      Assigner Instructeur
                      <select
                        className="rounded border border-app-muted bg-white px-3 py-2"
                        value={selectedInstructeurId}
                        onChange={(event) => setSelectedInstructeurId(event.target.value)}
                      >
                        <option value="">Selectionner</option>
                        {adminData.users
                          .filter((u) => u.role === "Instructeur")
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username}
                            </option>
                          ))}
                      </select>
                    </label>

                    <button className="self-end rounded bg-app-dark px-3 py-2 text-sm font-semibold text-white" onClick={() => void handleAssignInstructeurToClass()} type="button">
                      Assigner instructeur
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {classesData.map((c) => (
                      <div className="rounded border border-app-muted/60 p-3" key={c.id}>
                        <p className="text-sm font-semibold">
                          {c.code} - {c.label} ({c.brigade.code})
                        </p>
                        <p className="mt-1 text-xs text-app-dark/70">
                          Instructeurs: {c.instructeurs.map((i) => i.username).join(", ") || "-"}
                        </p>
                        <p className="text-xs text-app-dark/70">
                          Stagiaires: {c.stageaires.map((s) => s.username).join(", ") || "-"}
                        </p>
                      </div>
                    ))}
                    {classesData.length === 0 ? <EmptyState message="Aucune classe creee." /> : null}
                  </div>
                </SubCard>
              </div>
            ) : null}
          </article>
        </section>
      ) : null}

      {renameModal.open ? (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
          <div className="modal-panel w-full max-w-md rounded-xl border border-app-muted bg-white p-4 shadow-2xl">
            <h3 className="text-lg font-semibold">Renommer reference</h3>
            <form className="mt-3 grid gap-3" onSubmit={handleSubmitRename}>
              <Input label="Nouveau libelle" value={renameModal.value} onChange={(value) => setRenameModal((prev) => ({ ...prev, value }))} />
              <div className="flex justify-end gap-2">
                <button
                  className="rounded border border-app-muted px-3 py-2 text-sm"
                  onClick={() => setRenameModal({ open: false, target: null, id: "", value: "" })}
                  type="button"
                >
                  Annuler
                </button>
                <button className="rounded bg-app-dark px-3 py-2 text-sm font-semibold text-white" type="submit">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SettingsPage({ user, onLogout }: { user: MeResponse | null; onLogout: () => void }) {
  const { t, i18n } = useTranslation();
  const [settingsView, setSettingsView] = useState<"language" | "session">("language");
  if (!user) return <Navigate to="/login" replace />;
  const currentLanguage = i18n.language.startsWith("fr") ? "fr" : "en";

  const changeLanguage = async (language: "fr" | "en") => {
    localStorage.setItem("app_language", language);
    await i18n.changeLanguage(language);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <section className="grid gap-4 card-hover rounded-2xl border border-app-muted bg-white p-4 shadow-sm md:grid-cols-[230px_minmax(0,1fr)]">
            <aside className="sidebar-animated rounded-xl border border-app-muted bg-app-soft/40 p-3">
              <h1 className="mb-2 px-2 text-sm font-semibold uppercase tracking-[0.12em] text-app-dark">{t("settings.title")}</h1>
              <div className="grid gap-2">
                <AdminNavButton active={settingsView === "language"} onClick={() => setSettingsView("language")}>
                  {t("settings.languageTitle")}
                </AdminNavButton>
                <AdminNavButton active={settingsView === "session"} onClick={() => setSettingsView("session")}>
                  {t("settings.accountTitle")}
                </AdminNavButton>
              </div>
            </aside>

            <article className="rounded-xl border border-app-muted bg-white p-6">
              <h1 className="text-2xl font-semibold tracking-tight text-app-dark">{t("settings.title")}</h1>
              <p className="mt-1 text-sm text-app-dark/70">{t("settings.subtitle")}</p>

              {settingsView === "language" ? (
                <article className="mt-6 rounded-xl border border-app-muted bg-app-soft p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-app-accent">{t("settings.languageTitle")}</h2>
                  <p className="mt-2 text-sm text-app-dark/80">{t("settings.languageHint")}</p>
                  <div className="mt-4 flex gap-2">
                    <button
                      className={`rounded-md px-3 py-2 text-sm font-semibold ${
                        currentLanguage === "fr" ? "bg-app-dark text-white" : "bg-white text-app-dark"
                      }`}
                      onClick={() => void changeLanguage("fr")}
                      type="button"
                    >
                      {t("settings.french")}
                    </button>
                    <button
                      className={`rounded-md px-3 py-2 text-sm font-semibold ${
                        currentLanguage === "en" ? "bg-app-dark text-white" : "bg-white text-app-dark"
                      }`}
                      onClick={() => void changeLanguage("en")}
                      type="button"
                    >
                      {t("settings.english")}
                    </button>
                  </div>
                </article>
              ) : null}

              {settingsView === "session" ? (
                <article className="mt-6 rounded-xl border border-app-muted bg-app-soft p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-app-accent">{t("settings.accountTitle")}</h2>
                  <p className="mt-2 text-sm text-app-dark/80">
                    {t("settings.accountConnected")} <span className="font-semibold">{user.username}</span> ({t(`roles.${user.role}`)})
                  </p>
                  <button
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-app-dark px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    onClick={onLogout}
                    type="button"
                  >
                    <span aria-hidden="true">↩</span>
                    {t("nav.logout")}
                  </button>
                </article>
              ) : null}
            </article>
      </section>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password";
  required?: boolean;
}) {
  return (
    <TextField
      fullWidth
      label={label}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      size="small"
      type={type}
      value={value}
      variant="outlined"
    />
  );
}

function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  const [refreshToken, setRefreshToken] = useState<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY));
  const [user, setUser] = useState<MeResponse | null>(null);
  const [publicReferences, setPublicReferences] = useState<{
    corps: ReferenceCorp[];
    ranks: ReferenceRank[];
    specialities: ReferenceSpeciality[];
  }>({ corps: [], ranks: [], specialities: [] });

  const clearSession = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const refreshAccessToken = async () => {
    if (!refreshToken) return null;
    const response = await fetch(`${API_BASE_URL}/api/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      clearSession();
      setError(t("errors.sessionExpired"));
      return null;
    }

    const data: RefreshResponse = await response.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
    setAccessToken(data.access);
    return data.access;
  };

  const loadProfile = useMemo(
    () => async () => {
      if (!accessToken) return;
      let response = await fetch(`${API_BASE_URL}/api/me/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status === 401) {
        const newAccessToken = await refreshAccessToken();
        if (!newAccessToken) return;
        response = await fetch(`${API_BASE_URL}/api/me/`, {
          headers: { Authorization: `Bearer ${newAccessToken}` },
        });
      }

      if (!response.ok) {
        setError(t("errors.profileLoadFailed"));
        return;
      }

      const data: MeResponse = await response.json();
      setUser(data);
    },
    [accessToken, refreshToken, t],
  );

  const apiFetch = async (path: string, init?: RequestInit) => {
    if (!accessToken) {
      return new Response(null, { status: 401 });
    }

    const withAuth: RequestInit = {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    };
    let response = await fetch(`${API_BASE_URL}${path}`, withAuth);
    if (response.status !== 401) return response;

    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) return response;

    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${newAccessToken}`,
      },
    });
    return response;
  };

  const login = async (username: string, password: string) => {
    setError(null);
    const response = await fetch(`${API_BASE_URL}/api/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      setError(t("errors.invalidCredentials"));
      throw new Error("Invalid credentials");
    }

    const tokens: TokenResponse = await response.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
    setAccessToken(tokens.access);
    setRefreshToken(tokens.refresh);
    await loadProfile();
  };

  const signup = async (payload: {
    username: string;
    password: string;
    email: string;
    role: Role;
    matricule: string;
    est_civil: boolean;
    corps_id: string;
    rank_id: string;
    speciality_id: string;
  }) => {
    setError(null);
    const response = await fetch(`${API_BASE_URL}/api/signup/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let detail = "";
      try {
        const errorPayload: { detail?: string } = await response.json();
        detail = errorPayload.detail ?? "";
      } catch {
        // keep default fallback below
      }
      if (detail === "matricule is required for military roles") {
        setError(t("errors.matriculeRequired"));
      } else {
        setError(t("errors.signupFailed"));
      }
      throw new Error("Signup failed");
    }

    await login(payload.username, payload.password);
  };

  useEffect(() => {
    const loadPublicReferences = async () => {
      const response = await fetch(`${API_BASE_URL}/api/references/`);
      if (!response.ok) return;
      const data: { corps: ReferenceCorp[]; ranks: ReferenceRank[]; specialities: ReferenceSpeciality[] } = await response.json();
      setPublicReferences(data);
    };
    void loadPublicReferences();
  }, []);

  useEffect(() => {
    if (!refreshToken) return;
    const timer = window.setInterval(() => {
      void refreshAccessToken();
    }, 4 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refreshToken]);

  useEffect(() => {
    if (!accessToken) return;
    void loadProfile();
  }, [accessToken, loadProfile]);

  useEffect(() => {
    if (location.pathname === "/") {
      document.title = `${t("titles.home")} - ${t("titles.appName")}`;
      return;
    }
    if (location.pathname === "/login") {
      document.title = `${t("titles.login")} - ${t("titles.appName")}`;
      return;
    }
    if (location.pathname === "/signup") {
      document.title = `${t("titles.signup")} - ${t("titles.appName")}`;
      return;
    }
    if (location.pathname === "/settings") {
      document.title = `${t("titles.settings")} - ${t("titles.appName")}`;
      return;
    }
    if (location.pathname === "/dashboard") {
      document.title = `${t("titles.dashboard")} - ${t("titles.appName")}`;
      return;
    }
    if (location.pathname !== "/dashboard") {
      document.title = t("titles.appName");
    }
  }, [location.pathname, user?.role, t]);

  return (
    <Layout user={user}>
      <div className="route-transition" key={location.pathname}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage onLoadProfile={loadProfile} user={user} apiFetch={apiFetch} onSessionInvalid={clearSession} />} />
          <Route path="/login" element={<LoginPage error={error} onLogin={login} />} />
          <Route path="/signup" element={<SignupPage error={error} onSignup={signup} references={publicReferences} />} />
          <Route path="/settings" element={<SettingsPage user={user} onLogout={clearSession} />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </div>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;










