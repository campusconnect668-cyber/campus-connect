
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
        "SELECT * FROM announcements ORDER BY created_at DESC"
      ).all();

      return respond({ announcements: result.results || [] });
    }

    if (request.method === "POST" || request.method === "DELETE") {
      if (!(await checkAdmin(request))) {
        return respond({ error: "Please log in as administrator." }, 401);
      }
    }

    if (request.method === "POST") {
      const body = await request.json();
      const title = String(body.title || "").trim();
      const content = String(body.content || "").trim();
      const category = String(body.category || "General").trim();

      if (!title || !content) {
        return respond({ error: "Title and content are required." }, 400);
      }

      await env.DB.prepare(
        `INSERT INTO announcements
         (title, content, category, created_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(title, content, category).run();

      return respond({ message: "Announcement published successfully." }, 201);
    }

    if (request.method === "DELETE") {
      const body = await request.json();
      const id = Number(body.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return respond({ error: "Invalid announcement ID." }, 400);
      }

      const result = await env.DB.prepare(
        "DELETE FROM announcements WHERE id = ?"
      ).bind(id).run();

      if (!result.meta || result.meta.changes === 0) {
        return respond({ error: "Announcement not found." }, 404);
      }

      return respond({ message: "Announcement deleted successfully." });
    }

    return respond({ error: "Method not allowed." }, 405);
  } catch (error) {
    return respond({ error: "Unable to process announcement request." }, 500);
  }
}
