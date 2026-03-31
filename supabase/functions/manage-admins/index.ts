import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action } = body;

    // ── LIST EMAILS (batch) ──
    if (action === "list-emails") {
      const { userIds } = body;
      if (!Array.isArray(userIds)) return json({ error: "userIds required" }, 400);
      const emails: { id: string; email: string }[] = [];
      for (const uid of userIds) {
        try {
          const { data: { user } } = await adminClient.auth.admin.getUserById(uid);
          if (user?.email) emails.push({ id: uid, email: user.email });
        } catch { /* skip */ }
      }
      return json({ emails });
    }

    // ── LIST ──
    if (action === "list") {
      const { data: roles, error: rolesErr } = await adminClient
        .from("user_roles")
        .select("id, role, created_at")
        .in("role", ["admin", "super_admin"]);

      if (rolesErr) throw rolesErr;

      const admins = [];
      for (const role of roles || []) {
        const { data: { user } } = await adminClient.auth.admin.getUserById(role.id);
        admins.push({
          id: role.id,
          email: user?.email ?? "—",
          role: role.role,
          created_at: role.created_at,
        });
      }

      return json({ admins });
    }

    // ── MUTATIONS: super_admin only ──
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (callerRole?.role !== "super_admin") {
      return json({ error: "Apenas Super Admins podem alterar cargos." }, 403);
    }

    // ── PROMOTE ──
    if (action === "promote") {
      const { email } = body;
      if (!email) return json({ error: "E-mail obrigatório." }, 400);

      // Find user by email
      const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
      if (listErr) throw listErr;

      const target = users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (!target) {
        return json({ error: "Nenhum usuário encontrado com esse e-mail." }, 404);
      }

      // Check if already admin
      const { data: existing } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("id", target.id)
        .maybeSingle();

      if (existing?.role === "admin" || existing?.role === "super_admin") {
        return json({ error: "Este usuário já é administrador." }, 409);
      }

      if (existing) {
        await adminClient
          .from("user_roles")
          .update({ role: "admin" })
          .eq("id", target.id);
      } else {
        await adminClient
          .from("user_roles")
          .insert({ id: target.id, role: "admin" });
      }

      return json({ success: true, email: target.email });
    }

    // ── CREATE ──
    if (action === "create") {
      const { email, password, role } = body;
      if (!email || !password) return json({ error: "E-mail e senha são obrigatórios." }, 400);
      if (!["admin", "super_admin"].includes(role)) return json({ error: "Cargo inválido." }, 400);
      if (password.length < 6) return json({ error: "A senha deve ter no mínimo 6 caracteres." }, 400);

      // Create user via Admin API (does NOT affect caller's session)
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createErr) {
        const msg = createErr.message?.includes("already been registered")
          ? "Este e-mail já está cadastrado."
          : createErr.message;
        return json({ error: msg }, 409);
      }

      // Insert role
      const { error: roleErr } = await adminClient
        .from("user_roles")
        .upsert({ id: newUser.user.id, role }, { onConflict: "id" });

      if (roleErr) {
        // Rollback: delete the created user
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        return json({ error: "Erro ao atribuir cargo. Usuário não foi criado." }, 500);
      }

      return json({ success: true, email: newUser.user.email });
    }

    // ── REVOKE ──
    if (action === "revoke") {
      const { userId } = body;
      if (!userId) return json({ error: "userId obrigatório." }, 400);

      // Prevent revoking super_admin
      const { data: targetRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (targetRole?.role === "super_admin") {
        return json({ error: "Não é possível revogar acesso de Super Admin." }, 403);
      }

      await adminClient
        .from("user_roles")
        .update({ role: "customer" })
        .eq("id", userId);

      return json({ success: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
