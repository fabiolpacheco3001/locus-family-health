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
export const VAPID_PUBLIC_KEY =
  'BPc1Jl-B2jTYy5YJ9AARFRn26z4u8NHtnvglFkipZC_Ho1sbKDmhcJUPnJ58TeiIrifdGyWmAfEvOjYpZ60iFW4';

/** Contact email sent in VAPID header (required by some push services) */
export const VAPID_SUBJECT = 'mailto:suporte@locustech.com.br';
