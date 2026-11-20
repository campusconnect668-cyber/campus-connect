
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
        "SELECT * FROM website_images ORDER BY created_at DESC"
      ).all();

      return respond({ images: result.results || [] });
    }

    if (request.method === "POST" || request.method === "DELETE") {
      const authenticated = await checkAdmin(request);

      if (!authenticated) {
        return respond(
          { error: "Please log in as administrator." },
          401
        );
      }
    }

    if (request.method === "POST") {
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

      if (!["banner", "student-life", "general"].includes(imageType)) {
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
    }

    if (request.method === "DELETE") {
      const body = await request.json();
      const id = Number(body.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return respond({ error: "Invalid image ID." }, 400);
      }

      const result = await env.DB.prepare(
        "DELETE FROM website_images WHERE id = ?"
      ).bind(id).run();

      if (!result.meta || result.meta.changes === 0) {
        return respond({ error: "Image not found." }, 404);
      }

      return respond({
        success: true,
        message: "Image removed from the website."
      });
    }

    return respond({ error: "Method not allowed." }, 405);

  } catch (error) {
    return respond(
      { error: "Unable to process image request." },
      500
    );
  }
}
