// Validation-only: load .env for LaunchDarkly connectivity checks.
require("dotenv").config();

const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { runQuoteDecisionFlow } = require("../quote");
const { AnalyticsEvents } = require("../analytics/events");
const { QUOTE_LIFECYCLE } = require("../analytics/lifecycle");
const { trackEvent } = require("../analytics/tracker");
const { eventEmitter } = require("../analytics/eventEmitter");

const PORT = process.env.PORT || 3000;
let nextConfirmationId = 1;
const uiDir = __dirname;
const ldEnabled = Boolean(process.env.LAUNCHDARKLY_SDK_KEY);
// Validation-only: log LD status on startup.
console.log(`[LD] LD_ENABLED=${ldEnabled}`);
console.log(`[LD] LaunchDarkly init will ${ldEnabled ? "" : "not "}run.`);

const parseCookies = (req) => {
  const header = req.headers.cookie || "";
  const cookies = {};
  header.split(";").forEach((pair) => {
    const [name, ...rest] = pair.trim().split("=");
    if (name) cookies[name] = rest.join("=");
  });
  return cookies;
};

const ensureSession = (req, res) => {
  const cookies = parseCookies(req);
  let sessionId = cookies.tm_session;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    res.setHeader("Set-Cookie", [
      `tm_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/`,
      `tm_session_public=${sessionId}; SameSite=Lax; Path=/`,
    ]);
  }
  return sessionId;
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });

const buildQuoteInput = ({
  address,
  fullName,
  age,
  maritalStatus,
  numberOfKids,
  userKey,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  vehicleVin,
  vehicleOdometer,
  vehicleAnnualMileage,
}) => ({
  address: {
    fullAddress: address || "unknown",
  },
  applicant: {
    fullName: fullName || "Unknown",
    age: Number(age) || 0,
    maritalStatus: maritalStatus || "unknown",
    numberOfKids: Number(numberOfKids) || 0,
  },
  user: {
    key: userKey || null,
  },
  session: {
    key: null,
  },
  vehicle: {
    year: Number(vehicleYear) || 2018,
    make: vehicleMake || "unknown",
    model: vehicleModel || "unknown",
    vin: vehicleVin || "",
    odometer: Number(vehicleOdometer) || 0,
    annualMileage: Number(vehicleAnnualMileage) || 0,
  },
  customer: {
    isReturning: false,
  },
});

const respondJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const handler = async (req, res) => {
  const sessionId = ensureSession(req, res);

  if (req.method === "GET" && req.url === "/") {
    const htmlPath = path.join(uiDir, "index.html");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(fs.readFileSync(htmlPath));
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/assets/")) {
    const relPath = decodeURIComponent(req.url.slice("/assets/".length));
    if (relPath.includes("..") || path.isAbsolute(relPath)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Invalid asset path" }));
      return;
    }
    const assetsRoot = path.join(__dirname, "..", "..", "assets");
    const assetPath = path.join(assetsRoot, relPath);
    if (!assetPath.startsWith(assetsRoot) || !fs.existsSync(assetPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Asset not found" }));
      return;
    }
    const ext = path.extname(assetPath).toLowerCase();
    const mimeTypes = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };
    const contentType = mimeTypes[ext] || "application/octet-stream";
    try {
      const data = fs.readFileSync(assetPath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Asset not found" }));
    }
    return;
  }

  if (req.method === "GET" && req.url === "/app.js") {
    const jsPath = path.join(uiDir, "app.js");
    res.writeHead(200, { "Content-Type": "text/javascript" });
    res.end(fs.readFileSync(jsPath));
    return;
  }

  if (req.method === "POST" && req.url === "/api/quote") {
    try {
      const body = await readJsonBody(req);
      const quoteInput = buildQuoteInput(body);
      quoteInput.session.key = sessionId;
      const quote = await runQuoteDecisionFlow(quoteInput);
      const sanitizedQuote = {
        ...quote,
        modelOutputs: undefined,
        ldContext: undefined,
      };
      respondJson(res, 200, { quote: sanitizedQuote });
    } catch (error) {
      respondJson(res, 400, { ok: false, error: "Invalid request body" });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/api/flags/client-id") {
    respondJson(res, 200, { clientId: process.env.LAUNCHDARKLY_CLIENT_ID || "" });
    return;
  }

  if (req.method === "POST" && req.url === "/api/checkout") {
    try {
      const body = await readJsonBody(req);
      const { quoteId, userKey } = body;
      if (!quoteId) {
        respondJson(res, 400, { ok: false, error: "quoteId is required" });
        return;
      }

      const context = {
        kind: "multi",
        session: { key: sessionId },
        user: { key: userKey || "unknown" },
      };

      trackEvent(AnalyticsEvents.CHECKOUT_STARTED, { quoteId, status: QUOTE_LIFECYCLE.CHECKOUT }, context);
      trackEvent(AnalyticsEvents.CHECKOUT_SUBMITTED, { quoteId, status: QUOTE_LIFECYCLE.CHECKOUT }, context);

      const confirmationId = `CONF-${nextConfirmationId}`;
      nextConfirmationId += 1;

      trackEvent(
        AnalyticsEvents.CHECKOUT_COMPLETED,
        { quoteId, status: QUOTE_LIFECYCLE.COMPLETED, completed: true, confirmationId },
        context
      );

      respondJson(res, 200, { ok: true, confirmationId });
    } catch (error) {
      respondJson(res, 400, { ok: false, error: "Invalid checkout request" });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/session/reset") {
    const newSessionId = crypto.randomUUID();
    res.setHeader("Set-Cookie", [
      `tm_session=${newSessionId}; HttpOnly; SameSite=Lax; Path=/`,
      `tm_session_public=${newSessionId}; SameSite=Lax; Path=/`,
    ]);
    respondJson(res, 200, { ok: true, sessionId: newSessionId });
    return;
  }

  if (req.method === "GET" && req.url === "/api/debug/events") {
    if (process.env.DEBUG_EVENTS !== "true") {
      res.writeHead(404);
      res.end();
      return;
    }
    respondJson(res, 200, { events: eventEmitter.getEmittedEvents() });
    return;
  }

  res.writeHead(404);
  res.end();
};

if (require.main === module) {
  const server = http.createServer(handler);
  server.listen(PORT, () => {
    console.log(`Quote demo UI running at http://localhost:${PORT}`);
  });
}

module.exports = handler;
