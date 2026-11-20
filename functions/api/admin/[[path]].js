
const WORKER_URL =
  "https://campus-connect-admin-login.campusconnect668.workers.dev";

const SITE_URL = "https://campus-connect-website.pages.dev";

export async function onRequest(context) {
  const incomingUrl = new URL(context.request.url);

  // Convert /api/admin/login to /login
  const workerPath = incomingUrl.pathname.replace(
    /^\/api\/admin/,
    ""
  );

  const targetUrl = WORKER_URL + workerPath + incomingUrl.search;

  const headers = new Headers(context.request.headers);

  // The login Worker checks this website origin.
  headers.set("Origin", SITE_URL);

  // Forward the request to the login Worker.
  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    body: ["GET", "HEAD"].includes(context.request.method)
      ? undefined
      : context.request.body,
    redirect: "manual"
  });

  // Return the Worker response and its session cookie
  // through the website's own domain.
  const responseHeaders = new Headers(response.headers);

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders
  });
}
