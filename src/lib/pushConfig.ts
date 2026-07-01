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
// Histórico: em 21/06/2026 houve rotação (incidente VAPID_PRIVATE_KEY exposta).
// Em 01/07/2026 rotação completa do par — público e privado alinhados nos Secrets.
export const VAPID_PUBLIC_KEY =
  'BPiseS4YA78Jsx4f38jdzGBzMgf_d3vyLFw8uLLzYSHSz42bZUlUr8Y5FHWwZLLN6W85CxZhkuhcktJOuPLvAds';

/** Contact email sent in VAPID header (required by some push services) */
export const VAPID_SUBJECT = 'mailto:suporte@locustech.com.br';
