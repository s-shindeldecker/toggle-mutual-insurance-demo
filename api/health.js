module.exports = (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({
    url: req.url,
    method: req.method,
    originalUrl: req.headers["x-forwarded-uri"] || req.headers["x-original-url"] || null,
    matchedPath: req.headers["x-matched-path"] || null,
    vercelProxyPath: req.headers["x-vercel-proxy-path"] || null,
    allHeaders: req.headers,
    timestamp: Date.now()
  }));
};
