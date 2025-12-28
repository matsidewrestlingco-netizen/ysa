import { supabase } from "../supabaseClient";

export const YSA_SCHEMA = "ysa";
export const SEASON_ID = "60562a52-8666-4eb3-b68c-cf6e3b40dbfb";
export const ORG_ID = "01cb30ff-d1ba-4f9c-a149-553e5d9ac522";

import { supabase } from "../supabaseClient";

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

export async function approveAccessRequest(request: {
  id: string;
  user_id: string;
  email: string | null;
}, role: "admin" | "president" | "coach" | "uniform_manager" | "volunteer_coordinator" | "treasurer" | "staff") {
  // 1) Add/update member
  const upsert = await supabase
    .schema(YSA_SCHEMA)
    .from("org_members")
    .upsert({
      org_id: ORG_ID,
      user_id: request.user_id,
      role,
      email: request.email ?? null,
    }, { onConflict: "org_id,user_id" });

  if (upsert.error) throw upsert.error;

  // 2) Remove request
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

  const greenCount = roster.data.filter((r) => r.play_status === "green").length;
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
