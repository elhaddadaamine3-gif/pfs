import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
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
type Role = "Instructeur" | "Stageaire" | "Admin" | "Superviseur" | "Corrdinateur";

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
  controls: { available_count: number; submitted_count: number; pending_count: number };
  controls_list: Array<{ id: string; name: string; deadline: string | null; cours: string }>;
  submitted_control_ids: string[];
  notes: Array<{ controle: string; note: string; published_at: string | null }>;
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
type ReferenceSpeciality = { id: string; code: string; label: string };
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
const ROLE_OPTIONS: Role[] = ["Instructeur", "Stageaire", "Superviseur", "Corrdinateur"];

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
  const [role, setRole] = useState<Role>("Stageaire");
  const [matricule, setMatricule] = useState("");
  const [estCivil, setEstCivil] = useState(false);
  const [corpsId, setCorpsId] = useState("");
  const [rankId, setRankId] = useState("");
  const [specialityId, setSpecialityId] = useState("");
  const [busy, setBusy] = useState(false);
  const requiresMilitaryProfile = !(role === "Instructeur" && estCivil);
  const matriculeRequired = requiresMilitaryProfile;
  const ranksForCorps = references.ranks.filter((rank) => rank.corps_id === corpsId);

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
                  {references.specialities.map((speciality) => (
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
}: {
  user: MeResponse | null;
  onLoadProfile: () => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [instructeurData, setInstructeurData] = useState<InstructeurDashboardData | null>(null);
  const [stageaireData, setStageaireData] = useState<StageaireDashboardData | null>(null);
  const [superviseurData, setSuperviseurData] = useState<SuperviseurDashboardData | null>(null);
  const [coordinateurData, setCoordinateurData] = useState<CoordinateurDashboardData | null>(null);
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [controlCoursId, setControlCoursId] = useState("");
  const [controlName, setControlName] = useState("");
  const [controlPrompt, setControlPrompt] = useState("");
  const [submissionAnswers, setSubmissionAnswers] = useState<Record<string, string>>({});
  const [evalNote, setEvalNote] = useState<Record<string, string>>({});
  const [evalCorrection, setEvalCorrection] = useState<Record<string, string>>({});
  const [correctionText, setCorrectionText] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);
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
    role: "Stageaire",
    matricule: "",
    est_civil: false,
    corps_id: "",
    rank_id: "",
    speciality_id: "",
  });
  const [csvFileName, setCsvFileName] = useState("");
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
  const [newSpeciality, setNewSpeciality] = useState({ code: "", label: "" });
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

  if (!user) return <Navigate to="/login" replace />;

  useEffect(() => {
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
    if (user.role === "Stageaire") document.title = `${t("titles.traineeDashboard")} - ${t("titles.appName")}`;
    if (user.role === "Superviseur") document.title = `${t("titles.supervisorDashboard")} - ${t("titles.appName")}`;
    if (user.role === "Corrdinateur") document.title = `${t("titles.coordinatorDashboard")} - ${t("titles.appName")}`;
  }, [user.role, adminView, selectedAdminUser, subjectTab, referenceTab, t]);

  const loadDashboard = async () => {
    setLoading(true);
    setDashboardError(null);
    if (user.role !== "Admin") {
      setSelectedAdminUser(null);
      setAdminView("overview");
    }
    try {
      if (user.role === "Instructeur") {
        const response = await apiFetch("/api/dashboard/instructeur/");
        if (!response.ok) throw new Error("failed");
        const data: InstructeurDashboardData = await response.json();
        setInstructeurData(data);
      } else if (user.role === "Stageaire") {
        const response = await apiFetch("/api/dashboard/stageaire/");
        if (!response.ok) throw new Error("failed");
        const data: StageaireDashboardData = await response.json();
        setStageaireData(data);
      } else if (user.role === "Superviseur") {
        const response = await apiFetch("/api/dashboard/superviseur/");
        if (!response.ok) throw new Error("failed");
        const data: SuperviseurDashboardData = await response.json();
        setSuperviseurData(data);
      } else if (user.role === "Corrdinateur") {
        const response = await apiFetch("/api/dashboard/coordinateur/");
        if (!response.ok) throw new Error("failed");
        const data: CoordinateurDashboardData = await response.json();
        setCoordinateurData(data);
      } else if (user.role === "Admin") {
        const response = await apiFetch("/api/dashboard/admin/");
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
    void loadDashboard();
  }, [user.role]);

  const handleCreateCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await apiFetch("/api/instructeur/cours/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titre: courseTitle, description: courseDescription, publier: true }),
    });
    if (response.ok) {
      setCourseTitle("");
      setCourseDescription("");
      setActionMessage("Cours cree.");
      await loadDashboard();
    }
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
    if (response.ok) {
      setControlName("");
      setControlPrompt("");
      setActionMessage("Controle publie.");
      await loadDashboard();
    }
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
      setActionMessage("Note publiee.");
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
      setActionMessage("Correction publiee.");
      await loadDashboard();
    }
  };

  const handleSubmitAnswer = async (controlId: string) => {
    const commentaire = submissionAnswers[controlId] ?? "";
    const response = await apiFetch(`/api/stageaire/controls/${controlId}/submit/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentaire }),
    });
    if (response.ok) {
      setActionMessage("Reponse envoyee.");
      await loadDashboard();
    }
  };

  const handleToggleUserStatus = async (targetUserId: number) => {
    const response = await apiFetch(`/api/admin/users/${targetUserId}/toggle-active/`, {
      method: "POST",
    });
    if (response.ok) {
      setActionMessage("Statut utilisateur mis a jour.");
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
      setNewSubjectLabel("");
      setActionMessage("Sujet cree.");
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
      setActionMessage("Classe creee.");
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
      setActionMessage("Stageaire assigne a la classe.");
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
      setActionMessage("Instructeur assigne a la classe.");
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
      setActionMessage("Statut du controle mis a jour.");
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
      setActionMessage("Statut du cours mis a jour.");
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
      setActionMessage("Compte cree.");
      setAccountForm({
        username: "",
        email: "",
        password: "",
        role: "Stageaire",
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
      setNewCorps({ code: "", label: "" });
      setActionMessage("Corp cree.");
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
      setNewRank((prev) => ({ ...prev, code: "", label: "" }));
      setActionMessage("Rank cree.");
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
      setNewSpeciality({ code: "", label: "" });
      setActionMessage("Speciality creee.");
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
      setActionMessage("Reference mise a jour.");
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
      setActionMessage(`Import termine: ${result.created_count} comptes crees.`);
      await loadDashboard();
    } else {
      setActionMessage(`Import partiel/erreur: ${result.error_count ?? 0} erreurs.`);
    }
  };

  useEffect(() => {
    if (user.role === "Admin") {
      void loadSubjects();
      void loadClasses();
      void loadAdminReferences();
    }
  }, [user.role]);

  useEffect(() => {
    if (user.role === "Admin" && adminView === "events") {
      void loadAdminEvents();
    }
  }, [user.role, adminView]);

  useEffect(() => {
    if (user.role === "Admin" && adminView === "subjects" && subjectTab === "controls") {
      void loadSubjectControls(selectedSubjectId);
    }
  }, [user.role, adminView, subjectTab, selectedSubjectId]);

  useEffect(() => {
    if (user.role === "Admin" && adminView === "subjects" && subjectTab === "courses") {
      void loadSubjectCourses(selectedSubjectId);
    }
  }, [user.role, adminView, subjectTab, selectedSubjectId]);

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
          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Affectations et activite</h3>
            <p className="mt-2 text-sm">Classes affectees: {instructeurData.classes_count}</p>
            <p className="text-sm">Cours: {instructeurData.cours.total} (publies: {instructeurData.cours.published})</p>
            <p className="text-sm">Controles a corriger: {instructeurData.controles.pending_corrections}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {instructeurData.classes.map((c) => (
                <span className="rounded bg-app-soft px-2 py-1 text-xs" key={c.code}>
                  {c.code} / {c.brigade}
                </span>
              ))}
              {instructeurData.classes.length === 0 ? <EmptyState message="Aucune classe assignee." /> : null}
            </div>
          </article>

          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Creer un cours</h3>
            <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={handleCreateCourse}>
              <Input label="Titre" value={courseTitle} onChange={setCourseTitle} />
              <Input label="Description" value={courseDescription} onChange={setCourseDescription} />
              <button className="rounded bg-app-dark px-3 py-2 text-sm font-semibold text-white md:col-span-2" type="submit">
                Creer et publier le cours
              </button>
            </form>
          </article>

          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Creer un controle</h3>
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
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                {instructeurData.cours_list.length === 0 ? <EmptyState message="Aucun cours disponible. Creez un cours avant un controle." /> : null}
              </label>
              <Input label="Nom du controle" value={controlName} onChange={setControlName} />
              <Input label="Enonce du controle" value={controlPrompt} onChange={setControlPrompt} />
              <button className="rounded bg-app-dark px-3 py-2 text-sm font-semibold text-white md:col-span-2" type="submit">
                Publier controle
              </button>
            </form>
          </article>

          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Corriger et publier les notes</h3>
            <div className="mt-3 space-y-3">
              {instructeurData.pending_submissions.length === 0 ? <p className="text-sm">Aucune soumission en attente.</p> : null}
              {instructeurData.pending_submissions.map((s) => (
                <div className="rounded border border-app-muted p-3" key={s.soumission_id}>
                  <p className="text-sm font-semibold">{s.controle_name}</p>
                  <p className="text-xs text-app-dark/70">Soumission: {s.soumission_id}</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <Input label="Note /20" value={evalNote[s.soumission_id] ?? ""} onChange={(v) => setEvalNote((prev) => ({ ...prev, [s.soumission_id]: v }))} />
                    <Input label="Correction" value={evalCorrection[s.soumission_id] ?? ""} onChange={(v) => setEvalCorrection((prev) => ({ ...prev, [s.soumission_id]: v }))} />
                  </div>
                  <button className="mt-2 rounded bg-app-dark px-3 py-1.5 text-xs text-white" type="button" onClick={() => void handleEvaluate(s.soumission_id)}>
                    Publier note
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Publier la correction versionnee</h3>
            <div className="mt-3 space-y-3">
              {instructeurData.controles_list.map((c) => (
                <div className="rounded border border-app-muted p-3" key={c.id}>
                  <p className="text-sm font-semibold">{c.name}</p>
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
              {instructeurData.controles_list.length === 0 ? <EmptyState message="Aucun controle disponible." /> : null}
            </div>
          </article>

          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Sujets fin de stage et notifications</h3>
            <p className="mt-2 text-sm">Sujets actifs: {instructeurData.sujets_fin_stage.active}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {instructeurData.sujets_fin_stage.list.map((s, index) => (
                <span className="rounded bg-app-soft px-2 py-1 text-xs" key={`${s.sujet}-${index}`}>
                  {s.sujet} ({s.etat})
                </span>
              ))}
              {instructeurData.sujets_fin_stage.list.length === 0 ? <EmptyState message="Aucun sujet de fin de stage." /> : null}
            </div>
            <p className="mt-4 text-sm">Notifications non lues: {instructeurData.notifications.unread_count}</p>
          </article>
        </section>
      ) : null}

      {user.role === "Stageaire" && stageaireData ? (
        <section className="mt-6 grid gap-5">
          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Classe / Brigade</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {stageaireData.classes.map((entry) => (
                <span className="rounded bg-app-soft px-2 py-1 text-xs" key={entry.classe_code}>
                  {entry.classe_code} ({entry.brigade_code})
                </span>
              ))}
              {stageaireData.classes.length === 0 ? <EmptyState message="Aucune classe ou brigade assignee." /> : null}
            </div>
          </article>

          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Controles a realiser</h3>
            <p className="mt-2 text-sm">Disponibles: {stageaireData.controls.available_count} / En attente: {stageaireData.controls.pending_count}</p>
            <div className="mt-3 space-y-3">
              {stageaireData.controls_list.map((control) => {
                const submitted = stageaireData.submitted_control_ids.includes(control.id);
                return (
                  <div className="rounded border border-app-muted p-3" key={control.id}>
                    <p className="text-sm font-semibold">{control.name}</p>
                    <p className="text-xs text-app-dark/70">{control.cours}</p>
                    {submitted ? (
                      <p className="mt-1 text-xs text-emerald-700">Reponse deja soumise.</p>
                    ) : (
                      <>
                        <Input
                          label="Votre reponse"
                          value={submissionAnswers[control.id] ?? ""}
                          onChange={(v) => setSubmissionAnswers((prev) => ({ ...prev, [control.id]: v }))}
                        />
                        <button className="mt-2 rounded bg-app-dark px-3 py-1.5 text-xs text-white" type="button" onClick={() => void handleSubmitAnswer(control.id)}>
                          Envoyer la reponse
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              {stageaireData.controls_list.length === 0 ? <EmptyState message="Aucun controle disponible pour le moment." /> : null}
            </div>
          </article>

          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Notes publiees</h3>
            <div className="mt-3 space-y-2">
              {stageaireData.notes.length === 0 ? <p className="text-sm">Aucune note publiee.</p> : null}
              {stageaireData.notes.map((note, index) => (
                <p className="text-sm" key={`${note.controle}-${index}`}>
                  {note.controle}: <span className="font-semibold">{note.note}</span>
                </p>
              ))}
            </div>
          </article>

          <article className="card-hover rounded-2xl border border-app-muted bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Notifications</h3>
            <p className="mt-2 text-sm">Non lues: {stageaireData.notifications.unread_count}</p>
            <div className="mt-3 space-y-2">
              {stageaireData.notifications.latest.map((n) => (
                <p className="text-sm" key={n.id}>
                  [{n.type}] {n.title}
                </p>
              ))}
              {stageaireData.notifications.latest.length === 0 ? <EmptyState message="Aucune notification." /> : null}
            </div>
          </article>
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
        </section>
      ) : null}

      {user.role === "Corrdinateur" && coordinateurData ? (
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
                        {["Instructeur", "Stageaire", "Superviseur", "Corrdinateur", "Admin"].map((roleName) => (
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
                              setAccountForm((prev) => ({ ...prev, corps_id: event.target.value, rank_id: "" }))
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
                            {referencesData.specialities.map((speciality) => (
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
              <div className="grid gap-6">
                <PanelSection title="Corps, ranks et specialities">
                  <p className="text-sm text-app-dark/70">
                    Ces tables sont bootstrapees et servent de references pour tous les profils militaires.
                  </p>
                </PanelSection>

                <div className="flex flex-wrap items-center gap-2">
                  <TabButton active={referenceTab === "corps"} onClick={() => setReferenceTab("corps")}>Corps</TabButton>
                  <TabButton active={referenceTab === "ranks"} onClick={() => setReferenceTab("ranks")}>Ranks</TabButton>
                  <TabButton active={referenceTab === "specialities"} onClick={() => setReferenceTab("specialities")}>Specialities</TabButton>
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
                      <Input
                        label="Code"
                        value={newSpeciality.code}
                        onChange={(value) => setNewSpeciality((prev) => ({ ...prev, code: value }))}
                      />
                      <Input
                        label="Libelle"
                        value={newSpeciality.label}
                        onChange={(value) => setNewSpeciality((prev) => ({ ...prev, label: value }))}
                      />
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
                        </button>
                      ))}
                      {referencesData.specialities.length === 0 ? <EmptyState message="Aucune speciality." /> : null}
                    </div>
                  </SubCard>
                ) : null}
              </div>
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
                      Assigner Stageaire
                      <select
                        className="rounded border border-app-muted bg-white px-3 py-2"
                        value={selectedStageaireId}
                        onChange={(event) => setSelectedStageaireId(event.target.value)}
                      >
                        <option value="">Selectionner</option>
                        {adminData.users
                          .filter((u) => u.role === "Stageaire")
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
                          Stageaires: {c.stageaires.map((s) => s.username).join(", ") || "-"}
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
  if (!user) return <Navigate to="/login" replace />;
  const [settingsView, setSettingsView] = useState<"language" | "session">("language");
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
          <Route path="/dashboard" element={<DashboardPage onLoadProfile={loadProfile} user={user} apiFetch={apiFetch} />} />
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










