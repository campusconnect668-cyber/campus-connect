
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

    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!fullName || !email || !password) {
      return json({ error: "Please complete all fields." }, 400);
    }

    if (fullName.length > 150 || email.length > 254) {
      return json({ error: "One or more fields are too long." }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Enter a valid email address." }, 400);
    }

    if (password.length < 8 || password.length > 128) {
      return json({ error: "Password must be 8 to 128 characters." }, 400);
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordHash = await hashPassword(password, salt);
    const storedHash = `${toHex(salt)}:${passwordHash}`;

    await env.DB.prepare(
      `INSERT INTO students (full_name, email, password_hash)
       VALUES (?, ?, ?)`
    ).bind(fullName, email, storedHash).run();

    return json({
      message: "Student account created successfully."
    }, 201);

  } catch (error) {
    if (error.message && error.message.includes("UNIQUE")) {
      return json({ error: "This email is already registered." }, 409);
    }

    return json({ error: "Registration failed. Please try again." }, 500);
  }
}
