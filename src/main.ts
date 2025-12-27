import { loadDashboard } from "./lib/ysa/queries";

async function run() {
  const data = await loadDashboard();
  console.log("Dashboard:", data);
}

run();
