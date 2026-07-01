/**
 * Push Notification configuration — VAPID public key.
 *
 * The private key counterpart (VAPID_PRIVATE_KEY) MUST be set as a
 * Supabase Secret in the Dashboard → Edge Functions → Secrets.
 * NEVER commit the private key.
 *
 * To regenerate keys (do this ONCE per project — rotation invalidates all subscriptions):
 *   node -e "
 *     const { webcrypto } = require('crypto');
 *     webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey','deriveBits'])
 *       .then(async kp => {
 *         const pub = await webcrypto.subtle.exportKey('raw', kp.publicKey);
 *         const jwk = await webcrypto.subtle.exportKey('jwk', kp.privateKey);
 *         console.log({ publicKey: Buffer.from(pub).toString('base64url'), privateKey: jwk.d });
 *       });
 *   "
 */
// DEVE corresponder ao VAPID_PUBLIC_KEY em Supabase Dashboard → Edge Functions → Secrets.
// Histórico: em 21/06/2026 houve rotação de chaves (incidente VAPID_PRIVATE_KEY exposta).
// Durante a rotação, duas chaves distintas foram geradas; a errada foi commitada no código.
// Alinhado com o Supabase Secrets em 01/07/2026.
export const VAPID_PUBLIC_KEY =
  'BNQueAzo503mMiNT_acJSV03vNbwTycwR1we08OuVIgQVV3RzMywT0ASp_0Vjq-f68gruGpFYyhWFu4EMdd7Olo';

/** Contact email sent in VAPID header (required by some push services) */
export const VAPID_SUBJECT = 'mailto:suporte@locustech.com.br';
