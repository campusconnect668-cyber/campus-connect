
export async function onRequestPost({ request, env }) {
  try {
    // Check that the administrator is logged in
    const authResponse = await fetch(
      "https://campus-connect-admin-login.campusconnect668.workers.dev/session",
      {
        headers: {
          Cookie: request.headers.get("Cookie") || "",
          Origin: "https://campus-connect-website.pages.dev"
        }
      }
    );

    const auth = await authResponse.json();

    if (!authResponse.ok || !auth.authenticated) {
      return Response.json(
        { error: "Please log in as administrator." },
        { status: 401 }
      );
    }

    // Read announcement details
    const body = await request.json();

    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const category = String(body.category || "General").trim();

    if (!title || !content) {
      return Response.json(
        { error: "Title and content are required." },
        { status: 400 }
      );
    }

    if (
      title.length > 200 ||
      content.length > 5000 ||
      category.length > 100
    ) {
      return Response.json(
        { error: "One or more fields are too long." },
        { status: 400 }
      );
    }

    // Save announcement to D1
    await env.DB.prepare(
      `INSERT INTO announcements
       (title, content, category, created_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(title, content, category).run();

    return Response.json(
      { message: "Announcement published successfully." },
      { status: 201 }
    );

  } catch (error) {
    return Response.json(
      { error: "Unable to publish announcement." },
      { status: 500 }
    );
  }
}
