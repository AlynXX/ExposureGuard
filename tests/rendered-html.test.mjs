import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("built Worker reports live mode unavailable without runtime configuration", async () => {
  const response = await render('/api/live/status');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { available: false });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test("server-renders the ExposureGuard product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ExposureGuard AI/);
  assert.match(html, /Sprawdź, co internet/);
  assert.match(html, /BEZPIECZNE DEMO/);
  assert.match(html, /demo@exposureguard\.test/);
  assert.match(html, /Analiza plików odbywa się lokalnie/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
});

test("includes privacy and social-sharing metadata", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /exposureguard-social\.png/);
  assert.match(html, /Prywatność/);
  assert.match(html, /Privacy by design/);
});
