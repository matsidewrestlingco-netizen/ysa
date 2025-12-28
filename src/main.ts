import { supabase } from "./lib/supabaseClient";
import { loadDashboard } from "./lib/ysa/queries";

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

  const loginBtn = document.querySelector<HTMLButtonElement>("#loginBtn")!;
  loginBtn.onclick = async () => {
    const email = (document.querySelector<HTMLInputElement>("#email")!).value.trim();
    const password = (document.querySelector<HTMLInputElement>("#password")!).value;

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await renderDashboard();
    } catch (e: any) {
      renderLogin(e?.message || "Login failed.");
    }
  };
}

async function renderDashboard() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return renderLogin("");

  try {
    const { roster, redFlags, totals } = await loadDashboard();

    app.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h1>YSA Dashboard</h1>
        <button id="logoutBtn">Log out</button>
      </div>

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

    document.querySelector<HTMLButtonElement>("#logoutBtn")!.onclick = async () => {
      await supabase.auth.signOut();
      renderLogin("");
    };
  } catch (e: any) {
    // Common: user exists but isn't in ysa.org_members
    renderLogin(e?.message || "Access denied. Ask an admin to add you to the board.");
  }
}

// Boot
renderDashboard();
supabase.auth.onAuthStateChange(() => renderDashboard());
