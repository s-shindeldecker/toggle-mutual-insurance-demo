const http = require("http");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 19876 + Math.floor(Math.random() * 100);

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port: PORT, path: urlPath, method,
        headers: body ? { "Content-Type": "application/json" } : {} },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function waitForServer(retries = 30, delay = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      await request("GET", "/");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`Server did not start on port ${PORT}`);
}

async function run() {
  const serverPath = path.resolve(__dirname, "..", "src", "ui", "server.js");
  const server = spawn("node", [serverPath], {
    env: { ...process.env, PORT: String(PORT), LAUNCHDARKLY_SDK_KEY: "", LAUNCHDARKLY_CLIENT_ID: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverLog = "";
  server.stdout.on("data", (c) => { serverLog += c; });
  server.stderr.on("data", (c) => { serverLog += c; });

  const results = [];
  let passed = 0;
  let failed = 0;

  function assert(name, condition) {
    if (condition) {
      results.push({ name, ok: true });
      passed++;
    } else {
      results.push({ name, ok: false });
      failed++;
    }
  }

  try {
    await waitForServer();

    // --- GET / ---
    const home = await request("GET", "/");
    assert("GET / returns 200", home.status === 200);
    assert("GET / returns HTML", (home.headers["content-type"] || "").includes("text/html"));

    // --- GET /app.js ---
    const app = await request("GET", "/app.js");
    assert("GET /app.js returns 200", app.status === 200);
    assert("GET /app.js returns JS", (app.headers["content-type"] || "").includes("text/javascript"));

    // --- GET /api/flags/client-id ---
    const flags = await request("GET", "/api/flags/client-id");
    assert("GET /api/flags/client-id returns 200", flags.status === 200);
    const flagsBody = JSON.parse(flags.body);
    assert("client-id response has clientId key", "clientId" in flagsBody);

    // --- POST /api/quote (eligible applicant) ---
    const quotePayload = {
      address: "123 Main St, Springfield, IL 62704",
      fullName: "Smoke Test",
      age: 30,
      maritalStatus: "single",
      numberOfKids: 0,
      vehicleYear: 2020,
      vehicleMake: "Toyota",
      vehicleModel: "Camry",
      vehicleVin: "1HGCM82633A004352",
      vehicleOdometer: 45000,
      vehicleAnnualMileage: 12000,
      sessionKey: "sess_smoke",
      userKey: "user_smoke",
    };
    const quote = await request("POST", "/api/quote", quotePayload);
    assert("POST /api/quote returns 200", quote.status === 200);
    const quoteResult = JSON.parse(quote.body);
    assert("Response contains quote object", quoteResult.quote != null);
    assert("Quote has offer with price", typeof quoteResult.quote.offer?.price === "number");
    assert("Quote has decisionSummary", quoteResult.quote.decisionSummary != null);
    assert("modelOutputs stripped from response", !("modelOutputs" in quoteResult.quote) || quoteResult.quote.modelOutputs == null);

    // --- POST /api/quote (underage — ineligible) ---
    const underage = await request("POST", "/api/quote", { ...quotePayload, age: 16, sessionKey: "sess_smoke2", userKey: "user_smoke2" });
    assert("POST /api/quote (underage) returns 200", underage.status === 200);
    const underageResult = JSON.parse(underage.body);
    assert("Underage quote is ineligible", underageResult.quote.eligibility?.eligible === false);

    // --- 404 ---
    const notFound = await request("GET", "/nonexistent");
    assert("GET /nonexistent returns 404", notFound.status === 404);

  } finally {
    server.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 200));
    if (!server.killed) server.kill("SIGKILL");
  }

  console.log("");
  console.log("--- Smoke Test Results ---");
  for (const r of results) {
    const mark = r.ok ? "\u2713" : "\u2717";
    console.log(`  ${mark} ${r.name}`);
  }
  console.log(`\n  ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.error("Server log:\n" + serverLog);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Smoke test crashed:", err.message);
  process.exit(1);
});
