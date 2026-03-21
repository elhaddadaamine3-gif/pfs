import React, { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import PdfViewer, { InlinePdfViewer } from "./PdfViewer";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
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
  classes: Array<{ id: string; code: string; label: string; brigade: string }>;
  cours: { total: number; published: number };
  cours_list: Array<{ id: string; title: string; status: string }>;
  controles: { total: number; published: number; pending_corrections: number };
  controles_list: Array<{ id: string; name: string; status: string; cours_title: string; deadline: string | null }>;
  pending_submissions: Array<{ soumission_id: string; controle_id: string; controle_name: string; stagiaire_id: number; submitted_at: string }>;
  sujets_fin_stage: { total: number; active: number; list: Array<{ sujet: string; stagiaire_id: number; etat: string }> };
  notifications: { unread_count: number; latest: Array<{ id: string; title: string; message: string; type: string; created_at: string }> };
};

type StageaireDashboardData = {
  role: Role;
  classes: Array<{ classe_code: string; classe_label: string; brigade_code: string; brigade_label: string }>;
  cours_list: Array<{ id: string; titre: string; matiere: string; description: string; instructeur: string; controles_count: number }>;
  modules_list: Array<{ id: string; nom: string; matieres: Array<{ id: string; nom: string; cours_count: number }> }>;
  controls: { available_count: number; submitted_count: number; pending_count: number };
  controls_list: Array<{ id: string; name: string; deadline: string | null; cours: string; enonce: string; bareme: string }>;
  submitted_control_ids: string[];
  soumissions_detail: Array<{ soumission_id: string; controle_id: string; controle_name: string; statut: string; submitted_at: string; has_fichier: boolean; note: string | null; correction_publiee: string | null; correction_titre: string | null }>;
  notes: Array<{ controle: string; note: string; published_at: string | null }>;
  sujet_fin_stage: { titre: string; description: string; etat: string; encadrant: string; date_affectation: string } | null;
  notifications: { unread_count: number; latest: Array<{ id: string; title: string; message: string; type: string; created_at: string }> };
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
          <Link className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-app-dark" to="/">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-10 w-10 rounded-full object-cover shadow-sm"
            />
            <span>{t("nav.brand")}</span>
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
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 grid gap-6">

      {/* ── Hero banner ── */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-xl"
        style={{ background: "linear-gradient(135deg, #0E0F29 0%, #15173D 60%, #1E1F4A 100%)" }}
      >
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-10" style={{ background: "#982598" }} />
        <div className="pointer-events-none absolute -bottom-10 right-32 h-40 w-40 rounded-full opacity-10" style={{ background: "#982598" }} />
        <div className="pointer-events-none absolute bottom-6 right-6 h-20 w-20 rounded-full opacity-10" style={{ background: "#982598" }} />

        <div className="relative flex flex-col gap-10 p-10 md:flex-row md:items-center md:justify-between">

          {/* Left — text */}
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#982598" }}>
              Enterprise Training Platform
            </p>
            <h1 className="mt-3 text-4xl font-black uppercase leading-tight text-white md:text-5xl">
              Plateforme de<br />
              <span style={{ color: "#982598" }}>Cours en Ligne</span>
            </h1>
            <p className="mt-4 text-base text-white/70 leading-relaxed">
              A modern workspace for people, programs, and progression.
            </p>
            <p className="mt-2 text-sm text-white/50">
              Unified collaboration between{" "}
              {["Instructeurs", "Stagiaires", "Admins", "Superviseurs", "Coordinateurs"].map((role, i, arr) => (
                <span key={role}>
                  <span style={{ color: "#982598" }} className="font-semibold">{role}</span>
                  {i < arr.length - 1 ? ", " : "."}
                </span>
              ))}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
                style={{ background: "#982598" }}
                to="/login"
              >
                Se connecter →
              </Link>
              <Link
                className="rounded-xl border px-6 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10"
                style={{ borderColor: "rgba(152,37,152,0.4)" }}
                to="/signup"
              >
                Créer un compte
              </Link>
            </div>
          </div>

          {/* Right — illustration */}
          <div className="flex shrink-0 flex-col items-center gap-4">
            {/* Fake monitor */}
            <div
              className="flex h-40 w-56 flex-col rounded-2xl border-4 shadow-2xl"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(152,37,152,0.3)" }}
            >
              <div className="flex flex-1 flex-col justify-center gap-2 p-4">
                <div className="h-2.5 w-full rounded-full bg-white/40" />
                <div className="h-2.5 w-4/5 rounded-full bg-white/25" />
                <div className="h-2.5 w-3/5 rounded-full bg-white/25" />
                <div className="mt-3 flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: "#982598" }}
                  >✓</div>
                  <div className="h-2.5 flex-1 rounded-full bg-white/20" />
                </div>
              </div>
              <div className="flex justify-center pb-2">
                <div className="h-3 w-10 rounded-b bg-white/10" />
              </div>
            </div>
            <div className="h-2 w-20 rounded-full bg-white/10" />

            {/* Role pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {["Admin", "Instructeur", "Stagiaire", "Superviseur", "Coordinateur"].map((r) => (
                <span
                  key={r}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-white/80"
                  style={{ background: "rgba(152,37,152,0.18)" }}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Feature cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: "📚", title: "Cours structurés", desc: "Modules, matières, brochures et leçons organisés hiérarchiquement." },
          { icon: "📝", title: "Contrôles & Corrections", desc: "Publiez des examens, recevez les soumissions et notez en ligne." },
          { icon: "📊", title: "Suivi de progression", desc: "Tableaux de bord par rôle pour un suivi en temps réel." },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <span className="text-3xl">{f.icon}</span>
            <h3 className="mt-3 text-base font-bold text-app-dark">{f.title}</h3>
            <p className="mt-1 text-sm text-app-dark/60 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

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
  }) => Promise<void>;
  error: string | null;
  references: { corps: ReferenceCorp[] };
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
  const [busy, setBusy] = useState(false);
  const requiresMilitaryProfile = !(role === "Instructeur" && estCivil);
  const matriculeRequired = requiresMilitaryProfile;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (matriculeRequired && !matricule.trim()) {
      return;
    }
    if (requiresMilitaryProfile && !corpsId) {
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
            <label className="grid gap-1 text-sm font-medium text-app-dark">
              Corps
              <select
                className="rounded-md border border-app-muted bg-white px-3 py-2 outline-none focus:border-app-accent"
                onChange={(event) => setCorpsId(event.target.value)}
                required
                value={corpsId}
              >
                <option value="">Sélectionner</option>
                {references.corps.map((corp) => (
                  <option key={corp.id} value={corp.id}>
                    {corp.label}
                  </option>
                ))}
              </select>
            </label>
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
    id: string; titre: string; matiere: string; description: string; instructeur: string; date_depot: string;
    fichiers: Array<{ id_cours_fichier: string; nom_fichier: string; mime_type: string; taille_octets: number }>;
    controles: Array<{ id: string; nom: string; enonce: string; bareme: number; date_limite: string | null; has_fichier: boolean; nom_fichier_enonce: string }>;
  } | null>(null);
  const [coursFileCache, setCoursFileCache] = useState<Record<string, { base64: string; name: string; mimeType: string }>>({});
  const [selectedModule, setSelectedModule] = useState<{ id: string; nom: string; matieres: Array<{ id: string; nom: string; cours_count: number }> } | null>(null);
  const [selectedMatiere, setSelectedMatiere] = useState<{ id: string; nom: string; module_nom: string; brochures: Array<{ id: string; nom: string; cours_count: number }>; cours: Array<{ id: string; titre: string; description: string; instructeur: string; controles_count: number }> } | null>(null);
  const [selectedBrochure, setSelectedBrochure] = useState<{ id: string; nom: string; matiere_nom: string; module_nom: string; cours: Array<{ id: string; titre: string; description: string; instructeur: string; controles_count: number }> } | null>(null);
  const [modulesExpanded, setModulesExpanded] = useState(false);
  const [superviseurData, setSuperviseurData] = useState<SuperviseurDashboardData | null>(null);
  const [coordinateurData, setCoordinateurData] = useState<CoordinateurDashboardData | null>(null);
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);

  const [modulesList, setModulesList] = useState<Array<{ id: string; nom: string; matieres: Array<{ id: string; nom: string }> }>>([]);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseModuleId, setCourseModuleId] = useState("");
  const [courseMatiereId, setCourseMatiereId] = useState("");
  const [courseClasseId, setCourseClasseId] = useState("");
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
  const [lessonModal, setLessonModal] = useState<{
    cours: { id: string; titre: string; matiere: string; description: string; instructeur: string; date_depot: string; fichiers: Array<{ id_cours_fichier: string; nom_fichier: string; mime_type: string; taille_octets: number }> };
    files: Record<string, { base64: string; name: string; mimeType: string }>;
  } | null>(null);
  const [lessonModalLoading, setLessonModalLoading] = useState(false);
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
  const [adminUserSearch, setAdminUserSearch] = useState("");
  const [adminUsersExpanded, setAdminUsersExpanded] = useState(false);
  const [adminUserRoleFilter, setAdminUserRoleFilter] = useState<string | null>(null);
  const [adminStatusFilter, setAdminStatusFilter] = useState<"tous" | "actif" | "inactif">("tous");
  const [adminUserSort, setAdminUserSort] = useState<"az" | "za" | "recent">("az");
  const [adminUsersPage, setAdminUsersPage] = useState(1);
  const ADMIN_USERS_PER_PAGE = 10;
  const [instructeurCoursSearch, setInstructeurCoursSearch] = useState("");
  const [adminCoursSearch, setAdminCoursSearch] = useState("");
  const [adminControlSearch, setAdminControlSearch] = useState("");
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
  const [lastCreatedAccount, setLastCreatedAccount] = useState<{ username: string; password: string; role: string; matricule: string } | null>(null);
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [resetPasswordState, setResetPasswordState] = useState<Record<number, { value: string; show: boolean; saved: string }>>({});
  const [csvFileName, setCsvFileName] = useState("");
  const [csvErrors, setCsvErrors] = useState<Array<{ line: number; error: string }>>([]);
  const [classesData, setClassesData] = useState<AdminClassData[]>([]);
  const [newClassForm, setNewClassForm] = useState({ libelle: "" });
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStageaireIds, setSelectedStageaireIds] = useState<number[]>([]);
  const [selectedInstructeurIds, setSelectedInstructeurIds] = useState<number[]>([]);
  const [stagSearch, setStagSearch] = useState("");
  const [instrSearch, setInstrSearch] = useState("");
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
    if (!lessonModal && !lessonModalLoading) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setLessonModal(null); setLessonModalLoading(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lessonModal, lessonModalLoading]);

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
        const [response, modResp] = await Promise.all([
          apiFetch("/api/dashboard/instructeur/"),
          apiFetch("/api/modules/"),
        ]);
        if (response.status === 403) { onSessionInvalid(); return; }
        if (!response.ok) throw new Error("failed");
        const data: InstructeurDashboardData = await response.json();
        setInstructeurData(data);
        if (modResp.ok) { const mods = await modResp.json(); setModulesList(mods); }
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
      body: JSON.stringify({ titre: courseTitle, description: courseDescription, module_id: courseModuleId || undefined, matiere_id: courseMatiereId || undefined, classe_id: courseClasseId || undefined, publier: true }),
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
    setCourseClasseId("");
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

  const handleOpenModule = (module: { id: string; nom: string; matieres: Array<{ id: string; nom: string; cours_count: number }> }) => {
    setSelectedMatiere(null);
    setSelectedBrochure(null);
    setSelectedCours(null);
    setCoursFileCache({});
    setSelectedModule(module);
  };

  const handleOpenMatiere = async (matiereId: string) => {
    setSelectedBrochure(null);
    setSelectedCours(null);
    setCoursFileCache({});
    const response = await apiFetch(`/api/stageaire/matieres/${matiereId}/cours/`);
    if (!response.ok) return;
    const data = await response.json();
    setSelectedMatiere({ id: data.matiere_id, nom: data.matiere_nom, module_nom: data.module_nom, brochures: data.brochures ?? [], cours: data.cours });
  };

  const handleOpenBrochure = async (brochureId: string) => {
    setSelectedCours(null);
    setCoursFileCache({});
    const response = await apiFetch(`/api/stageaire/brochures/${brochureId}/cours/`);
    if (!response.ok) return;
    const data = await response.json();
    setSelectedBrochure({ id: data.brochure_id, nom: data.brochure_nom, matiere_nom: data.matiere_nom, module_nom: data.module_nom, cours: data.cours });
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

  const openCoursModal = async (coursId: string) => {
    setLessonModalLoading(true);
    setLessonModal(null);
    const response = await apiFetch(`/api/stageaire/cours/${coursId}/`);
    if (!response.ok) { setLessonModalLoading(false); return; }
    const data = await response.json();
    const files: Record<string, { base64: string; name: string; mimeType: string }> = {};
    setLessonModal({ cours: data, files });
    setLessonModalLoading(false);
    // Fetch files in background, updating modal as each loads
    for (const f of data.fichiers ?? []) {
      apiFetch(`/api/stageaire/cours/${coursId}/fichier/${f.id_cours_fichier}/`).then(async (r) => {
        if (!r.ok) return;
        const fd: { fichier_base64: string; nom_fichier: string; mime_type: string } = await r.json();
        setLessonModal((prev) => prev ? { ...prev, files: { ...prev.files, [f.id_cours_fichier]: { base64: fd.fichier_base64, name: fd.nom_fichier, mimeType: fd.mime_type } } } : prev);
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
      const ctrlName = ctrl?.name ?? stageaireData?.soumissions_detail.find((s) => s.controle_id === controlId)?.controle_name ?? controlId.slice(0, 8);
      const withFile = file ? ` avec fichier « ${file.name} »` : "";
      setActionMessage(`Réponse soumise pour « ${ctrlName} »${withFile}.`);
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
      setActionMessage(`Classe « ${newClassForm.libelle} » créée.`);
      setNewClassForm({ libelle: "" });
      await loadClasses();
    }
  };

  const handleAssignStageaireToClass = async () => {
    if (!selectedClassId || selectedStageaireIds.length === 0) return;
    await Promise.all(
      selectedStageaireIds.map((id) =>
        apiFetch(`/api/admin/classes/${selectedClassId}/assign-stageaire/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageaire_id: id }),
        })
      )
    );
    const cls = classesData.find((c) => c.id === selectedClassId);
    setActionMessage(`${selectedStageaireIds.length} stagiaire(s) affecté(s) à la classe « ${cls?.code ?? selectedClassId} ».`);
    setSelectedStageaireIds([]);
    await loadClasses();
  };

  const handleAssignInstructeurToClass = async () => {
    if (!selectedClassId || selectedInstructeurIds.length === 0) return;
    await Promise.all(
      selectedInstructeurIds.map((id) =>
        apiFetch(`/api/admin/classes/${selectedClassId}/assign-instructeur/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instructeur_id: id }),
        })
      )
    );
    const cls = classesData.find((c) => c.id === selectedClassId);
    setActionMessage(`${selectedInstructeurIds.length} instructeur(s) affecté(s) à la classe « ${cls?.code ?? selectedClassId} ».`);
    setSelectedInstructeurIds([]);
    await loadClasses();
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
      const data: { username: string; password: string; role: string; matricule: string } = await response.json();
      setLastCreatedAccount({ username: data.username, password: data.password, role: data.role, matricule: data.matricule });
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

      {/* Lesson modal — centered overlay */}
      {(lessonModal || lessonModalLoading) ? (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-app-dark/60 px-4"
          onClick={() => { setLessonModal(null); setLessonModalLoading(false); }}
        >
          <div
            className="modal-panel relative flex w-full max-w-4xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 rounded-t-2xl px-6 py-4" style={{ background: "#15173D" }}>
              <div className="min-w-0">
                {lessonModal ? (
                  <>
                    <p className="truncate text-lg font-bold text-white">{lessonModal.cours.titre}</p>
                    {lessonModal.cours.matiere ? (
                      <p className="mt-0.5 text-xs text-white/60">{lessonModal.cours.matiere}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-white/70">Chargement…</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setLessonModal(null); setLessonModalLoading(false); }}
                className="shrink-0 rounded-lg px-2 py-1 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {lessonModalLoading && !lessonModal ? (
                <div className="flex flex-col gap-3">
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-line" />
                  <div className="skeleton skeleton-block" />
                </div>
              ) : lessonModal ? (
                <>
                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-app-dark/50">
                    <span>Instructeur : <span className="font-semibold text-app-dark">{lessonModal.cours.instructeur}</span></span>
                    <span>Déposé le <span className="font-medium text-app-dark">{lessonModal.cours.date_depot}</span></span>
                  </div>

                  {/* Description */}
                  {lessonModal.cours.description ? (
                    <p className="rounded-xl border border-app-muted bg-app-soft/60 px-4 py-3 text-sm text-app-dark/80 whitespace-pre-wrap">
                      {lessonModal.cours.description}
                    </p>
                  ) : null}

                  {/* Files */}
                  {lessonModal.cours.fichiers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-app-muted p-6 text-center">
                      <p className="text-sm italic text-app-dark/40">Aucun fichier disponible.</p>
                    </div>
                  ) : (
                    lessonModal.cours.fichiers.map((f) => {
                      const cached = lessonModal.files[f.id_cours_fichier];
                      const isPdf = cached
                        ? cached.mimeType === "application/pdf" || cached.name.toLowerCase().endsWith(".pdf")
                        : f.mime_type === "application/pdf" || f.nom_fichier.toLowerCase().endsWith(".pdf");

                      if (!cached) {
                        return (
                          <div key={f.id_cours_fichier} className="flex items-center gap-3 rounded-xl border border-app-muted bg-white px-4 py-4">
                            <div className="skeleton h-5 w-5 rounded" />
                            <span className="text-sm text-app-dark/50">Chargement de {f.nom_fichier}…</span>
                          </div>
                        );
                      }

                      if (isPdf) {
                        return <InlinePdfViewer key={f.id_cours_fichier} base64={cached.base64} name={cached.name} />;
                      }

                      return (
                        <div key={f.id_cours_fichier} className="flex items-center gap-3 rounded-xl border border-app-muted bg-white px-4 py-4">
                          <span className="text-base">📎</span>
                          <div>
                            <p className="text-sm font-semibold text-app-dark">{f.nom_fichier}</p>
                            <p className="text-xs text-app-dark/40">Aperçu non disponible pour ce format</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
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
                    background: active ? "#15173D" : "white",
                    color: active ? "white" : "#15173D",
                    border: "1px solid #E491C9",
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
              {/* Connexion card */}
              <article className="rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
                    style={{ background: "#15173D" }}
                  >
                    {user?.username?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold truncate">{user?.username}</p>
                    <p className="text-sm text-app-dark/60">{user?.role}</p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ background: "#22c55e" }}
                  >
                    Connecté
                  </span>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-3 border-t border-app-muted/60 pt-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-app-dark/50">Matricule</p>
                    <p className="mt-0.5 text-sm font-semibold">{user?.matricule || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-app-dark/50">Corps</p>
                    <p className="mt-0.5 text-sm font-semibold">{user?.corps?.label ?? (user?.est_civil ? "Civil" : "—")}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-app-dark/50">Email</p>
                    <p className="mt-0.5 text-sm font-semibold truncate">{user?.email || "—"}</p>
                  </div>
                </div>
              </article>

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
                  <label className="grid gap-1 text-sm">
                    Module
                    <select
                      className="rounded border border-app-muted bg-white px-3 py-2 text-sm"
                      value={courseModuleId}
                      onChange={(e) => { setCourseModuleId(e.target.value); setCourseMatiereId(""); }}
                    >
                      <option value="">— Sélectionner un module —</option>
                      {modulesList.map((m) => (
                        <option key={m.id} value={m.id}>{m.nom}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Matière
                    <select
                      className="rounded border border-app-muted bg-white px-3 py-2 text-sm"
                      value={courseMatiereId}
                      onChange={(e) => setCourseMatiereId(e.target.value)}
                      disabled={!courseModuleId}
                    >
                      <option value="">— Sélectionner une matière —</option>
                      {(modulesList.find((m) => m.id === courseModuleId)?.matieres ?? []).map((mat) => (
                        <option key={mat.id} value={mat.id}>{mat.nom}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm md:col-span-2">
                    Classe (optionnel)
                    <select
                      className="rounded border border-app-muted bg-white px-3 py-2 text-sm"
                      value={courseClasseId}
                      onChange={(e) => setCourseClasseId(e.target.value)}
                    >
                      <option value="">— Toutes les classes —</option>
                      {instructeurData.classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} ({c.code} · Brigade {c.brigade})
                        </option>
                      ))}
                    </select>
                  </label>
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
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-app-muted bg-app-soft px-3 py-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-app-dark/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    className="w-full bg-transparent text-sm outline-none placeholder:text-app-dark/40"
                    placeholder="Rechercher un cours…"
                    value={instructeurCoursSearch}
                    onChange={(e) => setInstructeurCoursSearch(e.target.value)}
                  />
                  {instructeurCoursSearch ? (
                    <button className="text-app-dark/40 hover:text-app-dark" onClick={() => setInstructeurCoursSearch("")} type="button">✕</button>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  {instructeurData.cours_list
                    .filter((c) => c.title.toLowerCase().includes(instructeurCoursSearch.toLowerCase()))
                    .map((c) => (
                      <div className="flex items-center gap-3 rounded-xl border border-app-muted bg-white px-4 py-3" key={c.id}>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "#15173D" }}>
                          {c.title[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold text-app-dark">{c.title}</p>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.status === "PUBLIE" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {c.status}
                          </span>
                        </div>
                        <button
                          type="button"
                          title="Supprimer le cours"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-sm text-red-500 transition hover:bg-red-100 hover:text-red-700"
                          onClick={async () => {
                            if (!confirm(`Supprimer le cours « ${c.title} » ?`)) return;
                            await apiFetch(`/api/instructeur/cours/${c.id}/delete/`, { method: "DELETE" });
                            await loadDashboard();
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    ))}
                  {instructeurData.cours_list.length === 0 ? <EmptyState message="Aucun cours créé." /> : null}
                  {instructeurData.cours_list.length > 0 && instructeurCoursSearch && instructeurData.cours_list.filter((c) => c.title.toLowerCase().includes(instructeurCoursSearch.toLowerCase())).length === 0 ? (
                    <p className="text-sm text-app-dark/50">Aucun résultat pour « {instructeurCoursSearch} ».</p>
                  ) : null}
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
                    <div className="flex items-center gap-3 rounded-xl border border-app-muted bg-white px-4 py-3" key={c.id}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "#982598" }}>
                        {c.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-app-dark">{c.name}</p>
                        <p className="truncate text-xs text-app-dark/50">{c.cours_title}</p>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.status === "PUBLIE" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {c.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        title="Supprimer le contrôle"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-sm text-red-500 transition hover:bg-red-100 hover:text-red-700"
                        onClick={async () => {
                          if (!confirm(`Supprimer le contrôle « ${c.name} » ?`)) return;
                          await apiFetch(`/api/instructeur/controles/${c.id}/delete/`, { method: "DELETE" });
                          await loadDashboard();
                        }}
                      >
                        🗑
                      </button>
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
              {/* ── Soumissions à noter ── */}
              <div className="overflow-hidden rounded-2xl border border-app-muted bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-app-muted px-6 py-4" style={{ background: "#15173D" }}>
                  <div>
                    <p className="text-base font-bold text-white">Soumissions à noter</p>
                    <p className="text-xs text-white/50 mt-0.5">Évaluez les réponses des stagiaires</p>
                  </div>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white">
                    {instructeurData.pending_submissions.length} en attente
                  </span>
                </div>

                <div className="divide-y divide-app-muted/40">
                  {instructeurData.pending_submissions.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <span className="text-3xl">✅</span>
                      <p className="text-sm font-medium text-app-dark/50">Aucune soumission en attente</p>
                    </div>
                  )}
                  {instructeurData.pending_submissions.map((s) => {
                    const stagiaire = instructeurData.pending_submissions.find((x) => x.soumission_id === s.soumission_id);
                    return (
                      <div key={s.soumission_id} className="p-5">
                        {/* Card header */}
                        <div className="flex items-start gap-4 mb-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "#982598" }}>
                            {String(s.stagiaire_id).slice(-2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-app-dark">{s.controle_name}</p>
                            <p className="text-xs text-app-dark/50 mt-0.5">
                              Stagiaire #{s.stagiaire_id} · soumis le {new Date(s.submitted_at).toLocaleDateString("fr-FR")}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-yellow-100 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-700">En attente</span>
                        </div>

                        {/* Download */}
                        <button
                          type="button"
                          className="mb-4 flex items-center gap-2 rounded-lg border border-app-muted bg-app-soft px-3 py-2 text-xs font-medium text-app-dark transition hover:border-app-accent hover:bg-white"
                          onClick={() => void openFichierFromApi(`/api/instructeur/soumissions/${s.soumission_id}/fichier/`, "reponse.rtf")}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-app-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Télécharger la réponse RTF
                        </button>

                        {/* Evaluation fields */}
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-app-dark/50">Note /20</label>
                            <input
                              type="number"
                              min="0" max="20"
                              className="rounded-lg border border-app-muted bg-app-soft px-3 py-2 text-sm outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20"
                              placeholder="ex : 15"
                              value={evalNote[s.soumission_id] ?? ""}
                              onChange={(e) => setEvalNote((prev) => ({ ...prev, [s.soumission_id]: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-app-dark/50">Commentaire</label>
                            <input
                              className="rounded-lg border border-app-muted bg-app-soft px-3 py-2 text-sm outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20"
                              placeholder="Remarque optionnelle…"
                              value={evalCorrection[s.soumission_id] ?? ""}
                              onChange={(e) => setEvalCorrection((prev) => ({ ...prev, [s.soumission_id]: e.target.value }))}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="mt-3 rounded-xl px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                          style={{ background: "#982598" }}
                          disabled={!evalNote[s.soumission_id]}
                          onClick={() => void handleEvaluate(s.soumission_id)}
                        >
                          ✓ Publier la note
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Publier la correction ── */}
              <div className="overflow-hidden rounded-2xl border border-app-muted bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-app-muted px-6 py-4" style={{ background: "#15173D" }}>
                  <div>
                    <p className="text-base font-bold text-white">Publier la correction officielle</p>
                    <p className="text-xs text-white/50 mt-0.5">Rédigez la correction modèle pour chaque contrôle</p>
                  </div>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white">
                    {instructeurData.controles_list.length} contrôle(s)
                  </span>
                </div>

                <div className="divide-y divide-app-muted/40">
                  {instructeurData.controles_list.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <span className="text-3xl">📋</span>
                      <p className="text-sm font-medium text-app-dark/50">Aucun contrôle disponible</p>
                    </div>
                  )}
                  {instructeurData.controles_list.map((c) => (
                    <div key={c.id} className="p-5">
                      {/* Header */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "#15173D" }}>
                          {c.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-app-dark">{c.name}</p>
                          <p className="text-xs text-app-dark/50 mt-0.5">{c.cours_title}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.status === "PUBLIE" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {c.status}
                        </span>
                      </div>

                      {/* Correction textarea */}
                      <div className="grid gap-1 mb-3">
                        <label className="text-xs font-semibold uppercase tracking-wide text-app-dark/50">Texte de correction</label>
                        <textarea
                          rows={3}
                          className="rounded-lg border border-app-muted bg-app-soft px-3 py-2 text-sm outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 resize-none"
                          placeholder="Rédigez la correction modèle…"
                          value={correctionText[c.id] ?? ""}
                          onChange={(e) => setCorrectionText((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        />
                      </div>
                      <button
                        type="button"
                        className="rounded-xl px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                        style={{ background: "#982598" }}
                        disabled={!correctionText[c.id]}
                        onClick={() => void handlePublishCorrection(c.id)}
                      >
                        ✓ Publier la correction
                      </button>
                    </div>
                  ))}
                </div>
              </div>
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
          {/* ── Sidebar ── */}
          <aside className="sidebar-animated w-56 min-w-[14rem] flex-shrink-0 flex flex-col overflow-hidden rounded-l-2xl border border-r-0 border-app-muted bg-white shadow-sm">

            {/* Profile header */}
            <div className="px-4 pt-5 pb-4 border-b border-app-muted/60" style={{ background: "linear-gradient(160deg,#15173D 0%,#1e2050 100%)" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white ring-2 ring-white/20" style={{ background: "#982598" }}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{user.username}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <p className="text-xs text-white/50">Stagiaire</p>
                  </div>
                </div>
              </div>
              {/* Mini progress bar */}
              {stageaireData.controls.available_count > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-white/50 mb-1">
                    <span>Progression contrôles</span>
                    <span>{stageaireData.controls.submitted_count}/{stageaireData.controls.available_count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round((stageaireData.controls.submitted_count / stageaireData.controls.available_count) * 100))}%`, background: "#982598" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-2 py-3 space-y-0.5">

              {/* Dashboard */}
              {(["dashboard"] as const).map((tab) => {
                const active = stageaireView === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setStageaireView(tab); setSelectedModule(null); setSelectedMatiere(null); setSelectedBrochure(null); setSelectedCours(null); setCoursFileCache({}); }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition text-left"
                    style={{ background: active ? "#15173D" : "transparent", color: active ? "white" : "#15173D" }}
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span className="flex-1">Tableau de bord</span>
                  </button>
                );
              })}

              {/* Modules collapsible */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setModulesExpanded((prev) => !prev);
                    setStageaireView("cours");
                    setSelectedMatiere(null);
                    setSelectedBrochure(null);
                    setSelectedCours(null);
                    setCoursFileCache({});
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition text-left"
                  style={{ background: stageaireView === "cours" ? "#15173D" : "transparent", color: stageaireView === "cours" ? "white" : "#15173D" }}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={stageaireView === "cours" ? 2.5 : 2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="flex-1">Modules</span>
                  <span className="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold leading-none" style={{ background: stageaireView === "cours" ? "rgba(255,255,255,0.2)" : "#e5e7eb", color: stageaireView === "cours" ? "white" : "#374151" }}>
                    {(stageaireData.modules_list ?? []).length}
                  </span>
                  <svg className="h-3 w-3 shrink-0 transition-transform" style={{ transform: modulesExpanded ? "rotate(90deg)" : "rotate(0deg)", opacity: 0.6 }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {modulesExpanded && (
                  <div className="mt-0.5 ml-3 space-y-0.5 border-l-2 border-app-muted pl-2">
                    {(stageaireData.modules_list ?? []).map((m) => {
                      const isModActive = stageaireView === "cours" && selectedModule?.id === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { setStageaireView("cours"); handleOpenModule(m); }}
                          className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition text-left"
                          style={{ background: isModActive ? "#15173D" : "transparent", color: isModActive ? "white" : "#15173D" }}
                          title={m.nom}
                        >
                          <svg className="h-3 w-3 shrink-0 opacity-60" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /></svg>
                          <span className="flex-1 truncate">{m.nom}</span>
                          <span className="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold leading-none" style={{ background: isModActive ? "rgba(255,255,255,0.2)" : "#e5e7eb", color: isModActive ? "white" : "#374151" }}>
                            {m.matieres.length}
                          </span>
                        </button>
                      );
                    })}
                    {(stageaireData.modules_list ?? []).length === 0 && (
                      <p className="px-2 py-1.5 text-xs italic text-app-dark/40">Aucun module</p>
                    )}
                  </div>
                )}
              </div>

              {/* Contrôles */}
              {(["controles"] as const).map((tab) => {
                const active = stageaireView === tab;
                const badge = stageaireData.controls.pending_count;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setStageaireView(tab); setSelectedModule(null); setSelectedMatiere(null); setSelectedBrochure(null); setSelectedCours(null); setCoursFileCache({}); }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition text-left"
                    style={{ background: active ? "#15173D" : "transparent", color: active ? "white" : "#15173D" }}
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="flex-1">Contrôles</span>
                    {badge > 0 && (
                      <span className="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold leading-none" style={{ background: active ? "rgba(255,255,255,0.2)" : "#982598", color: "white" }}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Réponses */}
              {(["reponse_controle"] as const).map((tab) => {
                const active = stageaireView === tab;
                const badge = (stageaireData.soumissions_detail ?? []).length;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setStageaireView(tab); setSelectedModule(null); setSelectedMatiere(null); setSelectedBrochure(null); setSelectedCours(null); setCoursFileCache({}); }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition text-left"
                    style={{ background: active ? "#15173D" : "transparent", color: active ? "white" : "#15173D" }}
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className="flex-1">Mes réponses</span>
                    {badge > 0 && (
                      <span className="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold leading-none" style={{ background: active ? "rgba(255,255,255,0.2)" : "#e5e7eb", color: active ? "white" : "#374151" }}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Sujet fin de stage */}
              {(["sujet"] as const).map((tab) => {
                const active = stageaireView === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setStageaireView(tab); setSelectedModule(null); setSelectedMatiere(null); setSelectedBrochure(null); setSelectedCours(null); setCoursFileCache({}); }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition text-left"
                    style={{ background: active ? "#15173D" : "transparent", color: active ? "white" : "#15173D" }}
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="flex-1">Sujet fin de stage</span>
                    {stageaireData.sujet_fin_stage && (
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stageaireData.sujet_fin_stage.etat === "EN_COURS" ? "#982598" : "#22c55e" }} />
                    )}
                  </button>
                );
              })}

            </nav>

            {/* Footer stats */}
            <div className="px-4 py-3 border-t border-app-muted/60 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-app-dark/40">Résumé</p>
              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="rounded-lg bg-app-soft py-2">
                  <p className="text-base font-black text-app-dark">{(stageaireData.cours_list ?? []).length}</p>
                  <p className="text-xs text-app-dark/50">Cours</p>
                </div>
                <div className="rounded-lg bg-app-soft py-2">
                  <p className="text-base font-black text-emerald-600">{stageaireData.controls.submitted_count}</p>
                  <p className="text-xs text-app-dark/50">Soumis</p>
                </div>
                <div className="rounded-lg py-2" style={{ background: stageaireData.controls.pending_count > 0 ? "rgba(152,37,152,0.1)" : "#F1E9E9" }}>
                  <p className="text-base font-black" style={{ color: stageaireData.controls.pending_count > 0 ? "#982598" : "#15173D" }}>{stageaireData.controls.pending_count}</p>
                  <p className="text-xs text-app-dark/50">Attente</p>
                </div>
              </div>
            </div>
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 overflow-y-auto rounded-r-2xl border border-app-muted bg-app-soft/40 p-6 grid gap-5 content-start">

            {/* ── DASHBOARD ── */}
            {stageaireView === "dashboard" ? (
              <>
                {/* Hero banner */}
                <div className="relative overflow-hidden rounded-2xl p-8 shadow-lg" style={{ background: "linear-gradient(135deg,#0E0F29 0%,#15173D 60%,#1E1F4A 100%)" }}>
                  <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full opacity-10" style={{ background: "#982598" }} />
                  <div className="pointer-events-none absolute -bottom-8 right-24 h-32 w-32 rounded-full opacity-10" style={{ background: "#982598" }} />
                  <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Espace Stagiaire</p>
                      <h1 className="mt-1 text-2xl font-black uppercase leading-tight text-white md:text-3xl">
                        Bienvenue,<br /><span style={{ color: "#E491C9" }}>{user.username}</span>
                      </h1>
                      <p className="mt-2 max-w-sm text-sm text-white/60">Accédez à vos cours, suivez vos contrôles et consultez votre progression.</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button className="rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:opacity-90" style={{ background: "#982598" }} onClick={() => { setStageaireView("cours"); setModulesExpanded(true); }} type="button">
                          Mes modules →
                        </button>
                        {stageaireData.controls.pending_count > 0 && (
                          <button className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20" onClick={() => setStageaireView("controles")} type="button">
                            {stageaireData.controls.pending_count} contrôle{stageaireData.controls.pending_count > 1 ? "s" : ""} en attente
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-3">
                      {[
                        { label: "Cours", value: (stageaireData.cours_list ?? []).length, color: "white" },
                        { label: "Contrôles", value: stageaireData.controls.available_count, color: "#E491C9" },
                        { label: "Soumis", value: stageaireData.controls.submitted_count, color: "#22c55e" },
                      ].map((s) => (
                        <div key={s.label} className="flex flex-col items-center justify-center rounded-2xl px-4 py-3 text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                          <p className="mt-0.5 text-xs font-medium text-white/50">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => { setStageaireView("cours"); setModulesExpanded(true); }}
                    className="group flex items-center gap-4 rounded-2xl border border-app-muted bg-white p-5 text-left shadow-sm transition hover:border-app-dark/30 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(21,23,61,0.08)" }}>
                      <svg className="h-5 w-5 text-app-dark" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-app-dark">Consulter les cours</p>
                      <p className="mt-0.5 text-xs text-app-dark/50">{(stageaireData.modules_list ?? []).length} module{(stageaireData.modules_list ?? []).length !== 1 ? "s" : ""} disponible{(stageaireData.modules_list ?? []).length !== 1 ? "s" : ""}</p>
                    </div>
                    <svg className="ml-auto h-4 w-4 shrink-0 text-app-dark/30 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStageaireView("controles")}
                    className="group flex items-center gap-4 rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                    style={{ borderColor: stageaireData.controls.pending_count > 0 ? "rgba(152,37,152,0.35)" : undefined }}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: stageaireData.controls.pending_count > 0 ? "rgba(152,37,152,0.1)" : "rgba(21,23,61,0.08)" }}>
                      <svg className="h-5 w-5" style={{ color: stageaireData.controls.pending_count > 0 ? "#982598" : "#15173D" }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-app-dark">Mes contrôles</p>
                      <p className="mt-0.5 text-xs" style={{ color: stageaireData.controls.pending_count > 0 ? "#982598" : "rgba(21,23,61,0.5)" }}>
                        {stageaireData.controls.pending_count > 0 ? `${stageaireData.controls.pending_count} en attente` : `${stageaireData.controls.submitted_count} soumis`}
                      </p>
                    </div>
                    <svg className="ml-auto h-4 w-4 shrink-0 text-app-dark/30 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStageaireView("reponse_controle")}
                    className="group flex items-center gap-4 rounded-2xl border border-app-muted bg-white p-5 text-left shadow-sm transition hover:border-app-dark/30 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(21,23,61,0.08)" }}>
                      <svg className="h-5 w-5 text-app-dark" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-app-dark">Mes réponses</p>
                      <p className="mt-0.5 text-xs text-app-dark/50">{(stageaireData.soumissions_detail ?? []).length} soumission{(stageaireData.soumissions_detail ?? []).length !== 1 ? "s" : ""}</p>
                    </div>
                    <svg className="ml-auto h-4 w-4 shrink-0 text-app-dark/30 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>

                {/* Profile + Classes */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Profile card */}
                  <article className="rounded-2xl border border-app-muted bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-app-dark/40 mb-3">Mon profil</p>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: "#15173D" }}>
                        {user?.username?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="font-semibold text-app-dark">{user?.username}</p>
                        <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connecté
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t border-app-muted/60 pt-3">
                      {[
                        { label: "Matricule", value: user?.matricule || "—" },
                        { label: "Corps", value: user?.corps?.label ?? (user?.est_civil ? "Civil" : "—") },
                        { label: "Email", value: user?.email || "—" },
                        { label: "Spécialité", value: user?.speciality?.label || "—" },
                      ].map((f) => (
                        <div key={f.label}>
                          <p className="text-xs text-app-dark/40">{f.label}</p>
                          <p className="mt-0.5 text-sm font-semibold truncate text-app-dark">{f.value}</p>
                        </div>
                      ))}
                    </div>
                  </article>

                  {/* Classes + notes */}
                  <article className="rounded-2xl border border-app-muted bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-app-dark/40 mb-3">Mes classes</p>
                    {stageaireData.classes.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {stageaireData.classes.map((entry) => (
                          <div key={entry.classe_code} className="rounded-xl border border-app-muted/70 bg-app-soft px-3 py-2">
                            <p className="text-sm font-bold text-app-dark">{entry.classe_label || entry.classe_code}</p>
                            <p className="text-xs text-app-dark/50">{entry.brigade_code}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-4 text-center">
                        <svg className="h-8 w-8 text-app-dark/20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        <p className="text-xs text-app-dark/40 italic">Aucune classe assignée pour le moment.</p>
                      </div>
                    )}
                    {stageaireData.notes.length > 0 && (
                      <>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-app-dark/40 mb-2">Notes publiées</p>
                        <div className="space-y-1.5">
                          {stageaireData.notes.slice(0, 3).map((note, index) => (
                            <div key={`${note.controle}-${index}`} className="flex items-center justify-between rounded-lg border border-app-muted/60 bg-app-soft px-3 py-1.5">
                              <p className="text-xs truncate text-app-dark/70 flex-1 mr-2">{note.controle}</p>
                              <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: parseFloat(note.note) >= 10 ? "#22c55e" : "#ef4444" }}>
                                {note.note}/20
                              </span>
                            </div>
                          ))}
                          {stageaireData.notes.length > 3 && (
                            <button type="button" onClick={() => setStageaireView("reponse_controle")} className="text-xs text-app-accent font-semibold hover:underline">
                              +{stageaireData.notes.length - 3} autre{stageaireData.notes.length - 3 > 1 ? "s" : ""} →
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </article>
                </div>

                {/* Notifications */}
                {stageaireData.notifications.latest.length > 0 && (
                  <article className="rounded-2xl border border-app-muted bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-app-dark/40">Notifications récentes</p>
                      {stageaireData.notifications.unread_count > 0 && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: "#982598" }}>
                          {stageaireData.notifications.unread_count} non lues
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {stageaireData.notifications.latest.map((n) => (
                        <div key={n.id} className="flex gap-3 rounded-xl border border-app-muted/60 bg-app-soft/60 p-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(152,37,152,0.12)" }}>
                            {n.type === "nouveau_cours" ? (
                              <svg className="h-4 w-4 text-app-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            ) : n.type === "correction_publiee" ? (
                              <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            ) : (
                              <svg className="h-4 w-4 text-app-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-app-dark">{n.title}</p>
                            {n.message && <p className="mt-0.5 text-xs text-app-dark/60 line-clamp-2">{n.message}</p>}
                            <p className="mt-1 text-xs text-app-dark/35">{new Date(n.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                )}
              </>
            ) : null}

            {/* ── COURS — no module selected ── */}
            {stageaireView === "cours" && !selectedModule && !selectedMatiere && !selectedCours ? (
              <article className="rounded-2xl border border-app-muted bg-white p-8 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-app-dark/40 mb-4">Modules de formation</p>
                {(stageaireData.modules_list ?? []).length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {(stageaireData.modules_list ?? []).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { handleOpenModule(m); setModulesExpanded(true); }}
                        className="group flex items-center gap-4 rounded-xl border border-app-muted bg-app-soft/40 p-4 text-left transition hover:border-app-dark/30 hover:bg-white hover:shadow-sm"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "#15173D" }}>
                          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-app-dark truncate">{m.nom}</p>
                          <p className="mt-0.5 text-xs text-app-dark/50">{m.matieres.length} matière{m.matieres.length !== 1 ? "s" : ""}</p>
                        </div>
                        <svg className="h-4 w-4 shrink-0 text-app-dark/30 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(21,23,61,0.06)" }}>
                      <svg className="h-7 w-7 text-app-dark/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <div>
                      <p className="font-semibold text-app-dark/50">Aucun module disponible</p>
                      <p className="mt-1 text-xs text-app-dark/35">Les modules de formation apparaîtront ici une fois assignés.</p>
                    </div>
                  </div>
                )}
              </article>
            ) : null}

            {/* ── COURS — matière list within a module ── */}
            {stageaireView === "cours" && selectedModule && !selectedMatiere && !selectedCours ? (
              <>
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-xs">
                  <button type="button" onClick={() => setSelectedModule(null)} className="text-app-dark/50 hover:text-app-dark transition">Modules</button>
                  <svg className="h-3 w-3 text-app-dark/30" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  <span className="font-semibold text-app-dark truncate">{selectedModule.nom}</span>
                </nav>

                <article className="rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "#15173D" }}>
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-app-dark">{selectedModule.nom}</h3>
                      <p className="text-xs text-app-dark/50">{selectedModule.matieres.length} matière{selectedModule.matieres.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {selectedModule.matieres.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedModule.matieres.map((mat) => (
                        <button
                          key={mat.id}
                          type="button"
                          onClick={() => void handleOpenMatiere(mat.id)}
                          className="group flex items-center gap-3 rounded-xl border border-app-muted bg-app-soft/40 p-4 text-left transition hover:border-app-dark/30 hover:bg-white hover:shadow-sm"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(152,37,152,0.1)" }}>
                            <svg className="h-4 w-4 text-app-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-app-dark truncate">{mat.nom}</p>
                            <p className="mt-0.5 text-xs text-app-dark/50">{mat.cours_count} cours</p>
                          </div>
                          {mat.cours_count > 0 ? (
                            <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: "#15173D" }}>{mat.cours_count}</span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-app-muted/50 px-2 py-0.5 text-xs text-app-dark/40">0</span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-app-soft">
                        <svg className="h-6 w-6 text-app-dark/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <p className="text-sm text-app-dark/40 italic">Aucune matière dans ce module.</p>
                    </div>
                  )}
                </article>
              </>
            ) : null}

            {/* ── COURS — matière: brochures or direct cours ── */}
            {stageaireView === "cours" && selectedMatiere && !selectedBrochure && !selectedCours ? (
              <>
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-xs flex-wrap">
                  <button type="button" onClick={() => setSelectedModule(null)} className="text-app-dark/50 hover:text-app-dark transition">Modules</button>
                  <svg className="h-3 w-3 text-app-dark/30" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  <button type="button" onClick={() => setSelectedMatiere(null)} className="text-app-dark/50 hover:text-app-dark transition">{selectedMatiere.module_nom}</button>
                  <svg className="h-3 w-3 text-app-dark/30" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  <span className="font-semibold text-app-dark">{selectedMatiere.nom}</span>
                </nav>

                {selectedMatiere.brochures.length > 0 ? (
                  <article className="rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-app-dark/40 mb-4">Brochures — {selectedMatiere.nom}</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedMatiere.brochures.map((b) => (
                        <button key={b.id} type="button" onClick={() => void handleOpenBrochure(b.id)}
                          className="group flex items-center gap-3 rounded-xl border border-app-muted bg-app-soft/40 p-4 text-left transition hover:border-app-dark/30 hover:bg-white hover:shadow-sm">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(21,23,61,0.08)" }}>
                            <svg className="h-4 w-4 text-app-dark" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-app-dark truncate">{b.nom}</p>
                            <p className="mt-0.5 text-xs text-app-dark/50">{b.cours_count} cours</p>
                          </div>
                          {b.cours_count > 0 ? (
                            <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: "#15173D" }}>{b.cours_count}</span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-app-muted/50 px-2 py-0.5 text-xs text-app-dark/40">0</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </article>
                ) : (
                  <article className="rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-app-dark/40 mb-4">Cours — {selectedMatiere.nom}</p>
                    {selectedMatiere.cours.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedMatiere.cours.map((c) => (
                          <button key={c.id} type="button" onClick={() => void openCoursModal(c.id)}
                            className="group flex items-start gap-3 rounded-xl border border-app-muted bg-app-soft/40 p-4 text-left transition hover:border-app-accent/30 hover:bg-white hover:shadow-sm">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(152,37,152,0.1)" }}>
                              <svg className="h-4 w-4 text-app-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-app-dark leading-snug">{c.titre}</p>
                              {c.description && <p className="mt-0.5 text-xs text-app-dark/50 line-clamp-2">{c.description}</p>}
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-app-dark/40">{c.instructeur}</span>
                                {c.controles_count > 0 && (
                                  <span className="rounded-full px-1.5 py-0.5 text-xs font-semibold text-white" style={{ background: "#982598" }}>
                                    {c.controles_count} contrôle{c.controles_count > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                            <svg className="mt-1 h-4 w-4 shrink-0 text-app-dark/20 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-app-soft">
                          <svg className="h-6 w-6 text-app-dark/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /></svg>
                        </div>
                        <p className="text-sm text-app-dark/40 italic">Aucun cours dans cette matière.</p>
                      </div>
                    )}
                  </article>
                )}
              </>
            ) : null}

            {/* ── COURS — brochure cours list ── */}
            {stageaireView === "cours" && selectedBrochure && !selectedCours ? (
              <>
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-xs flex-wrap">
                  <button type="button" onClick={() => { setSelectedBrochure(null); setSelectedMatiere(null); setSelectedModule(null); }} className="text-app-dark/50 hover:text-app-dark transition">Modules</button>
                  <svg className="h-3 w-3 text-app-dark/30" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  <button type="button" onClick={() => setSelectedBrochure(null)} className="text-app-dark/50 hover:text-app-dark transition">{selectedBrochure.matiere_nom}</button>
                  <svg className="h-3 w-3 text-app-dark/30" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  <span className="font-semibold text-app-dark">{selectedBrochure.nom}</span>
                </nav>

                <article className="rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-app-dark/40 mb-4">Cours — {selectedBrochure.nom}</p>
                  {selectedBrochure.cours.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedBrochure.cours.map((c) => (
                        <button key={c.id} type="button" onClick={() => void openCoursModal(c.id)}
                          className="group flex items-start gap-3 rounded-xl border border-app-muted bg-app-soft/40 p-4 text-left transition hover:border-app-accent/30 hover:bg-white hover:shadow-sm">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(152,37,152,0.1)" }}>
                            <svg className="h-4 w-4 text-app-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-app-dark leading-snug">{c.titre}</p>
                            {c.description && <p className="mt-0.5 text-xs text-app-dark/50 line-clamp-2">{c.description}</p>}
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-app-dark/40">{c.instructeur}</span>
                              {c.controles_count > 0 && (
                                <span className="rounded-full px-1.5 py-0.5 text-xs font-semibold text-white" style={{ background: "#982598" }}>
                                  {c.controles_count} contrôle{c.controles_count > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                          <svg className="mt-1 h-4 w-4 shrink-0 text-app-dark/20 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-app-soft">
                        <svg className="h-6 w-6 text-app-dark/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /></svg>
                      </div>
                      <p className="text-sm text-app-dark/40 italic">Aucun cours dans cette brochure.</p>
                    </div>
                  )}
                </article>
              </>
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
                  {selectedCours.matiere ? (
                    <span className="text-sm text-app-dark/50">{selectedCours.matiere}</span>
                  ) : null}
                </div>

                {/* Course meta */}
                <article className="rounded-2xl border border-app-muted bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-bold text-app-dark">{selectedCours.titre}</h2>
                  {selectedCours.description ? (
                    <p className="mt-2 text-sm text-app-dark/70 whitespace-pre-wrap">{selectedCours.description}</p>
                  ) : null}
                  <p className="mt-3 text-xs text-app-dark/50">Instructeur : <span className="font-semibold text-app-dark">{selectedCours.instructeur}</span> &mdash; Déposé le {selectedCours.date_depot}</p>
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
                  <div className="rounded-xl border border-dashed border-app-muted bg-white p-6 text-center">
                    <p className="text-sm text-app-dark/40 italic">Aucun fichier de cours disponible.</p>
                  </div>
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

            {/* ── CONTRÔLES ── */}
            {stageaireView === "controles" ? (
              <>
                {/* Stats bar */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Disponibles", value: stageaireData.controls.available_count, color: "#15173D", bg: "rgba(21,23,61,0.07)" },
                    { label: "Soumis", value: stageaireData.controls.submitted_count, color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
                    { label: "En attente", value: stageaireData.controls.pending_count, color: "#982598", bg: "rgba(152,37,152,0.08)" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl border border-app-muted bg-white p-4 text-center shadow-sm">
                      <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                      <p className="mt-0.5 text-xs text-app-dark/50">{s.label}</p>
                    </div>
                  ))}
                </div>

                <article className="rounded-2xl border border-app-muted bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-app-muted/60" style={{ background: "#15173D" }}>
                    <h3 className="font-bold text-white">Contrôles à réaliser</h3>
                    <p className="mt-0.5 text-xs text-white/50">Répondez aux contrôles avant la date limite.</p>
                  </div>
                  <div className="p-5 space-y-3">
                    {stageaireData.controls_list.length > 0 ? stageaireData.controls_list.map((control) => {
                      const submitted = stageaireData.submitted_control_ids.includes(control.id);
                      const isOverdue = !submitted && control.deadline && new Date(control.deadline) < new Date();
                      return (
                        <div
                          key={control.id}
                          className="rounded-xl border p-4 transition"
                          style={{ borderColor: submitted ? "rgba(34,197,94,0.3)" : isOverdue ? "rgba(239,68,68,0.3)" : "rgba(228,145,201,0.5)", background: submitted ? "rgba(34,197,94,0.04)" : isOverdue ? "rgba(239,68,68,0.03)" : "white" }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: submitted ? "rgba(34,197,94,0.1)" : "rgba(152,37,152,0.1)" }}>
                                {submitted ? (
                                  <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                  <svg className="h-4 w-4 text-app-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-app-dark leading-snug">{control.name}</p>
                                <p className="mt-0.5 text-xs text-app-dark/50 truncate">Cours : {control.cours}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              {submitted ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">✓ Soumis</span>
                              ) : (
                                <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: isOverdue ? "#ef4444" : "#f59e0b" }}>
                                  {isOverdue ? "En retard" : "À faire"}
                                </span>
                              )}
                              {control.deadline && (
                                <span className="text-xs" style={{ color: isOverdue ? "#ef4444" : "rgba(21,23,61,0.4)" }}>
                                  {new Date(control.deadline).toLocaleDateString("fr-FR")}
                                </span>
                              )}
                            </div>
                          </div>
                          {control.bareme ? <p className="mt-2 text-xs text-app-dark/40">Barème : {control.bareme} pts</p> : null}
                          {control.enonce ? (
                            <div className="mt-3 rounded-lg border border-app-muted/60 bg-app-soft/60 p-3">
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-app-dark/40">Énoncé</p>
                              <p className="whitespace-pre-wrap text-sm text-app-dark/80">{control.enonce}</p>
                            </div>
                          ) : (
                            <p className="mt-2 text-xs italic text-app-dark/35">Aucun énoncé textuel — voir le fichier joint.</p>
                          )}
                        </div>
                      );
                    }) : (
                      <div className="flex flex-col items-center gap-3 py-10 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(21,23,61,0.06)" }}>
                          <svg className="h-7 w-7 text-app-dark/25" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        </div>
                        <div>
                          <p className="font-semibold text-app-dark/50">Aucun contrôle disponible</p>
                          <p className="mt-0.5 text-xs text-app-dark/35">Les contrôles assignés à votre classe apparaîtront ici.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </article>

                {stageaireData.notes.length > 0 && (
                  <article className="rounded-2xl border border-app-muted bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-app-muted/60 flex items-center gap-3">
                      <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                      <h3 className="font-bold text-app-dark">Notes publiées</h3>
                    </div>
                    <div className="p-5 space-y-2">
                      {stageaireData.notes.map((note, index) => (
                        <div key={`${note.controle}-${index}`} className="flex items-center justify-between rounded-xl border border-app-muted/60 bg-app-soft/40 px-4 py-3">
                          <p className="text-sm text-app-dark/80 flex-1 mr-3 truncate">{note.controle}</p>
                          <span className="shrink-0 rounded-full px-3 py-1 text-sm font-black text-white" style={{ background: parseFloat(note.note) >= 10 ? "#22c55e" : "#ef4444" }}>
                            {note.note}/20
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                )}
              </>
            ) : null}

            {/* ── RÉPONSES CONTRÔLES ── */}
            {stageaireView === "reponse_controle" ? (
              <article className="rounded-2xl border border-app-muted bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-app-muted/60" style={{ background: "#15173D" }}>
                  <h3 className="font-bold text-white">Mes réponses aux contrôles</h3>
                  <p className="mt-0.5 text-xs text-white/50">Historique de vos soumissions et corrections officielles.</p>
                </div>
                <div className="p-5 space-y-4">
                  {(stageaireData.soumissions_detail ?? []).length > 0 ? (stageaireData.soumissions_detail ?? []).map((s) => (
                    <div className="rounded-xl border border-app-muted bg-app-soft/30 p-4" key={s.soumission_id}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-app-dark">{s.controle_name}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${s.statut === "SOUMIS" ? "bg-blue-100 text-blue-700" : s.statut === "RETARD" ? "bg-red-100 text-red-700" : "bg-app-soft text-app-dark/60"}`}>
                          {s.statut}
                        </span>
                      </div>
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-app-dark/50">
                        <span>Soumis le {new Date(s.submitted_at).toLocaleDateString("fr-FR")}</span>
                        {s.has_fichier ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 font-semibold">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            fichier joint
                          </span>
                        ) : null}
                      </p>
                      {s.note !== null && (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                          <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span className="text-sm font-black text-emerald-700">{s.note}/20</span>
                        </div>
                      )}
                      {s.correction_publiee ? (
                        <div className="mt-3 rounded bg-app-soft p-3">
                          <p className="text-xs font-semibold text-app-dark/70 mb-1">{s.correction_titre ? `Correction — ${s.correction_titre}` : "Correction officielle"}</p>
                          <p className="text-sm text-app-dark/80 whitespace-pre-wrap">{s.correction_publiee}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-app-dark/40 italic">Aucune correction publiée pour ce contrôle.</p>
                      )}
                      {/* PDF file picker — always available */}
                      <div className="mt-3 rounded border border-dashed border-app-muted bg-app-soft/50 p-3">
                        <div className="mb-2 flex items-center gap-1.5">
                          <svg className="h-3.5 w-3.5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/></svg>
                          <p className="text-xs font-semibold text-app-dark/70">
                            {s.has_fichier ? "Remplacer le fichier PDF" : "Joindre un fichier PDF"}
                          </p>
                        </div>
                        <label className="grid gap-1 text-xs">
                          <input
                            accept=".pdf,application/pdf"
                            className="rounded border border-app-muted bg-white px-2 py-1 text-xs"
                            type="file"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setSubmissionFiles((prev) => ({ ...prev, [s.controle_id]: f }));
                            }}
                          />
                          {submissionFiles[s.controle_id] ? (
                            <span className="text-app-dark/60">{submissionFiles[s.controle_id].name}</span>
                          ) : null}
                        </label>
                        {submissionFiles[s.controle_id] ? (
                          <button
                            className="mt-2 rounded bg-app-dark px-3 py-1.5 text-xs text-white"
                            type="button"
                            onClick={() => void handleSubmitAnswer(s.controle_id)}
                          >
                            {s.has_fichier ? "Remplacer" : "Attacher le fichier"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {(stageaireData.soumissions_detail ?? []).length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(21,23,61,0.06)" }}>
                        <svg className="h-7 w-7 text-app-dark/25" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                      </div>
                      <div>
                        <p className="font-semibold text-app-dark/50">Aucune réponse soumise</p>
                        <p className="mt-0.5 text-xs text-app-dark/35">Vos réponses aux contrôles apparaîtront ici.</p>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ) : null}

            {/* ── SUJET FIN DE STAGE ── */}
            {stageaireView === "sujet" ? (
              <article className="rounded-2xl border border-app-muted bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-app-muted/60" style={{ background: "#15173D" }}>
                  <h3 className="font-bold text-white">Sujet de fin de stage</h3>
                  <p className="mt-0.5 text-xs text-white/50">Votre sujet de recherche et encadrant assigné.</p>
                </div>
                <div className="p-6">
                  {stageaireData.sujet_fin_stage ? (
                    <div className="space-y-4">
                      {/* Status badge */}
                      <div className="flex items-center gap-3">
                        <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: stageaireData.sujet_fin_stage.etat === "EN_COURS" ? "#982598" : stageaireData.sujet_fin_stage.etat === "TERMINE" ? "#22c55e" : "#ef4444" }}>
                          {stageaireData.sujet_fin_stage.etat.replace("_", " ")}
                        </span>
                        {stageaireData.sujet_fin_stage.date_affectation && (
                          <span className="text-xs text-app-dark/40">Affecté le {new Date(stageaireData.sujet_fin_stage.date_affectation).toLocaleDateString("fr-FR")}</span>
                        )}
                      </div>
                      {/* Title */}
                      <div className="rounded-xl border border-app-muted/60 bg-app-soft/50 p-5">
                        <p className="text-lg font-bold text-app-dark">{stageaireData.sujet_fin_stage.titre}</p>
                        {stageaireData.sujet_fin_stage.description && (
                          <p className="mt-3 text-sm text-app-dark/70 whitespace-pre-wrap leading-relaxed">{stageaireData.sujet_fin_stage.description}</p>
                        )}
                      </div>
                      {/* Encadrant */}
                      <div className="flex items-center gap-3 rounded-xl border border-app-muted/60 bg-white px-4 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "#15173D" }}>
                          {stageaireData.sujet_fin_stage.encadrant.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs text-app-dark/40">Encadrant</p>
                          <p className="font-semibold text-app-dark">{stageaireData.sujet_fin_stage.encadrant}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-12 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(21,23,61,0.06)" }}>
                        <svg className="h-8 w-8 text-app-dark/25" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div>
                        <p className="font-semibold text-app-dark/50">Aucun sujet affecté</p>
                        <p className="mt-1 text-xs text-app-dark/35 max-w-xs">Votre sujet de fin de stage apparaîtra ici une fois qu'un encadrant vous l'aura assigné.</p>
                      </div>
                    </div>
                  )}
                </div>
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
            <div className="mt-3 grid gap-1">
              <AdminNavButton active={adminView === "overview"} onClick={() => { setAdminView("overview"); setSelectedAdminUser(null); }}>
                {t("admin.navOverview")}
              </AdminNavButton>

              {/* Users — collapsible */}
              <div>
                <button
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${adminView === "users" ? "bg-app-dark text-white" : "text-app-dark hover:bg-app-soft"}`}
                  onClick={() => {
                    setAdminUsersExpanded((v) => !v);
                    setAdminView("users");
                    setSelectedAdminUser(null);
                    setAdminUserRoleFilter(null);
                    setAdminUsersPage(1);
                  }}
                  type="button"
                >
                  <span>{t("admin.navUsers")}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-3.5 w-3.5 transition-transform ${adminUsersExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {adminUsersExpanded && (
                  <div className="ml-3 mt-1 grid gap-0.5 border-l-2 border-app-muted pl-3">
                    {(["Stagiaire", "Instructeur", "Superviseur", "Coordinateur", "Admin"] as const).map((role) => {
                      const count = adminData.users.filter((u) => u.role === role).length;
                      const isActive = adminView === "users" && adminUserRoleFilter === role;
                      return (
                        <button
                          key={role}
                          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition ${isActive ? "bg-app-dark text-white" : "text-app-dark/70 hover:bg-app-soft"}`}
                          onClick={() => {
                            setAdminView("users");
                            setSelectedAdminUser(null);
                            setAdminUserRoleFilter(role);
                            setAdminUsersPage(1);
                          }}
                          type="button"
                        >
                          <span>{role}s</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-app-muted text-app-dark/60"}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <AdminNavButton active={adminView === "accounts"} onClick={() => { setAdminView("accounts"); setSelectedAdminUser(null); }}>
                {t("admin.navAccounts")}
              </AdminNavButton>
              <AdminNavButton active={adminView === "subjects"} onClick={() => { setAdminView("subjects"); setSelectedAdminUser(null); }}>
                {t("admin.navSubjects")}
              </AdminNavButton>
              <AdminNavButton active={adminView === "classes"} onClick={() => { setAdminView("classes"); setSelectedAdminUser(null); }}>
                {t("admin.navClasses")}
              </AdminNavButton>
              <AdminNavButton active={adminView === "references"} onClick={() => { setAdminView("references"); setSelectedAdminUser(null); }}>
                References
              </AdminNavButton>
              <AdminNavButton active={adminView === "events"} onClick={() => { setAdminView("events"); setSelectedAdminUser(null); }}>
                Events
              </AdminNavButton>
            </div>
          </aside>

          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            {adminView === "overview" ? (
              <div className="grid gap-5">
                <PanelSection title="Gestion de la plateforme">
                  <MetricGrid>
                    <MetricCard label="Utilisateurs" value={adminData.platform.users_total} />
                    <MetricCard label="Utilisateurs actifs" value={adminData.platform.users_active} />
                    <MetricCard label="Cours" value={adminData.platform.cours_total} />
                    <MetricCard label="Controles" value={adminData.platform.controles_total} />
                    <MetricCard label="Soumissions" value={adminData.platform.soumissions_total} />
                  </MetricGrid>
                </PanelSection>

                {/* ── Statistiques rapides par rôle ── */}
                <PanelSection title="Statistiques rapides">
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {(["Stagiaire", "Instructeur", "Superviseur", "Coordinateur", "Admin"] as const).map((role) => {
                      const total = adminData.users.filter((u) => u.role === role).length;
                      const active = adminData.users.filter((u) => u.role === role && u.is_active).length;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => { setAdminView("users"); setSelectedAdminUser(null); setAdminUserRoleFilter(role); setAdminUsersExpanded(true); setAdminUsersPage(1); }}
                          className="rounded-xl border border-app-muted bg-app-soft p-4 text-left transition hover:border-app-dark hover:shadow-sm"
                        >
                          <p className="text-3xl font-black text-app-dark">{total}</p>
                          <p className="mt-1 text-xs font-semibold text-app-dark/60">{role}s</p>
                          <p className="mt-0.5 text-[10px] text-app-dark/40">{active} actif{active !== 1 ? "s" : ""}</p>
                        </button>
                      );
                    })}
                  </div>
                </PanelSection>
              </div>
            ) : null}

            {adminView === "users" && !selectedAdminUser ? (
              <PanelSection title="Utilisateurs">

                {/* ── Actions de masse ── */}
                <div className="mt-3 rounded-xl border border-app-muted bg-app-soft px-4 py-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-app-dark/50">Actions de masse</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-app-muted bg-white px-3 py-1.5 text-xs font-semibold text-app-dark transition hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                      onClick={async () => {
                        const targets = adminData.users.filter((u) => !u.is_active && (!adminUserRoleFilter || u.role === adminUserRoleFilter));
                        await Promise.all(targets.map((u) => apiFetch(`/api/admin/users/${u.id}/toggle-active/`, { method: "POST" })));
                        await loadDashboard();
                      }}
                    >
                      ✓ Activer tous {adminUserRoleFilter ? `les ${adminUserRoleFilter}s` : ""}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-app-muted bg-white px-3 py-1.5 text-xs font-semibold text-app-dark transition hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                      onClick={async () => {
                        const targets = adminData.users.filter((u) => u.is_active && u.id !== user.id && (!adminUserRoleFilter || u.role === adminUserRoleFilter));
                        await Promise.all(targets.map((u) => apiFetch(`/api/admin/users/${u.id}/toggle-active/`, { method: "POST" })));
                        await loadDashboard();
                      }}
                    >
                      ✕ Désactiver tous {adminUserRoleFilter ? `les ${adminUserRoleFilter}s` : ""}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-app-muted bg-white px-3 py-1.5 text-xs font-semibold text-app-dark transition hover:bg-app-soft"
                      onClick={() => {
                        const rows = adminData.users
                          .filter((u) => !adminUserRoleFilter || u.role === adminUserRoleFilter)
                          .map((u) => `${u.username},${u.email ?? ""},${u.role},${u.is_active ? "Actif" : "Inactif"}`);
                        const csv = ["Username,Email,Role,Statut", ...rows].join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `utilisateurs${adminUserRoleFilter ? `_${adminUserRoleFilter}` : ""}.csv`;
                        a.click();
                      }}
                    >
                      ↓ Exporter CSV
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-app-muted bg-app-soft px-3 py-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-app-dark/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    className="w-full bg-transparent text-sm outline-none placeholder:text-app-dark/40"
                    placeholder="Rechercher par username, email ou rôle…"
                    value={adminUserSearch}
                    onChange={(e) => { setAdminUserSearch(e.target.value); setAdminUsersPage(1); }}
                  />
                  {adminUserSearch ? (
                    <button className="text-app-dark/40 hover:text-app-dark" onClick={() => { setAdminUserSearch(""); setAdminUsersPage(1); }} type="button">✕</button>
                  ) : null}
                </div>

                {/* ── Filtres avancés ── */}
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-app-muted bg-app-soft px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-app-dark/50">Filtres avancés</p>
                  {/* Status filter */}
                  <div className="flex items-center gap-1 rounded-lg border border-app-muted bg-white p-0.5">
                    {(["tous", "actif", "inactif"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`rounded px-3 py-1 text-xs font-semibold transition ${adminStatusFilter === s ? "text-white" : "text-app-dark/60 hover:bg-app-soft"}`}
                        style={adminStatusFilter === s ? { background: "#15173D" } : {}}
                        onClick={() => { setAdminStatusFilter(s); setAdminUsersPage(1); }}
                      >
                        {s === "tous" ? "Tous" : s === "actif" ? "Actifs" : "Inactifs"}
                      </button>
                    ))}
                  </div>
                  {/* Sort */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-app-dark/50">Trier :</span>
                    <select
                      className="rounded-lg border border-app-muted bg-white px-2 py-1 text-xs text-app-dark outline-none"
                      value={adminUserSort}
                      onChange={(e) => { setAdminUserSort(e.target.value as "az" | "za" | "recent"); setAdminUsersPage(1); }}
                    >
                      <option value="az">A → Z</option>
                      <option value="za">Z → A</option>
                      <option value="recent">Plus récents</option>
                    </select>
                  </div>
                  {/* Reset */}
                  {(adminStatusFilter !== "tous" || adminUserSort !== "az") && (
                    <button
                      type="button"
                      className="text-xs text-app-accent underline"
                      onClick={() => { setAdminStatusFilter("tous"); setAdminUserSort("az"); setAdminUsersPage(1); }}
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>

                {adminData.users.length === 0 && (
                  <p className="mt-3 text-sm text-app-dark/70">Aucun utilisateur trouvé.</p>
                )}

                {/* Role groups with pagination */}
                {(() => {
                  // Build the full filtered+sorted list across all roles
                  const allFiltered = adminData.users.filter((u) => {
                    if (adminUserRoleFilter && u.role !== adminUserRoleFilter) return false;
                    if (adminStatusFilter === "actif" && !u.is_active) return false;
                    if (adminStatusFilter === "inactif" && u.is_active) return false;
                    if (adminUserSearch) {
                      const q = adminUserSearch.toLowerCase();
                      if (!u.username.toLowerCase().includes(q) && !(u.email ?? "").toLowerCase().includes(q)) return false;
                    }
                    return true;
                  }).sort((a, b) => {
                    if (adminUserSort === "za") return b.username.localeCompare(a.username);
                    if (adminUserSort === "recent") return b.id - a.id;
                    return a.username.localeCompare(b.username);
                  });

                  const totalFiltered = allFiltered.length;
                  const totalPages = Math.max(1, Math.ceil(totalFiltered / ADMIN_USERS_PER_PAGE));
                  const safePage = Math.min(adminUsersPage, totalPages);
                  const pageStart = (safePage - 1) * ADMIN_USERS_PER_PAGE;
                  const pageEnd = pageStart + ADMIN_USERS_PER_PAGE;
                  const pageUsers = allFiltered.slice(pageStart, pageEnd);

                  // Group page users by role
                  const roleOrder = ["Stagiaire", "Instructeur", "Superviseur", "Coordinateur", "Admin"];
                  const groups: Record<string, typeof pageUsers> = {};
                  for (const rg of roleOrder) groups[rg] = pageUsers.filter((u) => u.role === rg);

                  return (
                    <>
                      {/* Summary bar */}
                      <div className="mt-3 flex items-center justify-between text-xs text-app-dark/50">
                        <span>
                          {totalFiltered === 0
                            ? "Aucun résultat"
                            : `Affichage ${pageStart + 1}–${Math.min(pageEnd, totalFiltered)} sur ${totalFiltered} utilisateur${totalFiltered > 1 ? "s" : ""}`}
                        </span>
                        {adminUserSearch && totalFiltered === 0 && (
                          <span className="text-app-dark/40">Aucun résultat pour « {adminUserSearch} »</span>
                        )}
                      </div>

                      <div className="mt-3 grid gap-5">
                        {roleOrder.filter((rg) => groups[rg].length > 0).map((roleGroup) => (
                          <div key={roleGroup} className="overflow-hidden rounded-xl border border-app-muted">
                            {/* Group header */}
                            <div className="flex items-center justify-between px-4 py-2.5 text-white" style={{ background: "#15173D" }}>
                              <span className="text-sm font-bold uppercase tracking-wide">{roleGroup}s</span>
                              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{groups[roleGroup].length}</span>
                            </div>
                            {/* User rows */}
                            <div className="divide-y divide-app-muted/50 bg-white">
                              {groups[roleGroup].map((u) => {
                                const rps = resetPasswordState[u.id] ?? { value: "", show: false, saved: "" };
                                return (
                                  <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                                    {/* Avatar */}
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "#15173D" }}>
                                      {u.username[0]?.toUpperCase()}
                                    </div>
                                    {/* Info */}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-app-dark">{u.username}</p>
                                      <p className="truncate text-xs text-app-dark/50">{u.email || "—"}</p>
                                    </div>
                                    {/* Status */}
                                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                      {u.is_active ? "Actif" : "Inactif"}
                                    </span>
                                    {/* Password saved badge */}
                                    {rps.saved && (
                                      <span className="flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 font-mono text-xs text-green-800">
                                        {rps.saved}
                                        <button className="text-green-600 hover:text-green-800" onClick={() => navigator.clipboard.writeText(rps.saved)} type="button">⎘</button>
                                      </span>
                                    )}
                                    {/* Password reset inline */}
                                    <div className="flex items-center gap-1">
                                      <div className="relative flex items-center">
                                        <input
                                          className="w-32 rounded border border-app-muted px-2 py-1 pr-6 font-mono text-xs outline-none focus:border-app-accent"
                                          placeholder="Nouveau mdp"
                                          type={rps.show ? "text" : "password"}
                                          value={rps.value}
                                          onChange={(e) => setResetPasswordState((prev) => ({ ...prev, [u.id]: { ...rps, value: e.target.value } }))}
                                        />
                                        <button
                                          className="absolute right-1 text-app-dark/40 hover:text-app-dark"
                                          onClick={() => setResetPasswordState((prev) => ({ ...prev, [u.id]: { ...rps, show: !rps.show } }))}
                                          type="button"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={rps.show ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                                          </svg>
                                        </button>
                                      </div>
                                      <button
                                        className="rounded bg-app-accent px-2 py-1 text-xs text-white disabled:opacity-40"
                                        disabled={!rps.value}
                                        onClick={async () => {
                                          await apiFetch(`/api/admin/users/${u.id}/reset-password/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: rps.value }) });
                                          setResetPasswordState((prev) => ({ ...prev, [u.id]: { value: "", show: false, saved: rps.value } }));
                                        }}
                                        type="button"
                                      >
                                        ✓
                                      </button>
                                    </div>
                                    {/* Toggle active */}
                                    <button
                                      className="shrink-0 rounded bg-app-dark px-2 py-1 text-xs text-white disabled:opacity-40"
                                      disabled={u.id === user.id}
                                      onClick={() => void handleToggleUserStatus(u.id)}
                                      type="button"
                                    >
                                      {u.is_active ? "Désactiver" : "Activer"}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {totalFiltered === 0 && adminData.users.length > 0 && (
                          <p className="py-6 text-center text-sm text-app-dark/50">Aucun résultat avec ces filtres.</p>
                        )}
                      </div>

                      {/* ── Pagination ── */}
                      {totalPages > 1 && (
                        <div className="mt-5 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            disabled={safePage <= 1}
                            className="rounded-lg border border-app-muted bg-white px-3 py-1.5 text-xs font-semibold text-app-dark transition hover:bg-app-soft disabled:opacity-40"
                            onClick={() => setAdminUsersPage((p) => Math.max(1, p - 1))}
                          >
                            ← Précédent
                          </button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                              <button
                                key={pg}
                                type="button"
                                className={`h-7 w-7 rounded text-xs font-semibold transition ${safePage === pg ? "text-white" : "text-app-dark/60 hover:bg-app-soft"}`}
                                style={safePage === pg ? { background: "#982598" } : {}}
                                onClick={() => setAdminUsersPage(pg)}
                              >
                                {pg}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            disabled={safePage >= totalPages}
                            className="rounded-lg border border-app-muted bg-white px-3 py-1.5 text-xs font-semibold text-app-dark transition hover:bg-app-soft disabled:opacity-40"
                            onClick={() => setAdminUsersPage((p) => Math.min(totalPages, p + 1))}
                          >
                            Suivant →
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
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
                    <TextField
                      fullWidth
                      label="Password"
                      required
                      size="small"
                      type={showAccountPassword ? "text" : "password"}
                      value={accountForm.password}
                      variant="outlined"
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, password: e.target.value }))}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <button
                              type="button"
                              className="text-app-dark/50 hover:text-app-dark"
                              onClick={() => setShowAccountPassword((v) => !v)}
                            >
                              {showAccountPassword ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              )}
                            </button>
                          </InputAdornment>
                        ),
                      }}
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

                {lastCreatedAccount && (
                  <div className="rounded-lg border-2 border-green-400 bg-green-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold text-green-800">Compte créé avec succès</h3>
                      <button
                        className="text-green-600 hover:text-green-800"
                        onClick={() => setLastCreatedAccount(null)}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid gap-2 text-sm">
                      {[
                        { label: "Username", value: lastCreatedAccount.username },
                        { label: "Mot de passe", value: lastCreatedAccount.password },
                        { label: "Rôle", value: lastCreatedAccount.role },
                        { label: "Matricule", value: lastCreatedAccount.matricule },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between rounded bg-white px-3 py-2">
                          <span className="font-medium text-green-700">{label}:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-green-900">{value}</span>
                            <button
                              className="rounded bg-green-200 px-2 py-0.5 text-xs text-green-800 hover:bg-green-300"
                              onClick={() => navigator.clipboard.writeText(value)}
                            >
                              Copier
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                        <div className="flex items-center gap-2 rounded-lg border border-app-muted bg-app-soft px-3 py-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-app-dark/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                          </svg>
                          <input
                            className="w-full bg-transparent text-sm outline-none placeholder:text-app-dark/40"
                            placeholder="Rechercher un contrôle…"
                            value={adminControlSearch}
                            onChange={(e) => setAdminControlSearch(e.target.value)}
                          />
                          {adminControlSearch ? (
                            <button className="text-app-dark/40 hover:text-app-dark" onClick={() => setAdminControlSearch("")} type="button">✕</button>
                          ) : null}
                        </div>
                        <div className="mt-3 space-y-2">
                          {subjectControls
                            .filter((control) =>
                              control.name.toLowerCase().includes(adminControlSearch.toLowerCase()) ||
                              control.cours_title.toLowerCase().includes(adminControlSearch.toLowerCase()) ||
                              control.instructeur_username.toLowerCase().includes(adminControlSearch.toLowerCase())
                            )
                            .map((control) => (
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
                          {subjectControls.length > 0 && adminControlSearch && subjectControls.filter((c) => c.name.toLowerCase().includes(adminControlSearch.toLowerCase()) || c.cours_title.toLowerCase().includes(adminControlSearch.toLowerCase()) || c.instructeur_username.toLowerCase().includes(adminControlSearch.toLowerCase())).length === 0 ? (
                            <p className="text-sm text-app-dark/50">Aucun résultat pour « {adminControlSearch} ».</p>
                          ) : null}
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
                        <div className="flex items-center gap-2 rounded-lg border border-app-muted bg-app-soft px-3 py-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-app-dark/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                          </svg>
                          <input
                            className="w-full bg-transparent text-sm outline-none placeholder:text-app-dark/40"
                            placeholder="Rechercher un cours…"
                            value={adminCoursSearch}
                            onChange={(e) => setAdminCoursSearch(e.target.value)}
                          />
                          {adminCoursSearch ? (
                            <button className="text-app-dark/40 hover:text-app-dark" onClick={() => setAdminCoursSearch("")} type="button">✕</button>
                          ) : null}
                        </div>
                        <div className="mt-3 space-y-2">
                          {subjectCourses
                            .filter((course) =>
                              course.title.toLowerCase().includes(adminCoursSearch.toLowerCase()) ||
                              course.instructeur_username.toLowerCase().includes(adminCoursSearch.toLowerCase())
                            )
                            .map((course) => (
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
                          {subjectCourses.length > 0 && adminCoursSearch && subjectCourses.filter((c) => c.title.toLowerCase().includes(adminCoursSearch.toLowerCase()) || c.instructeur_username.toLowerCase().includes(adminCoursSearch.toLowerCase())).length === 0 ? (
                            <p className="text-sm text-app-dark/50">Aucun résultat pour « {adminCoursSearch} ».</p>
                          ) : null}
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

                {/* ── Créer une classe ── */}
                <div className="overflow-hidden rounded-2xl border border-app-muted bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b border-app-muted px-5 py-4" style={{ background: "#15173D" }}>
                    <span className="text-base font-bold text-white">Créer une classe</span>
                  </div>
                  <form className="flex gap-3 p-5" onSubmit={handleCreateClass}>
                    <input
                      className="flex-1 rounded-xl border border-app-muted bg-app-soft px-4 py-2.5 text-sm outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20"
                      placeholder="Nom de la classe (ex : Classe Alpha)"
                      value={newClassForm.libelle}
                      onChange={(e) => setNewClassForm({ libelle: e.target.value })}
                    />
                    <button
                      className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                      style={{ background: "#982598" }}
                      type="submit"
                      disabled={!newClassForm.libelle.trim()}
                    >
                      + Créer
                    </button>
                  </form>
                </div>

                {/* ── Gestion des affectations ── */}
                <div className="overflow-hidden rounded-2xl border border-app-muted bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b border-app-muted px-5 py-4" style={{ background: "#15173D" }}>
                    <span className="text-base font-bold text-white">Gestion des affectations</span>
                    {selectedClassId && (
                      <span className="ml-auto rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white">
                        {classesData.find((c) => c.id === selectedClassId)?.code ?? ""}
                      </span>
                    )}
                  </div>
                  <div className="p-5 grid gap-5">

                    {/* Class pill selector */}
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-app-dark/50">Sélectionner une classe</p>
                      {classesData.length === 0 ? (
                        <p className="text-sm text-app-dark/40">Aucune classe créée.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {classesData.map((c) => {
                            const isSelected = selectedClassId === c.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setSelectedClassId(c.id)}
                                className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition"
                                style={
                                  isSelected
                                    ? { background: "#15173D", borderColor: "#15173D", color: "white" }
                                    : { background: "#F1E9E9", borderColor: "#E491C9", color: "#15173D" }
                                }
                              >
                                <span>{c.code}</span>
                                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={isSelected ? { background: "rgba(255,255,255,0.2)" } : { background: "#E491C9", color: "#15173D" }}>
                                  {c.brigade.code}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Two columns: Stagiaires | Instructeurs */}
                    <div className="grid gap-4 md:grid-cols-2">

                      {/* ── Stagiaires multi-select ── */}
                      {(() => {
                        const allStags = adminData.users.filter((u) => u.role === "Stagiaire");
                        const filteredStags = allStags.filter((u) => u.username.toLowerCase().includes(stagSearch.toLowerCase()));
                        const allChecked = filteredStags.length > 0 && filteredStags.every((u) => selectedStageaireIds.includes(u.id));
                        return (
                          <div className="flex flex-col rounded-xl border border-app-muted overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-app-muted" style={{ background: "#F1E9E9" }}>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-app-dark">Stagiaires</span>
                                <span className="rounded-full bg-app-accent px-2 py-0.5 text-[10px] font-bold text-white">{selectedStageaireIds.length}/{allStags.length}</span>
                              </div>
                              <button
                                type="button"
                                className="text-xs font-semibold text-app-accent"
                                onClick={() =>
                                  allChecked
                                    ? setSelectedStageaireIds((prev) => prev.filter((id) => !filteredStags.some((u) => u.id === id)))
                                    : setSelectedStageaireIds((prev) => [...new Set([...prev, ...filteredStags.map((u) => u.id)])])
                                }
                              >
                                {allChecked ? "Désélectionner tout" : "Tout sélectionner"}
                              </button>
                            </div>
                            {/* Search */}
                            <div className="flex items-center gap-2 border-b border-app-muted px-3 py-2 bg-white">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0 text-app-dark/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                              </svg>
                              <input
                                className="w-full bg-transparent text-xs outline-none placeholder:text-app-dark/30"
                                placeholder="Rechercher stagiaire…"
                                value={stagSearch}
                                onChange={(e) => setStagSearch(e.target.value)}
                              />
                              {stagSearch && <button type="button" className="text-app-dark/30 hover:text-app-dark text-xs" onClick={() => setStagSearch("")}>✕</button>}
                            </div>
                            {/* List */}
                            <div className="max-h-52 overflow-y-auto bg-white divide-y divide-app-muted/30">
                              {filteredStags.length === 0 && <p className="px-4 py-3 text-xs text-app-dark/40">Aucun stagiaire{stagSearch ? ` pour « ${stagSearch} »` : ""}.</p>}
                              {filteredStags.map((u) => {
                                const checked = selectedStageaireIds.includes(u.id);
                                return (
                                  <label key={u.id} className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition ${checked ? "bg-app-soft" : "hover:bg-app-soft/60"}`}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      className="h-4 w-4 rounded accent-app-accent"
                                      onChange={() => setSelectedStageaireIds((prev) => checked ? prev.filter((id) => id !== u.id) : [...prev, u.id])}
                                    />
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "#982598" }}>
                                      {u.username[0]?.toUpperCase()}
                                    </div>
                                    <span className="flex-1 text-xs font-medium text-app-dark">{u.username}</span>
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
                                      {u.is_active ? "Actif" : "Inactif"}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            {/* Footer */}
                            <div className="border-t border-app-muted px-4 py-3 bg-white">
                              <button
                                type="button"
                                className="w-full rounded-lg py-2 text-sm font-bold text-white transition disabled:opacity-40"
                                style={{ background: "#982598" }}
                                disabled={selectedStageaireIds.length === 0 || !selectedClassId}
                                onClick={() => void handleAssignStageaireToClass()}
                              >
                                Assigner {selectedStageaireIds.length > 0 ? `${selectedStageaireIds.length} stagiaire(s)` : "stagiaires"}
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── Instructeurs multi-select ── */}
                      {(() => {
                        const allInstrs = adminData.users.filter((u) => u.role === "Instructeur");
                        const filteredInstrs = allInstrs.filter((u) => u.username.toLowerCase().includes(instrSearch.toLowerCase()));
                        const allChecked = filteredInstrs.length > 0 && filteredInstrs.every((u) => selectedInstructeurIds.includes(u.id));
                        return (
                          <div className="flex flex-col rounded-xl border border-app-muted overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-app-muted" style={{ background: "#F1E9E9" }}>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-app-dark">Instructeurs</span>
                                <span className="rounded-full bg-app-accent px-2 py-0.5 text-[10px] font-bold text-white">{selectedInstructeurIds.length}/{allInstrs.length}</span>
                              </div>
                              <button
                                type="button"
                                className="text-xs font-semibold text-app-accent"
                                onClick={() =>
                                  allChecked
                                    ? setSelectedInstructeurIds((prev) => prev.filter((id) => !filteredInstrs.some((u) => u.id === id)))
                                    : setSelectedInstructeurIds((prev) => [...new Set([...prev, ...filteredInstrs.map((u) => u.id)])])
                                }
                              >
                                {allChecked ? "Désélectionner tout" : "Tout sélectionner"}
                              </button>
                            </div>
                            {/* Search */}
                            <div className="flex items-center gap-2 border-b border-app-muted px-3 py-2 bg-white">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0 text-app-dark/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                              </svg>
                              <input
                                className="w-full bg-transparent text-xs outline-none placeholder:text-app-dark/30"
                                placeholder="Rechercher instructeur…"
                                value={instrSearch}
                                onChange={(e) => setInstrSearch(e.target.value)}
                              />
                              {instrSearch && <button type="button" className="text-app-dark/30 hover:text-app-dark text-xs" onClick={() => setInstrSearch("")}>✕</button>}
                            </div>
                            {/* List */}
                            <div className="max-h-52 overflow-y-auto bg-white divide-y divide-app-muted/30">
                              {filteredInstrs.length === 0 && <p className="px-4 py-3 text-xs text-app-dark/40">Aucun instructeur{instrSearch ? ` pour « ${instrSearch} »` : ""}.</p>}
                              {filteredInstrs.map((u) => {
                                const checked = selectedInstructeurIds.includes(u.id);
                                return (
                                  <label key={u.id} className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition ${checked ? "bg-app-soft" : "hover:bg-app-soft/60"}`}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      className="h-4 w-4 rounded accent-app-accent"
                                      onChange={() => setSelectedInstructeurIds((prev) => checked ? prev.filter((id) => id !== u.id) : [...prev, u.id])}
                                    />
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "#982598" }}>
                                      {u.username[0]?.toUpperCase()}
                                    </div>
                                    <span className="flex-1 text-xs font-medium text-app-dark">{u.username}</span>
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
                                      {u.is_active ? "Actif" : "Inactif"}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            {/* Footer */}
                            <div className="border-t border-app-muted px-4 py-3 bg-white">
                              <button
                                type="button"
                                className="w-full rounded-lg py-2 text-sm font-bold text-white transition disabled:opacity-40"
                                style={{ background: "#982598" }}
                                disabled={selectedInstructeurIds.length === 0 || !selectedClassId}
                                onClick={() => void handleAssignInstructeurToClass()}
                              >
                                Assigner {selectedInstructeurIds.length > 0 ? `${selectedInstructeurIds.length} instructeur(s)` : "instructeurs"}
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* ── Liste des classes ── */}
                <div className="overflow-hidden rounded-2xl border border-app-muted bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-app-muted px-5 py-4" style={{ background: "#15173D" }}>
                    <span className="text-base font-bold text-white">Classes créées</span>
                    <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold text-white">{classesData.length}</span>
                  </div>
                  <div className="p-5 grid gap-4 md:grid-cols-2">
                    {classesData.length === 0 && <p className="col-span-2 py-6 text-center text-sm text-app-dark/40">Aucune classe créée.</p>}
                    {classesData.map((c) => (
                      <div
                        key={c.id}
                        className={`rounded-xl border-2 p-4 transition ${selectedClassId === c.id ? "border-app-accent bg-app-soft" : "border-app-muted bg-white"}`}
                      >
                        {/* Class header */}
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <button
                            type="button"
                            className="flex-1 text-left"
                            onClick={() => setSelectedClassId(c.id)}
                          >
                            <p className="text-sm font-bold text-app-dark">{c.code} — {c.label}</p>
                            <p className="text-xs text-app-dark/50">Brigade : {c.brigade.code}{c.brigade.label ? ` · ${c.brigade.label}` : ""}</p>
                          </button>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="rounded-full bg-app-soft border border-app-muted px-2 py-0.5 text-[10px] font-semibold text-app-dark/60">{c.stageaires.length} stag.</span>
                            <span className="rounded-full bg-app-soft border border-app-muted px-2 py-0.5 text-[10px] font-semibold text-app-dark/60">{c.instructeurs.length} instr.</span>
                            {/* Delete class button */}
                            <button
                              type="button"
                              title="Supprimer la classe"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-xs text-red-500 transition hover:bg-red-100 hover:text-red-700"
                              onClick={async () => {
                                if (!confirm(`Supprimer la classe « ${c.label} » ?`)) return;
                                await apiFetch(`/api/admin/classes/${c.id}/delete/`, { method: "DELETE" });
                                if (selectedClassId === c.id) setSelectedClassId("");
                                await loadClasses();
                              }}
                            >
                              🗑
                            </button>
                          </div>
                        </div>

                        {/* Members */}
                        <div className="space-y-2">
                          {/* Instructeurs */}
                          <div>
                            <p className="text-[10px] uppercase tracking-wide font-bold text-app-dark/40 mb-1">Instructeurs</p>
                            {c.instructeurs.length === 0 ? (
                              <p className="text-xs text-app-dark/30 italic">Aucun</p>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {c.instructeurs.map((i) => (
                                  <span key={i.id ?? i.username} className="flex items-center gap-1 rounded-full border border-app-muted bg-white pl-1 pr-1.5 py-0.5 text-[11px] font-medium text-app-dark">
                                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: "#982598" }}>{i.username[0]?.toUpperCase()}</span>
                                    {i.username}
                                    <button
                                      type="button"
                                      title="Retirer"
                                      className="ml-0.5 text-red-400 hover:text-red-600 leading-none"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await apiFetch(`/api/admin/classes/${c.id}/remove-instructeur/`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ instructeur_id: i.id }),
                                        });
                                        await loadClasses();
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Stagiaires */}
                          <div>
                            <p className="text-[10px] uppercase tracking-wide font-bold text-app-dark/40 mb-1">Stagiaires</p>
                            {c.stageaires.length === 0 ? (
                              <p className="text-xs text-app-dark/30 italic">Aucun</p>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {c.stageaires.slice(0, 8).map((s) => (
                                  <span key={s.id ?? s.username} className="flex items-center gap-1 rounded-full border border-app-muted bg-white pl-1 pr-1.5 py-0.5 text-[11px] font-medium text-app-dark">
                                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: "#15173D" }}>{s.username[0]?.toUpperCase()}</span>
                                    {s.username}
                                    <button
                                      type="button"
                                      title="Retirer"
                                      className="ml-0.5 text-red-400 hover:text-red-600 leading-none"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await apiFetch(`/api/admin/classes/${c.id}/remove-stageaire/`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ stageaire_id: s.id }),
                                        });
                                        await loadClasses();
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </span>
                                ))}
                                {c.stageaires.length > 8 && (
                                  <span className="rounded-full border border-app-muted bg-app-soft px-2 py-0.5 text-[11px] text-app-dark/50">+{c.stageaires.length - 8}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

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










