
export async function onRequest(context) {
  const { request, env } = context;

  const respond = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });

  try {
    if (request.method !== "GET") {
      return respond({ error: "Method not allowed." }, 405);
    }

    if (!env.DB) {
      return respond({ error: "Database connection is missing." }, 500);
    }

    // Verify student login
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/(?:^|;\s*)student_session=([^;]+)/);

    if (!match) {
      return respond({ error: "Please log in first." }, 401);
    }

    const token = decodeURIComponent(match[1]);

    const tokenBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token)
    );

    const tokenHash = Array.from(new Uint8Array(tokenBuffer))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");

    const student = await env.DB.prepare(`
      SELECT id
      FROM student_sessions
      WHERE token_hash = ?
      AND expires_at > datetime('now')
    `).bind(tokenHash).first();

    if (!student) {
      return respond({
        error: "Your session has expired. Please log in again."
      }, 401);
    }

    // Return names only. Keep emails and phone numbers private.
    const result = await env.DB.prepare(`
      SELECT id, full_name, created_at
      FROM students
      ORDER BY full_name ASC
    `).all();

    return respond({
      success: true,
      students: result.results
    });

  } catch (error) {
    return respond({
      error: "Unable to load student directory."
    }, 500);
  }
}
