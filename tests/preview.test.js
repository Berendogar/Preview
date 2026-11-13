const test = require("node:test");
const assert = require("node:assert/strict");
const { start } = require("../server");

function listen() {
  return new Promise((resolve) => {
    const server = start(0);
    server.on("listening", () => resolve(server));
  });
}

async function preview(port, url) {
  return fetch(`http://127.0.0.1:${port}/preview`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ url })
  });
}

test("health check", async () => {
  const server = await listen();
  const port = server.address().port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.deepEqual(await response.json(), { ok: true });
  } finally {
    server.close();
  }
});

test("loopback preview does not return the desk note", async () => {
  const server = await listen();
  const port = server.address().port;
  try {
    const response = await preview(port, `http://127.0.0.1:${port}/internal`);
    const body = await response.text();
    assert.equal(response.status, 400);
    assert.equal(body.includes("PREVIEW-4418"), false);
  } finally {
    server.close();
  }
});

test("decimal loopback and localhost are rejected", async () => {
  const server = await listen();
  const port = server.address().port;
  try {
    for (const url of [
      `http://localhost:${port}/internal`,
      "http://2130706433/internal",
      "http://127.1/internal"
    ]) {
      const response = await preview(port, url);
      const body = await response.text();
      assert.equal(response.status, 400, url);
      assert.equal(body.includes("PREVIEW-4418"), false, url);
    }
  } finally {
    server.close();
  }
});

test("a public page still previews", async () => {
  const server = await listen();
  const port = server.address().port;
  try {
    const response = await preview(port, "https://example.com");
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /Example Domain/);
  } finally {
    server.close();
  }
});
