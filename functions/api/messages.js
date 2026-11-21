export async function onRequest(context) {
  const { request, env } = context;

  const respond = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });

  try {
    if (!env.DB) {
      return respond({ error: "Database connection is missing." }, 500);
    }

    if (!["GET", "POST"].includes(request.method)) {
      return respond({ error: "Method not allowed." }, 405);
    }

    // Verify logged-in student
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
      return respond({
        error: "Session expired. Please log in again."
      }, 401);
    }

    // Handle POST requests
    if (request.method === "POST") {
      const data = await request.json();

      // Mark one conversation as read
      if (data.action === "mark_read") {
        const senderId = Number(data.sender_id);

        if (!Number.isInteger(senderId) || senderId < 1) {
          return respond({ error: "Invalid conversation." }, 400);
        }

        if (senderId === Number(student.id)) {
          return respond({ error: "Invalid conversation." }, 400);
        }

        await env.DB.prepare(`
          UPDATE student_messages
          SET read_at = CURRENT_TIMESTAMP
          WHERE receiver_id = ?
          AND sender_id = ?
          AND read_at IS NULL
        `).bind(student.id, senderId).run();

        return respond({
          success: true,
          message: "Conversation marked as read."
        });
      }

      // Send a private message
      const receiverId = Number(data.receiver_id);
      const message = String(data.message || "").trim();

      if (!Number.isInteger(receiverId) || receiverId < 1) {
        return respond({ error: "Select a valid student." }, 400);
      }

      if (receiverId === Number(student.id)) {
        return respond({ error: "You cannot message yourself." }, 400);
      }

      if (!message || message.length > 3000) {
        return respond({
          error: "Message must be between 1 and 3000 characters."
        }, 400);
      }

      const receiver = await env.DB.prepare(
        "SELECT id FROM students WHERE id = ?"
      ).bind(receiverId).first();

      if (!receiver) {
        return respond({ error: "Student not found." }, 404);
      }

      await env.DB.prepare(`
        INSERT INTO student_messages
        (sender_id, receiver_id, message)
        VALUES (?, ?, ?)
      `).bind(student.id, receiverId, message).run();

      return respond({
        success: true,
        message: "Private message sent successfully."
      });
    }

    // Get messages without automatically marking them as read
    const results = await env.DB.prepare(`
      SELECT
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message,
        m.created_at,
        m.read_at,
        sender.full_name AS sender_name,
        receiver.full_name AS receiver_name
      FROM student_messages m
      JOIN students sender ON sender.id = m.sender_id
      JOIN students receiver ON receiver.id = m.receiver_id
      WHERE m.sender_id = ? OR m.receiver_id = ?
      ORDER BY m.created_at ASC
      LIMIT 500
    `).bind(student.id, student.id).all();

    // Count unread messages
    const unread = await env.DB.prepare(`
      SELECT COUNT(*) AS unread_count
      FROM student_messages
      WHERE receiver_id = ?
      AND read_at IS NULL
    `).bind(student.id).first();

    return respond({
      success: true,
      messages: results.results || [],
      unread_count: Number(unread?.unread_count || 0)
    });

  } catch (error) {
    return respond({
      error: "Messaging service error."
    }, 500);
  }
}