import { supabase } from "../supabaseClient";

export const YSA_SCHEMA = "ysa";
export const SEASON_ID = "60562a52-8666-4eb3-b68c-cf6e3b40dbfb";
export const ORG_ID = "01cb30ff-d1ba-4f9c-a149-553e5d9ac522";

// ---------- Types (lightweight, keeps you sane) ----------
export type Role =
  | "staff"
  | "coach"
  | "uniform_manager"
  | "volunteer_coordinator"
  | "treasurer"
  | "admin"
  | "president";

export type RequirementStatus = "missing" | "pending" | "complete";

export type RequirementRow = {
  id: string;
  org_id: string;
  season_id: string;
  category: string;
  name: string;
  requirement_type: string;
  due_date: string | null;
  critical: boolean;
};

export type AthleteRequirementStatusRow = {
  org_id: string;
  season_id: string;
  athlete_id: string;
  requirement_id: string;
  status: RequirementStatus;
  value_number: number | null;
  value_date: string | null;
  value_text: string | null;
  evidence_file_url: string | null;
  completed_by_user_id: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AthleteChecklistItem = {
  requirement_id: string;
  category: string;
  name: string;
  requirement_type: string;
  due_date: string | null;
  critical: boolean;

  status: RequirementStatus;
  value_number: number | null;
  value_date: string | null;
  value_text: string | null;
  evidence_file_url: string | null;
  notes: string | null;
  updated_at: string | null;
  completed_at: string | null;
};

// ---------- Membership / Admin ----------
export async function getMyMembership() {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return null;

  const res = await supabase
    .schema(YSA_SCHEMA)
    .from("org_members")
    .select("org_id,user_id,role,email,created_at")
    .eq("org_id", ORG_ID)
    .eq("user_id", userId)
    .maybeSingle();

  if (res.error) throw res.error;
  return res.data; // null if not a member
}

export async function requestBoardAccess() {
  const { data: session } = await supabase.auth.getSession();
  const user = session.session?.user;
  if (!user) throw new Error("Not logged in.");

  const res = await supabase
    .schema(YSA_SCHEMA)
    .from("access_requests")
    .insert({
      org_id: ORG_ID,
      user_id: user.id,
      email: user.email ?? null,
    });

  if (res.error) throw res.error;
  return true;
}

export async function loadBoardMembers() {
  const res = await supabase
    .schema(YSA_SCHEMA)
    .from("org_members")
    .select("user_id,email,role,created_at")
    .eq("org_id", ORG_ID)
    .order("role", { ascending: true })
    .order("email", { ascending: true });

  if (res.error) throw res.error;
  return res.data;
}

export async function loadAccessRequests() {
  const res = await supabase
    .schema(YSA_SCHEMA)
    .from("access_requests")
    .select("id,user_id,email,created_at")
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false });

  if (res.error) throw res.error;
  return res.data;
}

export async function approveAccessRequest(
  request: { id: string; user_id: string; email: string | null },
  role: Role
) {
  const upsert = await supabase
    .schema(YSA_SCHEMA)
    .from("org_members")
    .upsert(
      {
        org_id: ORG_ID,
        user_id: request.user_id,
        role,
        email: request.email ?? null,
      },
      { onConflict: "org_id,user_id" }
    );

  if (upsert.error) throw upsert.error;

  const del = await supabase
    .schema(YSA_SCHEMA)
    .from("access_requests")
    .delete()
    .eq("id", request.id);

  if (del.error) throw del.error;

  return true;
}

export async function denyAccessRequest(requestId: string) {
  const del = await supabase
    .schema(YSA_SCHEMA)
    .from("access_requests")
    .delete()
    .eq("id", requestId);

  if (del.error) throw del.error;
  return true;
}

export async function updateMemberRole(userId: string, role: string) {
  const res = await supabase
    .schema(YSA_SCHEMA)
    .from("org_members")
    .update({ role })
    .eq("org_id", ORG_ID)
    .eq("user_id", userId);

  if (res.error) throw res.error;
  return true;
}

export async function removeMember(userId: string) {
  const res = await supabase
    .schema(YSA_SCHEMA)
    .from("org_members")
    .delete()
    .eq("org_id", ORG_ID)
    .eq("user_id", userId);

  if (res.error) throw res.error;
  return true;
}

// ---------- Dashboard ----------
export async function loadDashboard() {
  const roster = await supabase
    .schema(YSA_SCHEMA)
    .from("v_athlete_status")
    .select(
      "athlete_id,last_name,first_name,grade,team_level,active,critical_total,critical_complete,critical_incomplete,play_status"
    )
    .eq("season_id", SEASON_ID)
    .eq("active", true)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  const redFlags = await supabase
    .schema(YSA_SCHEMA)
    .from("v_red_flags")
    .select("requirement_id,requirement_name,due_date,athletes_not_complete")
    .eq("season_id", SEASON_ID)
    .order("athletes_not_complete", { ascending: false })
    .order("requirement_name", { ascending: true });

  if (roster.error) throw roster.error;
  if (redFlags.error) throw redFlags.error;

  const greenCount = roster.data.filter((r: any) => r.play_status === "green").length;
  const notGreenCount = roster.data.length - greenCount;

  return {
    roster: roster.data,
    redFlags: redFlags.data,
    totals: {
      athletes: roster.data.length,
      green: greenCount,
      notGreen: notGreenCount,
    },
  };
}

// ---------- Athlete checklist (Requirements + Status merge) ----------

export async function loadSeasonRequirements(): Promise<RequirementRow[]> {
  const res = await supabase
    .schema(YSA_SCHEMA)
    .from("requirements")
    .select("id,org_id,season_id,category,name,requirement_type,due_date,critical")
    .eq("org_id", ORG_ID)
    .eq("season_id", SEASON_ID)
    .order("critical", { ascending: false })
    .order("due_date", { ascending: true })
    .order("name", { ascending: true });

  if (res.error) throw res.error;
  return (res.data ?? []) as RequirementRow[];
}

export async function loadAthleteRequirementStatuses(
  athleteId: string
): Promise<AthleteRequirementStatusRow[]> {
  const res = await supabase
    .schema(YSA_SCHEMA)
    .from("athlete_requirement_status")
    .select(
      "org_id,season_id,athlete_id,requirement_id,status,value_number,value_date,value_text,evidence_file_url,completed_by_user_id,completed_at,notes,created_at,updated_at"
    )
    .eq("org_id", ORG_ID)
    .eq("season_id", SEASON_ID)
    .eq("athlete_id", athleteId);

  if (res.error) throw res.error;
  return (res.data ?? []) as AthleteRequirementStatusRow[];
}

export async function loadAthleteChecklist(athleteId: string): Promise<AthleteChecklistItem[]> {
  const [reqs, statuses] = await Promise.all([
    loadSeasonRequirements(),
    loadAthleteRequirementStatuses(athleteId),
  ]);

  const byReqId = new Map<string, AthleteRequirementStatusRow>();
  for (const s of statuses) byReqId.set(s.requirement_id, s);

  return reqs.map((r) => {
    const s = byReqId.get(r.id);
    return {
      requirement_id: r.id,
      category: r.category,
      name: r.name,
      requirement_type: r.requirement_type,
      due_date: r.due_date,
      critical: r.critical,

      status: (s?.status ?? "missing") as RequirementStatus,
      value_number: s?.value_number ?? null,
      value_date: s?.value_date ?? null,
      value_text: s?.value_text ?? null,
      evidence_file_url: s?.evidence_file_url ?? null,
      notes: s?.notes ?? null,
      updated_at: s?.updated_at ?? null,
      completed_at: s?.completed_at ?? null,
    };
  });
}

/**
 * Upserts a single requirement status for an athlete.
 * IMPORTANT: This assumes you added the unique constraint:
 * unique(season_id, athlete_id, requirement_id)
 */
export async function upsertAthleteRequirementStatus(params: {
  athleteId: string;
  requirementId: string;
  status: RequirementStatus;
  notes?: string;
  value_number?: number | null;
  value_date?: string | null;
  value_text?: string | null;
  evidence_file_url?: string | null;
}) {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id ?? null;

  const nowIso = new Date().toISOString();
  const completedAt = params.status === "complete" ? nowIso : null;
  const completedBy = params.status === "complete" ? userId : null;

  const res = await supabase
    .schema(YSA_SCHEMA)
    .from("athlete_requirement_status")
    .upsert(
      {
        org_id: ORG_ID,
        season_id: SEASON_ID,
        athlete_id: params.athleteId,
        requirement_id: params.requirementId,
        status: params.status,

        // Optional “value” fields (only set if you pass them)
        value_number: params.value_number ?? null,
        value_date: params.value_date ?? null,
        value_text: params.value_text ?? null,
        evidence_file_url: params.evidence_file_url ?? null,

        notes: params.notes ?? null,

        completed_by_user_id: completedBy,
        completed_at: completedAt,
        updated_at: nowIso,
      },
      { onConflict: "season_id,athlete_id,requirement_id" }
    );

  if (res.error) throw res.error;
  return true;
}
