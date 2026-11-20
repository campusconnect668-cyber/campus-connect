
function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
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

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    key,
    256
  );

  return toHex(bits);
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return json({ error: "Enter your email and password." }, 400);
    }

    const student = await env.DB.prepare(
      "SELECT id, full_name, email, password_hash FROM students WHERE email = ?"
    ).bind(email).first();

    if (!student) {
      return json({ error: "Invalid email or password." }, 401);
    }

    const parts = student.password_hash.split(":");

    if (parts.length !== 2 || !/^[a-f0-9]{32}$/.test(parts[0])) {
      return json({ error: "Unable to verify account." }, 500);
    }

    const salt = new Uint8Array(
      parts[0].match(/.{2}/g).map(byte => parseInt(byte, 16))
    );

    const passwordHash = await hashPassword(password, salt);

    if (passwordHash !== parts[1]) {
      return json({ error: "Invalid email or password." }, 401);
    }

    return json({
      message: "Login successful.",
      student: {
        id: student.id,
        full_name: student.full_name,
        email: student.email
      }
    });

  } catch (error) {
    return json({ error: "Login failed. Please try again." }, 500);
  }
}
