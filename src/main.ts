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

async function run() {
  const { roster, redFlags, totals } = await loadDashboard();

  app.innerHTML = `
    <h1>YSA Dashboard</h1>

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
        <li>
          <strong>${escapeHtml(r.requirement_name)}</strong>
          — ${escapeHtml(r.athletes_not_complete)} not complete
        </li>
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
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">
              ${escapeHtml(a.last_name)}, ${escapeHtml(a.first_name)}
            </td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(a.grade)}</td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(a.team_level)}</td>
            <td style="border-bottom:1px solid #f0f0f0; padding:8px;">${escapeHtml(a.play_status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

run().catch((err) => {
  console.error(err);
  app.innerHTML = `<pre style="color:red;">${escapeHtml(err?.message || err)}</pre>`;
});
