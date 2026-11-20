
const LOGIN_WORKER =
  "https://campus-connect-admin-login.campusconnect668.workers.dev";

export async function onRequestGet({ request, env }) {
  try {
    const authResponse = await fetch(LOGIN_WORKER + "/session", {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
        Origin: "https://campus-connect-website.pages.dev"
      }
    });

    const auth = await authResponse.json();

    if (!authResponse.ok || !auth.authenticated) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await env.DB
      .prepare("SELECT * FROM contributions ORDER BY created_at DESC")
      .all();

    return Response.json({
      success: true,
      contributions: result.results || []
    });

  } catch (error) {
    return Response.json(
      { error: "Could not load contributions" },
      { status: 500 }
    );
  }
}
