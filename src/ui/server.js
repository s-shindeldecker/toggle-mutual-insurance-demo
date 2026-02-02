// Validation-only: load .env for LaunchDarkly connectivity checks.
require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const { runQuoteDecisionFlow } = require("../quote");

const PORT = process.env.PORT || 3000;
const uiDir = __dirname;
const ldEnabled = Boolean(process.env.LAUNCHDARKLY_SDK_KEY);
// Validation-only: log LD status on startup.
console.log(`[LD] LD_ENABLED=${ldEnabled}`);
console.log(`[LD] LaunchDarkly init will ${ldEnabled ? "" : "not "}run.`);

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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const buildQuoteInput = ({ state, age, vehicleType, annualMileageBand }) => {
  const mileageBand = annualMileageBand || "5k-10k";
  const annualMileage =
    mileageBand === "under-5k"
      ? 4000
      : mileageBand === "over-10k"
        ? 15000
        : 8000;

  return {
    applicant: {
      age: Number(age) || 0,
      state: state || "unknown",
    },
    vehicle: {
      year: 2018,
      type: vehicleType || "sedan",
      annualMileage,
    },
    customer: {
      isReturning: false,
    },
  };
};

const respondJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    const htmlPath = path.join(uiDir, "index.html");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(fs.readFileSync(htmlPath));
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/assets/")) {
    const assetPath = path.join(
      __dirname,
      "..",
      "..",
      "assets",
      path.basename(req.url)
    );
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(fs.readFileSync(assetPath));
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
      const quote = await runQuoteDecisionFlow(quoteInput);
      const sanitizedQuote = {
        ...quote,
        modelOutputs: undefined,
      };
      respondJson(res, 200, { quote: sanitizedQuote });
    } catch (error) {
      respondJson(res, 400, { error: "Invalid request body" });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/api/flags/client-id") {
    respondJson(res, 200, { clientId: process.env.LAUNCHDARKLY_CLIENT_ID || "" });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`Quote demo UI running at http://localhost:${PORT}`);
});
