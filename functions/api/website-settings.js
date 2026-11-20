
export async function onRequest({ request, env }) {
  try {
    if (request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT * FROM website_settings WHERE id = 1"
      ).first();

      return Response.json(result || {});
    }

    if (request.method !== "PUT") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405 }
      );
    }

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

    const body = await request.json();

    const hero_title = String(body.hero_title || "").trim();
    const hero_description = String(body.hero_description || "").trim();
    const hero_button = String(body.hero_button || "").trim();
    const student_life_title = String(body.student_life_title || "").trim();
    const student_life_content = String(body.student_life_content || "").trim();
    const contact_email = String(body.contact_email || "").trim();

    if (
      !hero_title || !hero_description || !hero_button ||
      !student_life_title || !student_life_content ||
      !contact_email
    ) {
      return Response.json(
        { error: "Please complete all fields." },
        { status: 400 }
      );
    }

    if (
      hero_title.length > 200 ||
      hero_description.length > 2000 ||
      hero_button.length > 100 ||
      student_life_title.length > 200 ||
      student_life_content.length > 2000 ||
      contact_email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)
    ) {
      return Response.json(
        { error: "Please check your information and try again." },
        { status: 400 }
      );
    }

    await env.DB.prepare(`
      UPDATE website_settings
      SET hero_title = ?,
          hero_description = ?,
          hero_button = ?,
          student_life_title = ?,
          student_life_content = ?,
          contact_email = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).bind(
      hero_title,
      hero_description,
      hero_button,
      student_life_title,
      student_life_content,
      contact_email
    ).run();

    return Response.json({
      success: true,
      message: "Website settings saved successfully."
    });

  } catch (error) {
    return Response.json(
      { error: "Unable to process website settings." },
      { status: 500 }
    );
  }
}
