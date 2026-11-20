
export async function onRequest({ request, env }) {
  const respond = (data, status = 200) =>
    Response.json(data, { status });

  try {
    if (request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT * FROM website_images ORDER BY created_at DESC"
      ).all();

      return respond({ images: result.results || [] });
    }

    if (request.method !== "POST") {
      return respond({ error: "Method not allowed." }, 405);
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
      return respond({ error: "Please log in as administrator." }, 401);
    }

    const body = await request.json();

    const imageName = String(body.image_name || "").trim();
    const imageUrl = String(body.image_url || "").trim();
    const imageType = String(body.image_type || "general").trim();

    if (!imageName || !imageUrl) {
      return respond({ error: "Image name and URL are required." }, 400);
    }

    if (
      !/^https:\/\/res\.cloudinary\.com\/jnczthwu\/image\/upload\//.test(imageUrl)
    ) {
      return respond({ error: "Invalid Cloudinary image URL." }, 400);
    }

    const allowedTypes = ["banner", "student-life", "general"];

    if (!allowedTypes.includes(imageType)) {
      return respond({ error: "Invalid image category." }, 400);
    }

    await env.DB.prepare(`
      INSERT INTO website_images (image_name, image_url, image_type)
      VALUES (?, ?, ?)
    `).bind(imageName, imageUrl, imageType).run();

    return respond({
      success: true,
      message: "Image saved successfully."
    });

  } catch (error) {
    return respond({ error: "Unable to process image request." }, 500);
  }
}
