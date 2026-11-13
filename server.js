const dns = require("dns").promises;
const express = require("express");
const net = require("net");
const path = require("path");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

const saved = [
  {
    url: "https://example.edu/robotics",
    title: "Robotics club",
    snippet: "Shop hours, ride board, and the missing hex-driver thread."
  },
  {
    url: "https://example.edu/film",
    title: "Film society",
    snippet: "Thursday screening in the basement theater. Bring a chair."
  }
];

function extract(html) {
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [, ""])[1].trim();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    title: title || text.slice(0, 60) || "Untitled",
    snippet: text.slice(0, 240)
  };
}

function blocked(message) {
  const err = new Error(message);
  err.blocked = true;
  return err;
}

function isPrivateAddress(address) {
  const mapped = String(address).toLowerCase().startsWith("::ffff:") ? String(address).slice(7) : String(address);
  const kind = net.isIP(mapped);
  if (kind === 4) {
    const [a, b] = mapped.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (kind === 6) {
    const ip = mapped.toLowerCase();
    if (ip === "::1" || ip === "::") return true;
    if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(ip)) return true;
    return false;
  }
  return true;
}

function isBlockedName(hostname, requestHost) {
  const name = hostname.toLowerCase().replace(/\.$/, "");
  const own = String(requestHost || "").split(":")[0].toLowerCase();
  if (!name || name === own) return true;
  if (name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local")) return true;
  if (name === "metadata.google.internal" || name.endsWith(".internal")) return true;
  return false;
}

async function assertPublic(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw blocked("private");
    return;
  }
  let records;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (err) {
    if (err.code === "ENOTFOUND") throw err;
    throw blocked("dns");
  }
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw blocked("private");
  }
}

async function fetchPublic(rawUrl, requestHost) {
  let current = rawUrl;
  for (let hop = 0; hop < 3; hop += 1) {
    let parsed;
    try {
      parsed = new URL(current);
    } catch {
      throw blocked("url");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw blocked("scheme");
    if (parsed.username || parsed.password) throw blocked("auth");
    if (isBlockedName(parsed.hostname, requestHost)) throw blocked("host");
    await assertPublic(parsed.hostname);
    const response = await fetch(parsed.href, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000)
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw blocked("redirect");
      current = new URL(location, parsed).href;
      continue;
    }
    return { url: parsed.href, status: response.status, ...extract(await response.text()) };
  }
  throw blocked("redirect");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/internal", (_req, res) => {
  res.type("text/plain").send(
    "Desk note. Not for the public preview list. Release code PREVIEW-4418. Rotate after the spring screening."
  );
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/preview", async (req, res) => {
  const url = String(req.body.url || "").trim();
  if (!url) {
    return res.status(400).send(page("Paste a URL.", saved, null));
  }
  try {
    const card = await fetchPublic(url, req.get("host"));
    res.send(page(null, saved, card));
  } catch (err) {
    if (err.blocked) {
      return res.status(400).send(page("Use a public http or https URL.", saved, null));
    }
    res.status(502).send(page("Could not fetch that URL.", saved, null));
  }
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(error, cards, fresh) {
  const list = cards
    .map(
      (card) => `<article class="card"><h2>${escapeHtml(card.title)}</h2><p>${escapeHtml(card.snippet)}</p><p class="url">${escapeHtml(card.url)}</p></article>`
    )
    .join("");
  const result = fresh
    ? `<article class="card fresh"><p class="status">${fresh.status}</p><h2>${escapeHtml(fresh.title)}</h2><p>${escapeHtml(fresh.snippet)}</p><p class="url">${escapeHtml(fresh.url)}</p></article>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Preview</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="shell">
    <header class="top">
      <a class="brand" href="/"><span class="mark">Pv</span><span><strong>Preview</strong><em>Club link cards</em></span></a>
    </header>
    <main>
      <section class="hero">
        <h1>Paste a club URL. Get a card.</h1>
        <p class="lede">Preview fetches the page and keeps the title and the first lines. No account required.</p>
      </section>
      <form method="post" action="/preview" class="stack">
        <label><span>URL</span><input name="url" type="url" placeholder="https://..." required></label>
        <button type="submit">Preview</button>
      </form>
      ${error ? `<p class="flash">${escapeHtml(error)}</p>` : ""}
      ${result}
      <h2 class="section">Saved cards</h2>
      ${list}
    </main>
    <footer>Preview is unofficial. It only reads what the URL returns.</footer>
  </div>
</body>
</html>`;
}

function start(port = process.env.PORT || 3000) {
  return app.listen(port, "0.0.0.0");
}

if (require.main === module) {
  const server = start();
  server.on("listening", () => {
    console.log(`Preview listening on ${server.address().port}`);
  });
}

module.exports = { app, start };
