import { supabase } from "./lib/supabaseClient";
import {
  loadDashboard,
  getMyMembership,
  requestBoardAccess,
  loadBoardMembers,
  loadAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
} from "./lib/ysa/queries";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app element");

function escapeHtml(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLogin(message = "") {
  app.innerHTML = `
    <h1>YSA Board Login</h1>
    <p style="color:#b00;">${escapeHtml(message)}</p>

    <div style="max-width:360px; display:grid; gap:8px;">
      <label>Email</label>
      <input id="email" type="email" autocomplete="email" />

      <label>Password</label>
      <input id="password" type="password" autocomplete="current-password" />

      <button id="loginBtn">Log in</button>
    </div>
  `;

  document.querySelector<HTMLButtonElement>("#loginBtn")!.onclick = async () => {
    const email = (document.querySelector<HTMLInputElement>("#email")!).value.trim();
    const password = (document.querySelector<HTMLInputElement>("#password")!).value;

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await renderApp();
    } catch (e: any) {
      renderLogin(e?.message || "Login failed.");
    }
  };
}

async function renderRequestAccess() {
  app.innerHTML = `
    <h1>Access Required</h1>
    <p>You’re logged in, but you’re not approved as a board/admin user yet.</p>
    <button id="reqBtn">Request Board Access</button>
    <button id="logoutBtn" style="margin-left:8px;">Log out</button>
  `;

  document.querySelector<HTMLButtonElement>("#logoutBtn")!.onclick = async () => {
    await supabase.auth.signOut();
    renderLogin("");
  };

  document.querySelector<HTMLButtonElement>("#reqBtn")!.onclick = async () => {
    try {
      await requestBoardAccess();
      app.innerHTML = `
        <h1>Request Sent</h1>
        <p>Your request has been submitted. An admin will approve you soon.</p>
        <button id="logoutBtn">Log out</button>
      `;
      document.querySelector<HTMLButtonElement>("#logoutBtn")!.onclick = async () => {
        await supabase.auth.signOut();
        renderLogin("");
      };
    } catch (e: any) {
      app.innerHTML = `<pre style="color:#b00;">${escapeHtml(e?.message || e)}</pre>`;
    }
  };
}

async function renderDashboardView() {
  const { roster, redFlags, totals } = await loadDashboard();

  return `
    <section style="display:flex; gap:12px; margin: 12px 0;">
      <div style="padding:12px; border:1px solid #ddd; border-radius:8px;">
        <div><strong>Athletes</strong></div>
        <div style="font-size:24px;">${totals.athletes}</div>
      </div>
      <div style="padding:12px; border:1px solid #ddd; border-radius:8px;">
        <div><strong>Green</strong></div>
        <div style="font-size:24px;">${totals.green}</div>
      </div>
      <div style="padding:12px; border:1px solid #ddd; border-radius:8px;">
        <div><strong>Not Green</strong></div>
        <div style="font-size:24px;">${totals.notGreen}</div>
      </div>
    </section>

    <h2>Red Flags</h2>
    <ul>
      ${redFlags.map(r => `
        <li><strong>${escapeHtml(r.requirement_name)}</strong> — ${escapeHtml(r.athletes_not_complete)} not complete</li>
      `).join("")}
    </ul>

    <h2>Roster</h2>
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
        ${roster.map(a => `
          <tr>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(a.last_name)}, ${escapeHtml(a.first_name)}</td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(a.grade)}</td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(a.team_level)}</td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(a.play_status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function renderAdminView() {
  const [members, requests] = await Promise.all([
    loadBoardMembers(),
    loadAccessRequests(),
  ]);

  return `
    <h2>Board Members</h2>
    <table style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Email</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Role</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Joined</th>
        </tr>
      </thead>
      <tbody>
        ${members.map(m => `
          <tr>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(m.email)}</td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(m.role)}</td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(m.created_at)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <h2 style="margin-top:18px;">Access Requests</h2>
    <table style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Email</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Requested</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Action</th>
        </tr>
      </thead>
      <tbody>
        ${requests.map(r => `
          <tr>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(r.email)}</td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(r.created_at)}</td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">
              <select data-role="${escapeHtml(r.id)}">
                <option value="staff">staff</option>
                <option value="coach">coach</option>
                <option value="uniform_manager">uniform_manager</option>
                <option value="volunteer_coordinator">volunteer_coordinator</option>
                <option value="treasurer">treasurer</option>
                <option value="admin">admin</option>
                <option value="president">president</option>
              </select>
              <button data-approve="${escapeHtml(r.id)}" style="margin-left:8px;">Approve</button>
              <button data-deny="${escapeHtml(r.id)}" style="margin-left:6px;">Deny</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function renderApp() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return renderLogin("");

  const membership = await getMyMembership();
  if (!membership) return renderRequestAccess();

  const isAdmin = membership.role === "admin" || membership.role === "president";
  const route = location.hash.replace("#", "") || "dashboard";

  const nav = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; gap:10px; align-items:center;">
        <h1 style="margin:0;">YSA</h1>
        <a href="#dashboard">Dashboard</a>
        ${isAdmin ? `<a href="#admin">Admin</a>` : ""}
      </div>
      <button id="logoutBtn">Log out</button>
    </div>
    <hr />
  `;

  let viewHtml = "";
  try {
    viewHtml = route === "admin" && isAdmin
      ? await renderAdminView()
      : await renderDashboardView();
  } catch (e: any) {
    viewHtml = `<pre style="color:#b00;">${escapeHtml(e?.message || e)}</pre>`;
  }

  app.innerHTML = nav + viewHtml;

  document.querySelector<HTMLButtonElement>("#logoutBtn")!.onclick = async () => {
    await supabase.auth.signOut();
    renderLogin("");
  };

  if (route === "admin" && isAdmin) {
    // Wire approve/deny buttons
    document.querySelectorAll<HTMLButtonElement>("button[data-approve]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-approve")!;
        const sel = document.querySelector<HTMLSelectElement>(`select[data-role="${id}"]`)!;
        const role = sel.value as any;

        const reqs = await loadAccessRequests();
        const req = reqs.find(r => r.id === id);
        if (!req) return;

        await approveAccessRequest(req as any, role);
        await renderApp();
      };
    });

    document.querySelectorAll<HTMLButtonElement>("button[data-deny]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-deny")!;
        await denyAccessRequest(id);
        await renderApp();
      };
    });
  }
}

// Boot
app.innerHTML = "<h1>YSA</h1><p>Loading…</p>";

renderApp().catch((err: any) => {
  console.error(err);
  app.innerHTML = `<h1>YSA</h1><pre style="color:#b00; white-space:pre-wrap;">${
    escapeHtml(err?.message || String(err))
  }</pre>`;
});

window.addEventListener("hashchange", () => {
  renderApp().catch(console.error);
});

supabase.auth.onAuthStateChange(() => {
  renderApp().catch(console.error);
});
