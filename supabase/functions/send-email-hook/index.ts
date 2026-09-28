// supabase/functions/send-email-hook/index.ts
//
// Supabase Auth's "Send Email" hook: instead of Supabase relaying through
// SMTP (which turned out unreliable to diagnose against Resend's relay from
// Supabase's own infrastructure), Supabase POSTs the email content here and
// *we* send it via Resend's HTTP API directly — the same API call already
// confirmed working independently of this hook.
//
// Configured as an HTTP hook, signed per the Standard Webhooks spec:
// headers webhook-id / webhook-timestamp / webhook-signature, verified below
// using the same shared secret set as HOOK_SECRET and in Supabase's
// hook_send_email_secrets.

async function verifySignature(rawBody: string, headers: Headers, secret: string) {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) throw new Error("Missing webhook signature headers");

  // Supabase stores this as "v1,whsec_<base64>" — only the part after the
  // last "whsec_" is the actual key material.
  const rawSecret = secret.slice(secret.lastIndexOf("whsec_") + "whsec_".length);
  const secretBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0));
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));

  // webhook-signature can list multiple "v1,<sig>" candidates space-separated.
  const candidates = signatureHeader.split(" ").map((s) => s.split(",")[1]);
  if (!candidates.includes(expected)) throw new Error("Signature mismatch");
}

function buildEmail(email_data: any) {
  const { token, token_hash, redirect_to, email_action_type, site_url } = email_data;
  const confirmationUrl = `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to)}`;

  if (email_action_type === "signup" || email_action_type === "email_change") {
    return {
      subject: email_action_type === "signup" ? "Confirm your email address" : "Confirm your new email address",
      html: `<h2>Confirm your email address</h2>
        <p>Enter this code in Rentify to verify your email:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:6px;">${token}</p>
        <p>Or use the link below instead:</p>
        <p><a href="${confirmationUrl}">Confirm email address</a></p>
        <p>This code expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
    };
  }

  if (email_action_type === "recovery") {
    return {
      subject: "Reset your password",
      html: `<h2>Reset your password</h2>
        <p>We received a request to reset your password. Follow the link below to choose a new one.</p>
        <p><a href="${confirmationUrl}">Reset password</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>`,
    };
  }

  if (email_action_type === "magiclink") {
    return {
      subject: "Your sign-in link",
      html: `<h2>Your sign-in link</h2><p><a href="${confirmationUrl}">Sign in to Rentify</a></p>`,
    };
  }

  return {
    subject: "Your verification code",
    html: `<h2>Your verification code</h2><p style="font-size:28px;font-weight:bold;letter-spacing:6px;">${token}</p>`,
  };
}

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    await verifySignature(rawBody, req.headers, Deno.env.get("SEND_EMAIL_HOOK_SECRET")!);

    const payload = JSON.parse(rawBody);
    const { user, email_data } = payload;
    const { subject, html } = buildEmail(email_data);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rentify <noreply@rentify.click>",
        to: user.email,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend send failed: ${errText}`);
    }

    return new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    // Auth hooks expect { error: { http_code, message } } on failure.
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: e.message } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
