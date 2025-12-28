import { supabase } from "../supabaseClient";

export const YSA_SCHEMA = "ysa";
export const SEASON_ID = "60562a52-8666-4eb3-b68c-cf6e3b40dbfb";

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
