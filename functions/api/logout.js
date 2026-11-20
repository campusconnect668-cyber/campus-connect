
async function hashToken(token) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function onRequestPost({ request, env }) {
  try {
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/(?:^|;\s*)student_session=([a-f0-9]{64})(?:;|$)/);

    if (match) {
      const tokenHash = await hashToken(match[1]);

      await env.DB.prepare(
        "DELETE FROM student_sessions WHERE token_hash = ?"
      ).bind(tokenHash).run();
    }

    return new Response(JSON.stringify({
      message: "Logged out successfully."
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Set-Cookie": "student_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
      }
    });

  } catch (error) {
    return Response.json(
      { error: "Unable to log out. Please try again." },
      { status: 500 }
    );
  }
}
