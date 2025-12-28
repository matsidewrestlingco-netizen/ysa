import { loadDashboard } from "./lib/ysa/queries";

loadDashboard().then(console.log).catch(console.error);

async function run() {
  const data = await loadDashboard();
  console.log("Dashboard:", data);
}

run();
