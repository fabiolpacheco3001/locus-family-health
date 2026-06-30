import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";

// ─── Resend API helper ────────────────────────────────────────────────────────
// Chama a Resend API diretamente via fetch (sem SDK) para manter zero deps extras.
// Requer secret RESEND_API_KEY configurado no Supabase Edge Functions.
//
// Domínio remetente: locustech.com.br
//   Para enviar de noreply@locustech.com.br, adicione o domínio no Resend dashboard:
//   https://resend.com/domains → Add Domain → locustech.com.br
//   (adicionar os registros DNS SPF/DKIM apontados pelo Resend).
//   Enquanto o domínio não estiver verificado, o Resend usa o e-mail de teste
//   onboarding@resend.dev como remetente (só funciona para o próprio dono da conta).
async function sendViaResend(params: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  apiKey: string;
}): Promise<{ id?: string; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: (body as { message?: string }).message ?? `HTTP ${res.status}` };
  }
  return { id: (body as { id?: string }).id };
}

// SEC-HTML: Escapar entidades HTML em valores controlados pelo usuário antes de interpolar
// no template de email. Previne injeção de tags/atributos HTML por atacantes que controlam
// nome de perfil ou nome do grupo.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * send-invite-email
 *
 * Enfileira um e-mail de convite para um membro recém-convidado via Gestão de Acessos.
 * Chamada logo após o INSERT em group_invites (ou no reenvio manual pelo admin).
 *
 * Body: { invite_id: string }
 *
 * Segurança:
 *  - Valida JWT (verify_jwt = true no config.toml)
 *  - Confirma que o caller é o `invited_by` do convite OU admin do grupo
 *  - Nunca expõe dados de outros grupos
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate user
    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !userData.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const { invite_id } = body as { invite_id?: string };
    if (!invite_id) {
      return new Response(JSON.stringify({ error: "invite_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch invite
    const { data: invite, error: inviteErr } = await serviceClient
      .from("group_invites")
      .select("id, email, group_id, invited_by, accepted_at, family_member_id")
      .eq("id", invite_id)
      .maybeSingle();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Convite não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.accepted_at) {
      return new Response(JSON.stringify({ error: "Convite já foi aceito" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize: caller must be invited_by OR admin of the group
    const isInviter = invite.invited_by === callerId;
    let isGroupAdmin = false;
    if (!isInviter) {
      const { data: membership } = await serviceClient
        .from("family_group_members")
        .select("role")
        .eq("group_id", invite.group_id)
        .eq("auth_user_id", callerId)
        .maybeSingle();
      isGroupAdmin = membership?.role === "admin";
    }
    if (!isInviter && !isGroupAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch group name
    const { data: group } = await serviceClient
      .from("family_groups")
      .select("name")
      .eq("id", invite.group_id)
      .maybeSingle();
    const groupName = group?.name ?? "sua família";

    // Fetch inviter's display name (first family_member linked to their account in this group)
    const { data: inviterMembership } = await serviceClient
      .from("family_group_members")
      .select("family_member_id")
      .eq("group_id", invite.group_id)
      .eq("auth_user_id", invite.invited_by ?? callerId)
      .maybeSingle();

    let inviterName = "Administrador";
    if (inviterMembership?.family_member_id) {
      const { data: fm } = await serviceClient
        .from("family_members")
        .select("name")
        .eq("id", inviterMembership.family_member_id)
        .maybeSingle();
      if (fm?.name) inviterName = fm.name.split(" ")[0];
    }

    // Resend API key — obrigatório: configurar em Supabase → Edge Functions → Secrets
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      log("error", "send_invite_email_missing_api_key", { invite_id });
      return new Response(JSON.stringify({ error: "Configuração de e-mail ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build email
    // appUrl: lido do secret APP_URL (ex: https://vita.locustech.com.br/home).
    // Configurar o path completo no secret — não hardcodar aqui.
    const appUrl = Deno.env.get("APP_URL") ?? "https://vita.locustech.com.br/home";
    const appStoreUrl = Deno.env.get("APPLE_STORE_URL") ?? "#"; // publicar nas lojas — roadmap
    const playStoreUrl = Deno.env.get("GOOGLE_PLAY_URL") ?? "#"; // publicar nas lojas — roadmap

    const safeEmail = invite.email;
    // SEC-HTML: sanitizar inviterName para evitar CRLF injection no header de email
    const safeInviterName = inviterName.replace(/[\r\n\t]/g, " ").slice(0, 100);
    const subject = `${safeInviterName} convidou você para o Locus Vita 💚`;

    const html = buildInviteEmailHtml({
      inviterName,
      groupName,
      email: safeEmail,
      appUrl,
      appStoreUrl,
      playStoreUrl,
    });

    const text = buildInviteEmailText({
      inviterName,
      groupName,
      email: safeEmail,
      appUrl,
    });

    // Envio direto via Resend (sem PGMQ — evita dependência do sistema de email da Lovable)
    // Remetente: noreply@locustech.com.br (requer domínio verificado no Resend dashboard)
    const { id: resendId, error: resendErr } = await sendViaResend({
      to: safeEmail,
      from: "Locus Vita <noreply@locustech.com.br>",
      subject,
      html,
      text,
      apiKey: resendApiKey,
    });

    if (resendErr) {
      log("error", "send_invite_email_resend_failed", { invite_id, to: safeEmail, error: resendErr });
      return new Response(JSON.stringify({ error: "Falha ao enviar e-mail" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("info", "send_invite_email_sent", { invite_id, to: safeEmail, resend_id: resendId });

    return new Response(JSON.stringify({ ok: true, resend_id: resendId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("error", "send_invite_email_unhandled", { error: String(err) });
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Email Templates ──────────────────────────────────────────────────────────

interface EmailVars {
  inviterName: string;
  groupName: string;
  email: string;
  appUrl: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
}

function buildInviteEmailHtml(v: EmailVars): string {
  // Escapar valores controlados pelo usuário (nome, grupo, email)
  // appUrl/appStoreUrl/playStoreUrl vêm de env vars — confiáveis, sem escaping
  const safe = {
    inviterName: escapeHtml(v.inviterName),
    groupName:   escapeHtml(v.groupName),
    email:       escapeHtml(v.email),
  };
  const storesSection = (v.appStoreUrl && v.appStoreUrl !== "#") || (v.playStoreUrl && v.playStoreUrl !== "#")
    ? `
      <p style="color:#4B5563;font-size:14px;margin:0 0 12px;">Ou baixe o aplicativo:</p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
        <tr>
          ${v.appStoreUrl && v.appStoreUrl !== "#" ? `<td style="padding-right:8px;">
            <a href="${v.appStoreUrl}" style="display:inline-block;background:#000;color:#fff;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;text-decoration:none;">
              🍎 App Store
            </a>
          </td>` : ""}
          ${v.playStoreUrl && v.playStoreUrl !== "#" ? `<td>
            <a href="${v.playStoreUrl}" style="display:inline-block;background:#078d4f;color:#fff;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;text-decoration:none;">
              ▶ Google Play
            </a>
          </td>` : ""}
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Convite Locus Vita</title></head>
<body style="margin:0;padding:0;background:#f2f0eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f0eb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1C3333;padding:32px 32px 24px;text-align:center;">
            <div style="font-size:26px;font-weight:800;color:#78C2AD;letter-spacing:-0.5px;">Locus Vita</div>
            <div style="font-size:12px;color:#78C2AD;opacity:0.7;margin-top:2px;letter-spacing:0.5px;">SAÚDE FAMILIAR</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;">
            <h1 style="color:#1C3333;font-size:20px;font-weight:700;margin:0 0 8px;">Você foi convidado! 🎉</h1>
            <p style="color:#4B5563;font-size:15px;line-height:1.6;margin:0 0 20px;">
              <strong>${v.inviterName}</strong> convidou você para acompanhar a saúde de <strong>${v.groupName}</strong> no Locus Vita.
            </p>

            <!-- CTA -->
            <div style="text-align:center;margin:24px 0;">
              <a href="${v.appUrl}" style="display:inline-block;background:#78C2AD;color:#1C3333;font-size:15px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;">
                Acessar o Locus Vita
              </a>
            </div>

            ${storesSection}

            <!-- Instructions -->
            <div style="background:#f8f7f4;border-radius:12px;padding:20px;margin:0 0 20px;">
              <p style="color:#1C3333;font-size:13px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">Como começar</p>
              <ol style="color:#4B5563;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
                <li>Acesse o aplicativo pelo botão acima</li>
                <li>Clique em <strong>Criar nova conta familiar</strong></li>
                <li>Use exatamente o e-mail abaixo para criar sua conta</li>
              </ol>
            </div>

            <!-- Email highlight -->
            <div style="background:#1C3333;border-radius:10px;padding:14px 20px;text-align:center;margin:0 0 20px;">
              <p style="color:#78C2AD;font-size:12px;font-weight:600;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Use este e-mail</p>
              <p style="color:#ffffff;font-size:16px;font-weight:700;margin:0;word-break:break-all;">${v.email}</p>
            </div>

            <p style="color:#9CA3AF;font-size:12px;line-height:1.5;margin:0;">
              ⚠️ Use <strong>exatamente este e-mail</strong> para garantir acesso ao plano familiar. Um e-mail diferente não terá acesso ao grupo.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f7f4;padding:20px 32px;text-align:center;border-top:1px solid #e5e3de;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">
              Locus Vita — Saúde Familiar Inteligente<br>
              <a href="https://locustech.com.br" style="color:#78C2AD;text-decoration:none;">locustech.com.br</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildInviteEmailText(v: EmailVars): string {
  return `Você foi convidado para o Locus Vita!

${v.inviterName} convidou você para acompanhar a saúde de ${v.groupName}.

Como começar:
1. Acesse o aplicativo em: ${v.appUrl}
2. Clique em "Criar nova conta familiar"
3. Use EXATAMENTE este e-mail: ${v.email}

IMPORTANTE: Use exatamente este e-mail para garantir acesso ao plano familiar.

---
Locus Vita — Saúde Familiar Inteligente
locustech.com.br
`;
}
