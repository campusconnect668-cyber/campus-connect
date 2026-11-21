
async function hashToken(token) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

async function getStudent(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(
    /(?:^|;\s*)student_session=([a-f0-9]{64})(?:;|$)/
  );

  if (!match) return null;

  const tokenHash = await hashToken(match[1]);

  return await env.DB.prepare(`
    SELECT students.id, students.full_name, students.email
    FROM student_sessions
    JOIN students ON students.id = student_sessions.student_id
    WHERE student_sessions.token_hash = ?
    AND student_sessions.expires_at > ?
  `).bind(tokenHash, new Date().toISOString()).first();
}

export async function onRequest({ request, env }) {
  try {
    if (!env.DB) {
      return respond({ success: false, error: "Database connection is missing." }, 500);
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return respond({ success: false, error: "Method not allowed." }, 405);
    }

    const student = await getStudent(request, env);

    if (!student) {
      return respond({ success: false, error: "Please log in first." }, 401);
    }

    // GET GROUPS OR GROUP MESSAGES
    if (request.method === "GET") {
      const url = new URL(request.url);
      const groupId = Number(url.searchParams.get("group_id"));

      if (groupId) {
        const membership = await env.DB.prepare(`
          SELECT role
          FROM chat_group_members
          WHERE group_id = ? AND student_id = ?
        `).bind(groupId, student.id).first();

        if (!membership) {
          return respond({ success: false, error: "You are not a member of this group." }, 403);
        }

        const group = await env.DB.prepare(`
          SELECT g.id, g.name, g.created_by, g.created_at,
                 s.full_name AS creator_name
          FROM chat_groups g
          JOIN students s ON s.id = g.created_by
          WHERE g.id = ?
        `).bind(groupId).first();

        if (!group) {
          return respond({ success: false, error: "Group not found." }, 404);
        }

        const membersResult = await env.DB.prepare(`
          SELECT s.id, s.full_name, s.email, m.role, m.joined_at
          FROM chat_group_members m
          JOIN students s ON s.id = m.student_id
          WHERE m.group_id = ?
          ORDER BY m.role DESC, s.full_name ASC
        `).bind(groupId).all();

        const messagesResult = await env.DB.prepare(`
          SELECT gm.id, gm.group_id, gm.sender_id, gm.message,
                 gm.created_at, s.full_name AS sender_name
          FROM chat_group_messages gm
          JOIN students s ON s.id = gm.sender_id
          WHERE gm.group_id = ?
          ORDER BY gm.id DESC
          LIMIT 500
        `).bind(groupId).all();

        return respond({
          success: true,
          group,
          role: membership.role,
          members: membersResult.results || [],
          messages: (messagesResult.results || []).reverse()
        });
      }

      const groupsResult = await env.DB.prepare(`
        SELECT
          g.id,
          g.name,
          g.created_by,
          g.created_at,
          s.full_name AS creator_name,
          m.role,
          (SELECT COUNT(*) FROM chat_group_members cm
           WHERE cm.group_id = g.id) AS member_count,
          (SELECT message FROM chat_group_messages gm
           WHERE gm.group_id = g.id
           ORDER BY gm.id DESC LIMIT 1) AS last_message
        FROM chat_group_members m
        JOIN chat_groups g ON g.id = m.group_id
        JOIN students s ON s.id = g.created_by
        WHERE m.student_id = ?
        ORDER BY g.id DESC
      `).bind(student.id).all();

      return respond({
        success: true,
        groups: groupsResult.results || []
      });
    }

    // POST ACTIONS
    const body = await request.json();
    const action = body.action;

    // CREATE GROUP
    if (action === "create") {
      const name = String(body.name || "").trim();

      if (name.length < 2 || name.length > 60) {
        return respond({
          success: false,
          error: "Group name must be between 2 and 60 characters."
        }, 400);
      }

      const result = await env.DB.prepare(`
        INSERT INTO chat_groups (name, created_by)
        VALUES (?, ?)
      `).bind(name, student.id).run();

      const groupId = result.meta.last_row_id;

      await env.DB.prepare(`
        INSERT INTO chat_group_members (group_id, student_id, role)
        VALUES (?, ?, 'admin')
      `).bind(groupId, student.id).run();

      return respond({
        success: true,
        message: "Group created successfully.",
        group_id: groupId
      });
    }

    // ADD MEMBER
    if (action === "add_member") {
      const groupId = Number(body.group_id);
      const studentId = Number(body.student_id);

      if (!groupId || !studentId) {
        return respond({ success: false, error: "Invalid group or student." }, 400);
      }

      const group = await env.DB.prepare(`
        SELECT created_by FROM chat_groups WHERE id = ?
      `).bind(groupId).first();

      if (!group || Number(group.created_by) !== Number(student.id)) {
        return respond({ success: false, error: "Only the group creator can add members." }, 403);
      }

      const existing = await env.DB.prepare(`
        SELECT id FROM chat_group_members
        WHERE group_id = ? AND student_id = ?
      `).bind(groupId, studentId).first();

      if (existing) {
        return respond({ success: false, error: "This student is already a member." }, 400);
      }

      const targetStudent = await env.DB.prepare(`
        SELECT id FROM students WHERE id = ?
      `).bind(studentId).first();

      if (!targetStudent) {
        return respond({ success: false, error: "Student not found." }, 404);
      }

      await env.DB.prepare(`
        INSERT INTO chat_group_members (group_id, student_id, role)
        VALUES (?, ?, 'member')
      `).bind(groupId, studentId).run();

      return respond({ success: true, message: "Member added successfully." });
    }

    // REMOVE MEMBER
    if (action === "remove_member") {
      const groupId = Number(body.group_id);
      const studentId = Number(body.student_id);

      const group = await env.DB.prepare(`
        SELECT created_by FROM chat_groups WHERE id = ?
      `).bind(groupId).first();

      if (!group || Number(group.created_by) !== Number(student.id)) {
        return respond({ success: false, error: "Only the group creator can remove members." }, 403);
      }

      if (studentId === Number(group.created_by)) {
        return respond({ success: false, error: "The group creator cannot be removed." }, 400);
      }

      await env.DB.prepare(`
        DELETE FROM chat_group_members
        WHERE group_id = ? AND student_id = ?
      `).bind(groupId, studentId).run();

      return respond({ success: true, message: "Member removed successfully." });
    }

    // SEND GROUP MESSAGE
    if (action === "send_message") {
      const groupId = Number(body.group_id);
      const message = String(body.message || "").trim();

      if (!groupId || !message || message.length > 5000) {
        return respond({ success: false, error: "Enter a message of up to 5000 characters." }, 400);
      }

      const membership = await env.DB.prepare(`
        SELECT id FROM chat_group_members
        WHERE group_id = ? AND student_id = ?
      `).bind(groupId, student.id).first();

      if (!membership) {
        return respond({ success: false, error: "You are not a member of this group." }, 403);
      }

      await env.DB.prepare(`
        INSERT INTO chat_group_messages (group_id, sender_id, message)
        VALUES (?, ?, ?)
      `).bind(groupId, student.id, message).run();

      return respond({ success: true, message: "Message sent successfully." });
    }

    return respond({ success: false, error: "Unknown action." }, 400);

  } catch (error) {
    return respond({
      success: false,
      error: error.message || "Something went wrong."
    }, 500);
  }
}
