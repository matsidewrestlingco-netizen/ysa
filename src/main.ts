import { supabase } from "./lib/supabaseClient";
import {
  loadDashboard,
  getMyMembership,
  requestBoardAccess,
  loadBoardMembers,
  loadAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  updateMemberRole,
  removeMember,
  loadAthleteChecklist,
  upsertAthleteRequirementStatus,
} from "./lib/ysa/queries";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error('Missing <div id="app"></div> in index.html');

function escapeHtml(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function layout(title: string, bodyHtml: string) {
  app.innerHTML = `
    <div style="max-width:1100px; margin:0 auto; padding:16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
      <h1 style="margin:0 0 12px 0;">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </div>
  `;
}

function renderError(title: string, err: any) {
  const msg = err?.message || String(err);
  layout(title, `<pre style="color:#b00; white-space:pre-wrap;">${escapeHtml(msg)}</pre>`);
}

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  if (!isNaN(dt.getTime())) return dt.toLocaleString();
  return d;
}

function badge(text: string, bg: string) {
  return `<span style="display:inline-block; padding:2px 8px; border-radius:999px; background:${bg}; font-size:12px;">${escapeHtml(
    text
  )}</span>`;
}

async function renderLogin(message = "") {
  layout(
    "YSA Board Login",
    `
      ${message ? `<p style="color:#b00;">${escapeHtml(message)}</p>` : ""}
      <div style="max-width:360px; display:grid; gap:8px;">
        <label>Email</label>
        <input id="email" type="email" autocomplete="email" />

        <label>Password</label>
        <input id="password" type="password" autocomplete="current-password" />

        <button id="loginBtn" style="padding:10px; border-radius:8px; border:1px solid #ddd; cursor:pointer;">Log in</button>
      </div>
    `
  );

  document.querySelector<HTMLButtonElement>("#loginBtn")!.onclick = async () => {
    const email = (document.querySelector<HTMLInputElement>("#email")!).value.trim();
    const password = (document.querySelector<HTMLInputElement>("#password")!).value;

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await renderApp();
    } catch (e: any) {
      await renderLogin(e?.message || "Login failed.");
    }
  };
}

async function renderRequestAccess() {
  const { data } = await supabase.auth.getSession();
  const userEmail = data.session?.user?.email ?? "(unknown)";

  layout(
    "Access Required",
    `
      <p>You’re logged in as <strong>${escapeHtml(userEmail)}</strong>, but you’re not approved as a board user yet.</p>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button id="reqBtn" style="padding:10px; border-radius:8px; border:1px solid #ddd; cursor:pointer;">Request Board Access</button>
        <button id="logoutBtn" style="padding:10px; border-radius:8px; border:1px solid #ddd; cursor:pointer;">Log out</button>
      </div>
      <div id="status" style="margin-top:10px;"></div>
    `
  );

  document.querySelector<HTMLButtonElement>("#logoutBtn")!.onclick = async () => {
    await supabase.auth.signOut();
    await renderLogin("");
  };

  document.querySelector<HTMLButtonElement>("#reqBtn")!.onclick = async () => {
    const status = document.querySelector<HTMLDivElement>("#status")!;
    status.textContent = "Submitting request…";

    try {
      await requestBoardAccess();
      status.innerHTML = `<p style="color:#060;">Request submitted. An admin can approve you from the Admin page.</p>`;
    } catch (e: any) {
      status.innerHTML = `<p style="color:#b00;">${escapeHtml(e?.message || e)}</p>`;
    }
  };
}

function navHtml(isAdmin: boolean, userEmail: string) {
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <strong>YSA</strong>
        <a href="#dashboard">Dashboard</a>
        ${isAdmin ? `<a href="#admin">Admin</a>` : ""}
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="color:#555; font-size:14px;">${escapeHtml(userEmail)}</span>
        <button id="logoutBtn" style="padding:8px 10px; border-radius:8px; border:1px solid #ddd; cursor:pointer;">Log out</button>
      </div>
    </div>
    <hr style="margin:12px 0;" />
  `;
}

async function renderDashboardView() {
  const { roster, redFlags, totals } = await loadDashboard();

  return `
    <section style="display:flex; gap:12px; margin: 12px 0; flex-wrap:wrap;">
      ${[
        ["Athletes", totals.athletes],
        ["Green", totals.green],
        ["Not Green", totals.notGreen],
      ]
        .map(
          ([label, value]) => `
          <div style="padding:12px; border:1px solid #ddd; border-radius:10px; min-width:160px;">
            <div style="color:#555;">${escapeHtml(label)}</div>
            <div style="font-size:26px; font-weight:700;">${escapeHtml(value)}</div>
          </div>
        `
        )
        .join("")}
    </section>

    <h2 style="margin:18px 0 8px;">Red Flags</h2>
    <ul>
      ${redFlags
        .map(
          (r: any) => `
        <li><strong>${escapeHtml(r.requirement_name)}</strong> — ${escapeHtml(r.athletes_not_complete)} not complete</li>
      `
        )
        .join("")}
    </ul>

    <h2 style="margin:18px 0 8px;">Roster</h2>
    <p style="color:#555; margin-top:0;">Click an athlete to open their checklist.</p>
    <table style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Name</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Grade</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Level</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${roster
          .map(
            (a: any) => `
          <tr data-athlete="${escapeHtml(a.athlete_id)}" style="cursor:pointer;">
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">
              <a href="#athlete/${escapeHtml(a.athlete_id)}">${escapeHtml(a.last_name)}, ${escapeHtml(
              a.first_name
            )}</a>
            </td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(a.grade)}</td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(a.team_level)}</td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(a.play_status)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

const ROLE_OPTIONS = [
  "staff",
  "coach",
  "uniform_manager",
  "volunteer_coordinator",
  "treasurer",
  "admin",
  "president",
] as const;

async function renderAdminView() {
  const [members, requests] = await Promise.all([loadBoardMembers(), loadAccessRequests()]);

  const membersTable = `
    <h2 style="margin:18px 0 8px;">Board Members</h2>
    <table style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Email</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Role</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${members
          .map((m: any) => {
            const selectId = `role-${m.user_id}`;
            return `
              <tr>
                <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(m.email)}</td>
                <td style="border-bottom:1px solid #f0f0f0; padding:8px;">
                  <select id="${escapeHtml(selectId)}">
                    ${ROLE_OPTIONS.map(
                      (r) => `<option value="${r}" ${m.role === r ? "selected" : ""}>${r}</option>`
                    ).join("")}
                  </select>
                </td>
                <td style="border-bottom:1px solid #f0f0f0; padding:8px;">
                  <button data-save-role="${escapeHtml(m.user_id)}" style="padding:6px 10px; border-radius:8px; border:1px solid #ddd; cursor:pointer;">Save</button>
                  <button data-remove-member="${escapeHtml(m.user_id)}" style="padding:6px 10px; border-radius:8px; border:1px solid #ddd; cursor:pointer; margin-left:6px;">Remove</button>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  const requestsTable = `
    <h2 style="margin:18px 0 8px;">Access Requests</h2>
    ${
      requests.length === 0
        ? `<p style="color:#555;">No pending requests.</p>`
        : `
    <table style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Email</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Requested</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Action</th>
        </tr>
      </thead>
      <tbody>
        ${requests
          .map((r: any) => {
            const selKey = `reqrole-${r.id}`;
            return `
              <tr>
                <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(r.email)}</td>
                <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(r.created_at)}</td>
                <td style="border-bottom:1px solid #f0f0f0; padding:8px;">
                  <select data-req-role="${escapeHtml(selKey)}">
                    ${ROLE_OPTIONS.map((role) => `<option value="${role}">${role}</option>`).join("")}
                  </select>
                  <button data-approve="${escapeHtml(r.id)}" style="margin-left:8px; padding:6px 10px; border-radius:8px; border:1px solid #ddd; cursor:pointer;">Approve</button>
                  <button data-deny="${escapeHtml(r.id)}" style="margin-left:6px; padding:6px 10px; border-radius:8px; border:1px solid #ddd; cursor:pointer;">Deny</button>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
    `
    }
  `;

  return membersTable + requestsTable;
}

async function renderAthleteView(athleteId: string) {
  // Load saved filters (per athlete)
  const filterKey = `ysa_filters_${athleteId}`;
  let saved: any = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(filterKey) || "{}");
  } catch {
    saved = {};
  }

  const savedStatus = saved.status ?? "all";
  const savedCriticalOnly = !!saved.criticalOnly;
  const savedSearch = saved.search ?? "";

  // Use roster for name/grade/level (simple and fast)
  const dash = await loadDashboard();
  const athlete = dash.roster.find((a: any) => a.athlete_id === athleteId);

  const checklist = await loadAthleteChecklist(athleteId);

  const criticalTotal = checklist.filter((x) => x.critical).length;
  const criticalComplete = checklist.filter((x) => x.critical && x.status === "complete").length;

  const statusCounts = {
    complete: checklist.filter((x) => x.status === "complete").length,
    pending: checklist.filter((x) => x.status === "pending").length,
    missing: checklist.filter((x) => x.status === "missing").length,
  };

  const header = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
      <div>
        <div style="font-size:18px; font-weight:700;">
          ${
            athlete
              ? `${escapeHtml(athlete.last_name)}, ${escapeHtml(athlete.first_name)}`
              : `Athlete ${escapeHtml(athleteId)}`
          }
        </div>
        <div style="color:#555; margin-top:2px;">
          ${athlete ? `Grade ${escapeHtml(athlete.grade)} • ${escapeHtml(athlete.team_level)}` : ""}
        </div>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <div style="padding:10px; border:1px solid #ddd; border-radius:10px;">
          <div style="color:#555; font-size:12px;">Critical</div>
          <div style="font-weight:700;">${criticalComplete}/${criticalTotal} complete</div>
        </div>
        <div style="padding:10px; border:1px solid #ddd; border-radius:10px;">
          <div style="color:#555; font-size:12px;">Totals</div>
          <div style="font-weight:700;">
            ${statusCounts.complete} complete • ${statusCounts.pending} pending • ${statusCounts.missing} missing
          </div>
        </div>
      </div>
    </div>

    <div style="margin-top:10px;">
      <a href="#dashboard">← Back to Dashboard</a>
    </div>

    <hr style="margin:12px 0;" />

    <!-- Filters -->
    <div id="athleteFilters" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin:12px 0;">
      <label style="display:flex; flex-direction:column; gap:4px; font-size:12px; color:#555;">
        Status
        <select id="filterStatus" style="padding:8px; min-width:180px;">
          <option value="all" ${savedStatus === "all" ? "selected" : ""}>All</option>
          <option value="missing" ${savedStatus === "missing" ? "selected" : ""}>Missing</option>
          <option value="pending" ${savedStatus === "pending" ? "selected" : ""}>Pending</option>
          <option value="complete" ${savedStatus === "complete" ? "selected" : ""}>Complete</option>
        </select>
      </label>

      <label style="display:flex; align-items:center; gap:8px; margin-top:18px;">
        <input id="filterCriticalOnly" type="checkbox" ${savedCriticalOnly ? "checked" : ""} />
        <span style="font-size:14px;">Critical only</span>
      </label>

      <label style="display:flex; flex-direction:column; gap:4px; font-size:12px; color:#555; flex:1; min-width:260px;">
        Search
        <input id="filterSearch" type="text" value="${escapeHtml(
          savedSearch
        )}" placeholder="Search requirement or category…" style="padding:8px; width:100%;" />
      </label>

      <button id="clearFilters" style="margin-top:18px; padding:8px 10px; border-radius:8px; border:1px solid #ddd; cursor:pointer;">
        Clear
      </button>
    </div>

    <div id="athleteSaveStatus" style="margin-bottom:10px;"></div>
  `;

  const rows = checklist
    .map((it) => {
      const rowId = `row-${it.requirement_id}`;
      const statusId = `status-${it.requirement_id}`;
      const notesId = `notes-${it.requirement_id}`;

      const statusChip =
        it.status === "complete"
          ? badge("complete", "#d1fae5")
          : it.status === "pending"
          ? badge("pending", "#fde68a")
          : badge("missing", "#fecaca");

      const criticalChip = it.critical ? badge("CRITICAL", "#fee2e2") : "";

      const haystack = `${it.name} ${it.category}`.toLowerCase();

      return `
        <tr
          id="${escapeHtml(rowId)}"
          data-status="${escapeHtml(it.status)}"
          data-critical="${it.critical ? "1" : "0"}"
          data-haystack="${escapeHtml(haystack)}"
        >
          <td style="border-bottom:1px solid #f0f0f0; padding:10px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <strong>${escapeHtml(it.name)}</strong>
              ${criticalChip}
              ${statusChip}
            </div>
            <div style="color:#666; font-size:12px; margin-top:4px;">
              ${escapeHtml(it.category)}${it.due_date ? ` • Due ${escapeHtml(it.due_date)}` : ""}
            </div>
            ${
              it.evidence_file_url
                ? `<div style="margin-top:6px; font-size:12px;">
                    Evidence: <a href="${escapeHtml(it.evidence_file_url)}" target="_blank" rel="noreferrer">open</a>
                  </div>`
                : ""
            }
          </td>

          <td style="border-bottom:1px solid #f0f0f0; padding:10px; width:180px;">
            <select id="${escapeHtml(statusId)}" style="width:100%; padding:8px;">
              <option value="missing" ${it.status === "missing" ? "selected" : ""}>missing</option>
              <option value="pending" ${it.status === "pending" ? "selected" : ""}>pending</option>
              <option value="complete" ${it.status === "complete" ? "selected" : ""}>complete</option>
            </select>

            <button
              data-save-req="${escapeHtml(it.requirement_id)}"
              style="margin-top:8px; width:100%; padding:8px; border-radius:8px; border:1px solid #ddd; cursor:pointer;"
            >
              Save
            </button>

            <div style="color:#666; font-size:12px; margin-top:8px;">
              ${it.completed_at ? `Completed: ${escapeHtml(formatDate(it.completed_at))}` : ""}
              ${it.updated_at ? `<div>Updated: ${escapeHtml(formatDate(it.updated_at))}</div>` : ""}
            </div>
          </td>

          <td style="border-bottom:1px solid #f0f0f0; padding:10px;">
            <textarea
              id="${escapeHtml(notesId)}"
              rows="3"
              style="width:100%; padding:8px;"
              placeholder="Notes (optional)"
            >${escapeHtml(it.notes ?? "")}</textarea>
          </td>
        </tr>
      `;
    })
    .join("");

  const table = `
    <table style="border-collapse: collapse; width:100%;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Requirement</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px; width:180px;">Status</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Notes</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  return { html: header + table, checklist };
}

let renderInFlight = false;
let renderQueued = false;

function parseRoute(hash: string) {
  const raw = hash.replace("#", "").trim();
  if (!raw) return { name: "dashboard" as const };
  if (raw === "dashboard") return { name: "dashboard" as const };
  if (raw === "admin") return { name: "admin" as const };
  if (raw.startsWith("athlete/")) {
    const athleteId = raw.split("/")[1];
    return { name: "athlete" as const, athleteId };
  }
  return { name: "dashboard" as const };
}

async function renderApp() {
  if (renderInFlight) {
    renderQueued = true;
    return;
  }
  renderInFlight = true;

  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      await renderLogin("");
      return;
    }

    const userEmail = data.session.user.email ?? "(unknown)";
    const membership = await getMyMembership();

    if (!membership) {
      await renderRequestAccess();
      return;
    }

    const isAdmin = membership.role === "admin" || membership.role === "president";
    const route = parseRoute(location.hash);

    const nav = navHtml(isAdmin, userEmail);

    let view = "";
    let athleteChecklistCache: any[] | null = null;

    if (route.name === "admin") {
      if (!isAdmin) {
        view = `<p style="color:#b00;">Not authorized.</p>`;
      } else {
        view = await renderAdminView();
      }
    } else if (route.name === "athlete") {
      if (!route.athleteId) {
        view = `<p style="color:#b00;">Missing athlete id.</p>`;
      } else {
        const out = await renderAthleteView(route.athleteId);
        view = out.html;
        athleteChecklistCache = out.checklist;
      }
    } else {
      view = await renderDashboardView();
    }

    layout("YSA", nav + view);

    // Logout
    document.querySelector<HTMLButtonElement>("#logoutBtn")!.onclick = async () => {
      await supabase.auth.signOut();
      await renderLogin("");
    };

    // Wire Admin buttons (if present)
    if (route.name === "admin" && isAdmin) {
      document.querySelectorAll<HTMLButtonElement>("button[data-approve]").forEach((btn) => {
        btn.onclick = async () => {
          const id = btn.getAttribute("data-approve")!;
          const sel = document.querySelector<HTMLSelectElement>(`select[data-req-role="reqrole-${id}"]`);
          const role = (sel?.value || "staff") as any;

          const reqs = await loadAccessRequests();
          const req = reqs.find((x: any) => x.id === id);
          if (!req) return;

          await approveAccessRequest(req, role);
          await renderApp();
        };
      });

      document.querySelectorAll<HTMLButtonElement>("button[data-deny]").forEach((btn) => {
        btn.onclick = async () => {
          const id = btn.getAttribute("data-deny")!;
          await denyAccessRequest(id);
          await renderApp();
        };
      });

      document.querySelectorAll<HTMLButtonElement>("button[data-save-role]").forEach((btn) => {
        btn.onclick = async () => {
          const userId = btn.getAttribute("data-save-role")!;
          const select = document.querySelector<HTMLSelectElement>(`#role-${userId}`);
          const role = select?.value;
          if (!role) return;

          await updateMemberRole(userId, role);
          await renderApp();
        };
      });

      document.querySelectorAll<HTMLButtonElement>("button[data-remove-member]").forEach((btn) => {
        btn.onclick = async () => {
          const userId = btn.getAttribute("data-remove-member")!;
          if (!confirm("Remove this member?")) return;
          await removeMember(userId);
          await renderApp();
        };
      });
    }

    // Wire Athlete save buttons + Filters (if present)
    if (route.name === "athlete" && route.athleteId && athleteChecklistCache) {
      // Save buttons
      document.querySelectorAll<HTMLButtonElement>("button[data-save-req]").forEach((btn) => {
        btn.onclick = async () => {
          const requirementId = btn.getAttribute("data-save-req")!;
          const statusSel = document.querySelector<HTMLSelectElement>(`#status-${requirementId}`);
          const notesTa = document.querySelector<HTMLTextAreaElement>(`#notes-${requirementId}`);
          const status = (statusSel?.value || "missing") as any;
          const notes = notesTa?.value ?? "";

          const info = document.querySelector<HTMLDivElement>("#athleteSaveStatus");
          if (info) info.innerHTML = `<p style="color:#555;">Saving…</p>`;

          try {
            // Preserve existing value_* and evidence fields so we don’t wipe them
            const existing = athleteChecklistCache!.find((x: any) => x.requirement_id === requirementId);

            await upsertAthleteRequirementStatus({
              athleteId: route.athleteId!,
              requirementId,
              status,
              notes,
              value_number: existing?.value_number ?? null,
              value_date: existing?.value_date ?? null,
              value_text: existing?.value_text ?? null,
              evidence_file_url: existing?.evidence_file_url ?? null,
            });

            if (info) info.innerHTML = `<p style="color:#060;">Saved.</p>`;
            await renderApp(); // re-render to refresh counts and updated timestamps
          } catch (e: any) {
            if (info) info.innerHTML = `<p style="color:#b00;">${escapeHtml(e?.message || e)}</p>`;
            console.error(e);
          }
        };
      });

      // ---- Filters wiring ----
      const filterKey = `ysa_filters_${route.athleteId}`;

      const statusSel = document.querySelector<HTMLSelectElement>("#filterStatus");
      const critOnly = document.querySelector<HTMLInputElement>("#filterCriticalOnly");
      const searchBox = document.querySelector<HTMLInputElement>("#filterSearch");
      const clearBtn = document.querySelector<HTMLButtonElement>("#clearFilters");

      const applyFilters = () => {
        const status = statusSel?.value || "all";
        const criticalOnly = !!critOnly?.checked;
        const search = (searchBox?.value || "").trim().toLowerCase();

        sessionStorage.setItem(filterKey, JSON.stringify({ status, criticalOnly, search }));

        document.querySelectorAll<HTMLTableRowElement>('tr[id^="row-"]').forEach((tr) => {
          const rowStatus = tr.getAttribute("data-status") || "";
          const rowCritical = tr.getAttribute("data-critical") === "1";
          const hay = (tr.getAttribute("data-haystack") || "").toLowerCase();

          const matchesStatus = status === "all" ? true : rowStatus === status;
          const matchesCritical = criticalOnly ? rowCritical : true;
          const matchesSearch = search ? hay.includes(search) : true;

          tr.style.display = matchesStatus && matchesCritical && matchesSearch ? "" : "none";
        });
      };

      statusSel?.addEventListener("change", applyFilters);
      critOnly?.addEventListener("change", applyFilters);
      searchBox?.addEventListener("input", applyFilters);

      clearBtn?.addEventListener("click", () => {
        if (statusSel) statusSel.value = "all";
        if (critOnly) critOnly.checked = false;
        if (searchBox) searchBox.value = "";
        applyFilters();
      });

      applyFilters();
    }
  } catch (err: any) {
    renderError("YSA", err);
  } finally {
    renderInFlight = false;
    if (renderQueued) {
      renderQueued = false;
      await renderApp();
    }
  }
}

// Boot (and never fail silently)
layout("YSA", `<p>Loading…</p>`);
renderApp().catch((err) => renderError("YSA", err));

window.addEventListener("hashchange", () => {
  renderApp().catch(console.error);
});

supabase.auth.onAuthStateChange(() => {
  renderApp().catch(console.error);
});
