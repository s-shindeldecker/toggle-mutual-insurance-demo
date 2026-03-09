const http = require("http");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 19876 + Math.floor(Math.random() * 100);

const cookieJar = {};

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const cookieHeader = Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (cookieHeader) headers["Cookie"] = cookieHeader;

    const req = http.request(
      { hostname: "127.0.0.1", port: PORT, path: urlPath, method, headers },
      (res) => {
        const setCookies = res.headers["set-cookie"] || [];
        for (const sc of setCookies) {
          const [nameValue] = sc.split(";");
          const eqIndex = nameValue.indexOf("=");
          if (eqIndex > 0) {
            cookieJar[nameValue.slice(0, eqIndex).trim()] = nameValue.slice(eqIndex + 1).trim();
          }
        }
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
    env: { ...process.env, PORT: String(PORT), LAUNCHDARKLY_SDK_KEY: "", LAUNCHDARKLY_CLIENT_ID: "", DEBUG_EVENTS: "true" },
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

    // --- session cookies ---
    assert("tm_session cookie set", "tm_session" in cookieJar);
    assert("tm_session_public cookie set", "tm_session_public" in cookieJar);
    assert("Session cookies have same value", cookieJar.tm_session === cookieJar.tm_session_public);
    const initialSession = cookieJar.tm_session;

    // --- GET / ---
    const home = await request("GET", "/");
    assert("GET / returns 200", home.status === 200);
    assert("GET / returns HTML", (home.headers["content-type"] || "").includes("text/html"));
    assert("Session stable across requests", cookieJar.tm_session === initialSession);

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
      userKey: "user_smoke",
    };
    const quote = await request("POST", "/api/quote", quotePayload);
    assert("POST /api/quote returns 200", quote.status === 200);
    const quoteResult = JSON.parse(quote.body);
    assert("Response contains quote object", quoteResult.quote != null);
    assert("Quote has offer with price", typeof quoteResult.quote.offer?.price === "number");
    assert("Quote has decisionSummary", quoteResult.quote.decisionSummary != null);
    const ds = quoteResult.quote.decisionSummary;
    assert("decisionSummary has offerStrategy", typeof ds.offerStrategy === "string");
    assert("decisionSummary has modelsScored with variants", Array.isArray(ds.modelsScored) && ds.modelsScored.length > 0 && ds.modelsScored.every((m) => typeof m.variant === "string"));
    assert("modelOutputs stripped from response", !("modelOutputs" in quoteResult.quote) || quoteResult.quote.modelOutputs == null);
    assert("ldContext not in response", !("ldContext" in quoteResult));
    assert("Session stable after quote", cookieJar.tm_session === initialSession);

    // --- POST /api/quote (underage — ineligible) ---
    const underage = await request("POST", "/api/quote", { ...quotePayload, age: 16, userKey: "user_smoke2" });
    assert("POST /api/quote (underage) returns 200", underage.status === 200);
    const underageResult = JSON.parse(underage.body);
    assert("Underage quote is ineligible", underageResult.quote.eligibility?.eligible === false);

    // --- POST /api/checkout ---
    const checkoutPayload = {
      name: "Smoke Test",
      email: "smoke@test.com",
      address: "123 Main St",
      quoteId: quoteResult.quote.id,
      userKey: "user_smoke",
    };
    const ck = await request("POST", "/api/checkout", checkoutPayload);
    assert("POST /api/checkout returns 200", ck.status === 200);
    const ckResult = JSON.parse(ck.body);
    assert("Checkout response has ok: true", ckResult.ok === true);
    assert("confirmationId matches CONF-<n> format", /^CONF-\d+$/.test(ckResult.confirmationId));

    // --- POST /api/checkout (missing quoteId) ---
    const ckBad = await request("POST", "/api/checkout", { name: "X" });
    assert("POST /api/checkout without quoteId returns 400", ckBad.status === 400);
    const ckBadBody = JSON.parse(ckBad.body);
    assert("Checkout error has ok: false", ckBadBody.ok === false);

    // --- 404 ---
    const notFound = await request("GET", "/nonexistent");
    assert("GET /nonexistent returns 404", notFound.status === 404);

    // --- lifecycle events via in-memory emitter ---
    const debugRes = await request("GET", "/api/debug/events");
    assert("GET /api/debug/events returns 200", debugRes.status === 200);
    const debugBody = JSON.parse(debugRes.body);
    const eventNames = debugBody.events.map((e) => e.name);
    assert("quote_completed emitted", eventNames.includes("quote_completed"));
    assert("checkout_completed emitted", eventNames.includes("checkout_completed"));
    const qc = debugBody.events.find((e) => e.name === "quote_completed");
    assert("quote_completed has quoteId", typeof qc.payload?.quoteId === "string");
    assert("quote_completed has status", qc.payload?.status === "completed");
    const cc = debugBody.events.find((e) => e.name === "checkout_completed");
    assert("checkout_completed has quoteId", typeof cc.payload?.quoteId === "string");
    assert("checkout_completed has confirmationId", /^CONF-\d+$/.test(cc.payload?.confirmationId));
    assert("No metric_* events emitted", !eventNames.some((n) => n.startsWith("metric_")));

    // --- POST /api/session/reset ---
    const preResetSession = cookieJar.tm_session;
    const resetRes = await request("POST", "/api/session/reset");
    assert("POST /api/session/reset returns 200", resetRes.status === 200);
    const resetBody = JSON.parse(resetRes.body);
    assert("Session reset returns ok: true", resetBody.ok === true);
    assert("Session reset returns new sessionId", typeof resetBody.sessionId === "string" && resetBody.sessionId.length > 0);
    assert("tm_session cookie rotated", cookieJar.tm_session !== preResetSession);
    assert("tm_session_public cookie rotated", cookieJar.tm_session_public !== preResetSession);
    assert("Rotated cookies have same value", cookieJar.tm_session === cookieJar.tm_session_public);
    assert("Rotated session matches response", cookieJar.tm_session === resetBody.sessionId);

    // --- lifecycle validation ---
    assert("No invalid lifecycle stage warnings in server log", !serverLog.includes("Invalid lifecycle stage"));

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
