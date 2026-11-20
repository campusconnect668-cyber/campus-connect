
export async function onRequestPost({ request, env }) {
  try {
    // Verify administrator session
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

    // Read event details
    const body = await request.json();

    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const event_date = String(body.event_date || "").trim();
    const location = String(body.location || "").trim();

    if (!title || !description || !event_date || !location) {
      return Response.json(
        { error: "Please complete all event fields." },
        { status: 400 }
      );
    }

    if (
      title.length > 200 ||
      description.length > 5000 ||
      location.length > 250 ||
      !/^\d{4}-\d{2}-\d{2}/.test(event_date)
    ) {
      return Response.json(
        { error: "Please check your event details." },
        { status: 400 }
      );
    }

    // Save event to D1
    await env.DB.prepare(
      `INSERT INTO events
       (title, description, event_date, location, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(title, description, event_date, location).run();

    return Response.json(
      { message: "Event published successfully." },
      { status: 201 }
    );

  } catch (error) {
    return Response.json(
      { error: "Unable to publish event." },
      { status: 500 }
    );
  }
}
