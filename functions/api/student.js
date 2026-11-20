
async function hashToken(token) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function onRequestGet({ request, env }) {
  try {
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/(?:^|;\s*)student_session=([a-f0-9]{64})(?:;|$)/);

    if (!match) {
      return Response.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    const tokenHash = await hashToken(match[1]);

    const student = await env.DB.prepare(`
      SELECT students.id, students.full_name, students.email
      FROM student_sessions
      JOIN students ON students.id = student_sessions.student_id
      WHERE student_sessions.token_hash = ?
      AND student_sessions.expires_at > ?
    `).bind(tokenHash, new Date().toISOString()).first();

    if (!student) {
      return Response.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    return Response.json({
      authenticated: true,
      student
    }, {
      headers: { "Cache-Control": "no-store" }
    });

  } catch (error) {
    return Response.json(
      { error: "Unable to verify student session." },
      { status: 500 }
    );
  }
}
