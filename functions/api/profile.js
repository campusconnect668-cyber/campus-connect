
async function hashToken(token) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getStudent(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)student_session=([a-f0-9]{64})(?:;|$)/);

  if (!match) return null;

  const tokenHash = await hashToken(match[1]);

  return await env.DB.prepare(`
    SELECT students.id, students.full_name, students.email,
           students.phone_number
    FROM student_sessions
    JOIN students ON students.id = student_sessions.student_id
    WHERE student_sessions.token_hash = ?
    AND student_sessions.expires_at > ?
  `).bind(tokenHash, new Date().toISOString()).first();
}

export async function onRequestGet({ request, env }) {
  try {
    const student = await getStudent(request, env);

    if (!student) {
      return Response.json({ error: "Please log in." }, { status: 401 });
    }

    return Response.json({ student }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json({ error: "Unable to load profile." }, { status: 500 });
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const student = await getStudent(request, env);

    if (!student) {
      return Response.json({ error: "Please log in." }, { status: 401 });
    }

    const body = await request.json();
    const fullName = String(body.full_name || "").trim();
    const phone = String(body.phone_number || "").trim();

    if (!fullName) {
      return Response.json({ error: "Full name is required." }, { status: 400 });
    }

    if (fullName.length > 150 || phone.length > 30) {
      return Response.json({ error: "Please check your details." }, { status: 400 });
    }

    await env.DB.prepare(
      "UPDATE students SET full_name = ?, phone_number = ? WHERE id = ?"
    ).bind(fullName, phone, student.id).run();

    return Response.json({
      message: "Profile updated successfully."
    });

  } catch (error) {
    return Response.json({ error: "Unable to update profile." }, { status: 500 });
  }
}
