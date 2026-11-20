
export async function onRequest(context) {
  const { request, env } = context;

  const headers = {
    "Content-Type": "application/json"
  };

  const respond = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });

  try {
    if (!env.DB) {
      return respond({ error: "Database connection is missing." }, 500);
    }

    // Verify the student's login session
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
      SELECT students.id, students.full_name
      FROM student_sessions
      JOIN students ON students.id = student_sessions.student_id
      WHERE student_sessions.token_hash = ?
      AND student_sessions.expires_at > datetime('now')
    `).bind(tokenHash).first();

    if (!student) {
      return respond({ error: "Your session has expired. Please log in again." }, 401);
    }

    // Get forum posts and comments
    if (request.method === "GET") {
      const posts = await env.DB.prepare(`
        SELECT id, student_id, student_name, title, content, created_at
        FROM forum_posts
        ORDER BY created_at DESC
      `).all();

      const comments = await env.DB.prepare(`
        SELECT id, post_id, student_id, student_name, comment, created_at
        FROM forum_comments
        ORDER BY created_at ASC
      `).all();

      return respond({
        success: true,
        posts: posts.results,
        comments: comments.results
      });
    }

    // Create a post or comment
    if (request.method === "POST") {
      const data = await request.json();

      if (data.action === "post") {
        const title = String(data.title || "").trim();
        const content = String(data.content || "").trim();

        if (!title || !content) {
          return respond({ error: "Enter a title and message." }, 400);
        }

        if (title.length > 150 || content.length > 5000) {
          return respond({ error: "Your title or message is too long." }, 400);
        }

        const result = await env.DB.prepare(`
          INSERT INTO forum_posts
          (student_id, student_name, title, content)
          VALUES (?, ?, ?, ?)
        `).bind(student.id, student.full_name, title, content).run();

        return respond({
          success: true,
          message: "Discussion posted successfully.",
          id: result.meta.last_row_id
        });
      }

      if (data.action === "comment") {
        const postId = Number(data.post_id);
        const comment = String(data.comment || "").trim();

        if (!Number.isInteger(postId) || postId < 1 || !comment) {
          return respond({ error: "Enter a valid comment." }, 400);
        }

        if (comment.length > 2000) {
          return respond({ error: "Your comment is too long." }, 400);
        }

        const post = await env.DB.prepare(
          "SELECT id FROM forum_posts WHERE id = ?"
        ).bind(postId).first();

        if (!post) {
          return respond({ error: "Discussion not found." }, 404);
        }

        await env.DB.prepare(`
          INSERT INTO forum_comments
          (post_id, student_id, student_name, comment)
          VALUES (?, ?, ?, ?)
        `).bind(postId, student.id, student.full_name, comment).run();

        return respond({
          success: true,
          message: "Comment added successfully."
        });
      }

      return respond({ error: "Invalid forum action." }, 400);
    }

    return respond({ error: "Method not allowed." }, 405);

  } catch (error) {
    return respond({ error: "Forum error: " + error.message }, 500);
  }
}
