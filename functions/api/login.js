
function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt,
    iterations: 100000,
    hash: "SHA-256"
  }, key, 256);

  return toHex(bits);
}

async function hashToken(token) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return toHex(digest);
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return Response.json({ error: "Enter your email and password." }, { status: 400 });
    }

    const student = await env.DB.prepare(
      "SELECT id, full_name, email, password_hash FROM students WHERE email = ?"
    ).bind(email).first();

    if (!student) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const parts = student.password_hash.split(":");

    if (parts.length !== 2 || !/^[a-f0-9]{32}$/.test(parts[0])) {
      return Response.json({ error: "Unable to verify account." }, { status: 500 });
    }

    const salt = new Uint8Array(
      parts[0].match(/.{2}/g).map(x => parseInt(x, 16))
    );

    const calculatedHash = await hashPassword(password, salt);

    if (calculatedHash !== parts[1]) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const random = crypto.getRandomValues(new Uint8Array(32));
    const token = toHex(random);
    const tokenHash = await hashToken(token);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await env.DB.prepare(
      `INSERT INTO student_sessions (student_id, token_hash, expires_at)
       VALUES (?, ?, ?)`
    ).bind(student.id, tokenHash, expiresAt).run();

    return new Response(JSON.stringify({
      message: "Login successful.",
      student: {
        id: student.id,
        full_name: student.full_name,
        email: student.email
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Set-Cookie": `student_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
      }
    });

  } catch (error) {
    return Response.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
