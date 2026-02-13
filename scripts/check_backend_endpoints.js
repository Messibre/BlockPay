// Simple endpoint health-checker for the backend
// Usage: node scripts/check_backend_endpoints.js [baseUrl]
const base = process.argv[2] || "http://localhost:4000";
const endpoints = [
  "/api/v1/health",
  "/api/v1/jobs",
  "/api/v1/contracts",
  "/api/v1/proposals",
  "/api/v1/utils",
  "/api/v1/notifications",
  "/api/v1/auth",
  "/api/v1/auth/me",
  "/api/v1/dashboard/stats",
];

async function probe(path) {
  const url = base.replace(/\/$/, "") + path;
  try {
    const res = await fetch(url, { method: "GET" });
    const ct = res.headers.get("content-type") || "";
    let bodyPreview = "";
    try {
      if (ct.includes("application/json")) {
        const j = await res.json();
        bodyPreview = JSON.stringify(j, null, 2).slice(0, 1000);
      } else {
        const t = await res.text();
        bodyPreview = t.slice(0, 1000);
      }
    } catch (e) {
      bodyPreview = `<failed to parse body: ${e.message}>`;
    }
    console.log(`${url} -> ${res.status} ${res.statusText}`);
    console.log(
      bodyPreview ? `Response preview:\n${bodyPreview}\n---` : "No body"
    );
  } catch (error) {
    console.log(`${url} -> ERROR: ${error.message}`);
  }
}

async function main() {
  console.log("Backend endpoint check starting at", base);
  for (const ep of endpoints) {
    // small delay between requests
    await probe(ep);
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log("Done");
}

main().catch((e) => {
  console.error("Fatal error", e);
  process.exit(1);
});
