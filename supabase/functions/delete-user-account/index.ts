import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * delete-user-account — Edge Function (Art. 18-IV LGPD)
 *
 * Deletes ALL data belonging to a user:
 *   1. Storage files  (exam-files, receitas, vaccine_documents, avatars)
 *   2. Asaas subscription (best-effort cancel before deleting from DB)
 *   3. DB records     (notifications, ai_usage_logs, email_send_log, subscriptions,
 *                      family_members → CASCADE to all clinical tables,
 *                      family_group_members, family_groups, group_invites, user_roles)
 *   4. auth.users     (last step — invalidates all tokens immediately)
 *
 * Admin path: deletes the entire family group and every member in it.
 * Member path: deletes only the member's own data; removes from family group.
 */

// A1: CORS restrito ao APP_ORIGIN
import { corsHeaders } from "../_shared/cors.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Lists and deletes every file under `prefix/` in `bucket`.
 * Supabase storage list() is paginated at 100 items — we loop until done.
 */
async function deleteStorageFolder(
  client: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string
) {
  let offset = 0;
  const limit = 100;
  while (true) {
    const { data: files, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit, offset });

    if (error) {
      console.warn(`Storage list error (${bucket}/${prefix}):`, error.message);
      break;
    }
    if (!files || files.length === 0) break;

    // Handle nested folders recursively
    const nested = files.filter((f) => f.id === null); // folders have id=null
    for (const folder of nested) {
      await deleteStorageFolder(client, bucket, `${prefix}/${folder.name}`);
    }

    const filePaths = files
      .filter((f) => f.id !== null)
      .map((f) => `${prefix}/${f.name}`);

    if (filePaths.length > 0) {
      const { error: removeError } = await client.storage
        .from(bucket)
        .remove(filePaths);
      if (removeError) {
        console.warn(
          `Storage remove error (${bucket}):`,
          removeError.message,
          filePaths
        );
      } else {
        console.log(`Deleted ${filePaths.length} files from ${bucket}/${prefix}`);
      }
    }

    if (files.length < limit) break;
    offset += limit;
  }
}

/**
 * Avatars are stored as flat files (no user prefix).
 * Extract the path from avatar_url stored in family_members.
 */
async function deleteAvatarFiles(
  client: ReturnType<typeof createClient>,
  memberIds: string[]
) {
  if (memberIds.length === 0) return;

  const { data: members } = await client
    .from("family_members")
    .select("avatar_url")
    .in("id", memberIds)
    .not("avatar_url", "is", null);

  if (!members || members.length === 0) return;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const paths: string[] = [];

  for (const m of members as { avatar_url: string | null }[]) {
    if (!m.avatar_url) continue;
    // Extract filename from URL:
    // https://<project>.supabase.co/storage/v1/object/public/avatars/<filename>
    // or signed URL pattern with /sign/ path
    const match = m.avatar_url.match(/\/avatars\/([^?#]+)/);
    if (match) paths.push(match[1]);
  }

  if (paths.length > 0) {
    const { error } = await client.storage.from("avatars").remove(paths);
    if (error) {
      console.warn("Avatar remove error:", error.message, paths);
    } else {
      console.log(`Deleted ${paths.length} avatar(s)`);
    }
  }
}

/**
 * Cancel Asaas subscription if one exists and is active/past_due.
 * Best-effort — never throws. DB record is deleted separately.
 */
async function cancelAsaasSubscription(
  client: ReturnType<typeof createClient>,
  userId: string
) {
  try {
    const { data: sub } = await client
      .from("subscriptions")
      .select("asaas_subscription_id, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (!sub?.asaas_subscription_id) return;
    if (sub.status === "canceled") return; // already canceled

    const asaasApiUrl = Deno.env.get("ASAAS_API_URL");
    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiUrl || !apiKey) {
      console.warn("ASAAS_API_URL or ASAAS_API_KEY not configured — skipping Asaas cancel");
      return;
    }

    const res = await fetch(
      `${asaasApiUrl}/subscriptions/${sub.asaas_subscription_id}`,
      {
        method: "DELETE",
        headers: { accept: "application/json", access_token: apiKey },
      }
    );

    if (res.ok) {
      console.log("Asaas subscription canceled:", sub.asaas_subscription_id);
    } else {
      const body = await res.text();
      console.warn("Asaas cancel failed (non-blocking):", res.status, body);
    }
  } catch (err) {
    console.warn("Asaas cancel error (non-blocking):", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // ── 1. AUTH ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userData, error: authError } =
      await serviceClient.auth.getUser(token);
    if (authError || !userData.user?.id) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email ?? null;
    console.log(`delete-user-account: starting for user ${userId}`);

    // ── 2. DETERMINE ROLE ────────────────────────────────────────────────────
    const { data: groupMember } = await serviceClient
      .from("family_group_members")
      .select("group_id, role")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const isGroupAdmin = groupMember?.role === "admin";
    const groupId: string | null = groupMember?.group_id ?? null;

    // Collect family_member IDs to delete (for avatar cleanup before cascade)
    let memberIds: string[] = [];
    if (isGroupAdmin && groupId) {
      const { data: allMembers } = await serviceClient
        .from("family_members")
        .select("id")
        .eq("group_id", groupId);
      memberIds = (allMembers ?? []).map((m: { id: string }) => m.id);
    } else {
      const { data: myMember } = await serviceClient
        .from("family_members")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (myMember) memberIds = [myMember.id];
    }

    console.log(`Role: ${isGroupAdmin ? "group admin" : "member"} | members to delete: ${memberIds.length}`);

    // ── 3. STORAGE ───────────────────────────────────────────────────────────
    // Buckets with user-scoped folders (userId/ prefix)
    for (const bucket of ["exam-files", "receitas", "vaccine_documents"]) {
      await deleteStorageFolder(serviceClient, bucket, userId);
    }
    // Avatars: flat filenames, must look up from DB before deleting members
    await deleteAvatarFiles(serviceClient, memberIds);

    // ── 4. CANCEL ASAAS (best-effort, before DB delete) ─────────────────────
    await cancelAsaasSubscription(serviceClient, userId);

    // ── 5. DELETE EXPLICIT TABLE RECORDS ─────────────────────────────────────
    // Tables with user_id column — delete regardless of admin/member role
    const userTables = [
      "notifications",
      "ai_usage_logs",
      "email_send_log",
      "subscriptions",
    ] as const;

    for (const table of userTables) {
      const { error } = await serviceClient
        .from(table as any)
        .delete()
        .eq("user_id", userId);
      if (error) console.warn(`Delete error (${table}):`, error.message);
      else console.log(`Deleted ${table} rows for user ${userId}`);
    }

    // ── 6. DELETE FAMILY DATA (admin vs member) ───────────────────────────────
    if (isGroupAdmin && groupId) {
      // Admin: delete the entire group's family_members
      // → ON DELETE CASCADE removes all clinical data automatically
      const { error: fmErr } = await serviceClient
        .from("family_members")
        .delete()
        .eq("group_id", groupId);
      if (fmErr) console.warn("family_members delete error:", fmErr.message);
      else console.log(`Deleted all family_members for group ${groupId}`);

      // Delete all family_group_members for this group
      const { error: fgmErr } = await serviceClient
        .from("family_group_members")
        .delete()
        .eq("group_id", groupId);
      if (fgmErr) console.warn("family_group_members delete error:", fgmErr.message);

      // Delete the family group itself
      const { error: fgErr } = await serviceClient
        .from("family_groups")
        .delete()
        .eq("id", groupId);
      if (fgErr) console.warn("family_groups delete error:", fgErr.message);
      else console.log(`Deleted family_group ${groupId}`);
    } else {
      // Member: delete only own family_member(s)
      // → ON DELETE CASCADE handles clinical data
      if (memberIds.length > 0) {
        const { error: fmErr } = await serviceClient
          .from("family_members")
          .delete()
          .in("id", memberIds);
        if (fmErr) console.warn("family_members delete error:", fmErr.message);
        else console.log(`Deleted ${memberIds.length} family_member(s)`);
      }

      // Remove from family_group_members
      const { error: fgmErr } = await serviceClient
        .from("family_group_members")
        .delete()
        .eq("auth_user_id", userId);
      if (fgmErr) console.warn("family_group_members delete error:", fgmErr.message);
    }

    // ── 7. CLEAN UP REMAINING RECORDS ────────────────────────────────────────
    // Pending invites sent to this user's email
    if (userEmail) {
      await serviceClient
        .from("group_invites")
        .delete()
        .eq("email", userEmail);
    }

    // User role
    await serviceClient
      .from("user_roles")
      .delete()
      .eq("id", userId);

    console.log(`delete-user-account: DB cleanup complete for user ${userId}`);

    // ── 8. DELETE AUTH USER — LAST STEP ──────────────────────────────────────
    // This invalidates all tokens immediately.
    // Must be the final operation — after this, the JWT is revoked.
    const { error: deleteUserError } =
      await serviceClient.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error("auth.admin.deleteUser failed:", deleteUserError.message);
      return json(
        { error: "Conta parcialmente removida. Entre em contato com o suporte." },
        500
      );
    }

    console.log(`delete-user-account: auth user ${userId} deleted successfully`);
    return json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    console.error("delete-user-account unexpected error:", message);
    return json({ error: message }, 500);
  }
});
