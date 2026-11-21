
async function checkAdmin(request) {
  const response = await fetch(
    "https://campus-connect-admin-login.campusconnect668.workers.dev/session",
    {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
        Origin: "https://campus-connect-website.pages.dev"
      }
    }
  );

  if (!response.ok) return false;

  const data = await response.json();
  return data.authenticated === true;
}

export async function onRequest({ request, env }) {
  const respond = (data, status = 200) =>
    Response.json(data, { status });

  try {
    if (request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT * FROM events ORDER BY event_date ASC"
      ).all();

      return respond({ events: result.results || [] });
    }

    if (request.method === "POST" || request.method === "DELETE") {
      if (!(await checkAdmin(request))) {
        return respond({ error: "Please log in as administrator." }, 401);
      }
    }

    if (request.method === "POST") {
      const body = await request.json();

      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      const event_date = String(body.event_date || "").trim();
      const location = String(body.location || "").trim();

      if (!title || !description || !event_date || !location) {
        return respond({ error: "Please complete all event fields." }, 400);
      }

      if (
        title.length > 200 ||
        description.length > 5000 ||
        location.length > 250 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(event_date)
      ) {
        return respond({ error: "Please check your event details." }, 400);
      }

      await env.DB.prepare(
        `INSERT INTO events
         (title, description, event_date, location, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(title, description, event_date, location).run();

      return respond({ message: "Event published successfully." }, 201);
    }

    if (request.method === "DELETE") {
      const body = await request.json();
      const id = Number(body.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return respond({ error: "Invalid event ID." }, 400);
      }

      const result = await env.DB.prepare(
        "DELETE FROM events WHERE id = ?"
      ).bind(id).run();

      if (!result.meta || result.meta.changes === 0) {
        return respond({ error: "Event not found." }, 404);
      }

      return respond({ message: "Event deleted successfully." });
    }

    return respond({ error: "Method not allowed." }, 405);
  } catch (error) {
    return respond({ error: "Unable to process event request." }, 500);
  }
}
