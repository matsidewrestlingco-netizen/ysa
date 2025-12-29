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
          <tr>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(a.last_name)}, ${escapeHtml(a.first_name)}</td>
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
                      (r) =>
                        `<option value="${r}" ${m.role === r ? "selected" : ""}>${r}</option>`
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

let renderInFlight = false;
let renderQueued = false;

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
    const route = location.hash.replace("#", "") || "dashboard";

    const nav = navHtml(isAdmin, userEmail);

    let view = "";
    if (route === "admin") {
      if (!isAdmin) {
        view = `<p style="color:#b00;">Not authorized.</p>`;
      } else {
        view = await renderAdminView();
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
    if (route === "admin" && isAdmin) {
      // Approve/Deny
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

      // Save role / Remove member
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
