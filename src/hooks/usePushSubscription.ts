/**
 * usePushSubscription — gestão de Web Push no cliente.
 *
 * Responsabilidades:
 *  1. Registrar o Service Worker (public/sw.js)
 *  2. Solicitar permissão de notificação ao usuário
 *  3. Subscrever ao PushManager com a VAPID public key
 *  4. Persistir o endpoint/keys no banco (push_subscriptions)
 *  5. Limpar a subscription ao fazer logout
 *
 * Suporte:
 *  - iOS 16.4+ (PWA instalado na tela inicial)
 *  - Android Chrome / Firefox / Edge (qualquer versão recente)
 *  - Desktop Chrome / Firefox / Edge
 *
 * REQUISITO iOS: O usuário deve ter adicionado o app à tela inicial ("Add to Home Screen").
 * Safari no iOS não suporta Push para sites não instalados como PWA.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { VAPID_PUBLIC_KEY } from '@/lib/pushConfig';
import { captureException } from '@/lib/sentry';
import { toast } from 'sonner';

// ── Helpers ──────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Verifica se a subscription foi criada com o VAPID_PUBLIC_KEY atual.
 *
 * Após rotação de chaves VAPID, subscriptions antigas têm um applicationServerKey
 * diferente e serão rejeitadas com 403 pelo APNs/FCM. Detectar aqui no cliente
 * permite recriar silenciosamente antes de qualquer tentativa de envio.
 *
 * applicationServerKey é ArrayBuffer; VAPID_PUBLIC_KEY é string base64url.
 */
function vapidKeyMatches(sub: PushSubscription): boolean {
  const keyBuffer = sub.options?.applicationServerKey;
  if (!keyBuffer) return false;
  // Normaliza ArrayBuffer ou ArrayBufferView para Uint8Array
  const bytes =
    keyBuffer instanceof ArrayBuffer
      ? new Uint8Array(keyBuffer)
      : new Uint8Array((keyBuffer as ArrayBufferView).buffer);
  if (bytes.length === 0) return false;
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  const base64url = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return base64url === VAPID_PUBLIC_KEY;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export interface UsePushSubscriptionReturn {
  permission: PushPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  requestPermissionAndSubscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePushSubscription(): UsePushSubscriptionReturn {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  // ── Register SW + read initial state ─────────────────────────────────────
  useEffect(() => {
    if (!isPushSupported()) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission as PushPermission);

    // Register the Service Worker if not already registered
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(async (reg) => {
        swRegRef.current = reg;

        // Check if already subscribed
        const existingSub = await reg.pushManager.getSubscription();
        if (existingSub) {
          if (!vapidKeyMatches(existingSub)) {
            // VAPID key rotation: esta subscription foi criada com uma chave antiga.
            // Fazer unsubscribe aqui para que o terceiro useEffect (user login)
            // recrie a subscription com a chave correta assim que o usuário estiver disponível.
            try {
              await existingSub.unsubscribe();
            } catch (err) {
              captureException(err, { context: 'push_unsubscribe_stale_on_mount' });
            }
          } else {
            setIsSubscribed(true);
            setPermission('granted');
            // Ensure the subscription is still in our DB (handles reinstalls)
            await syncSubscriptionToDb(existingSub);
          }
        }
      })
      .catch((err) => {
        captureException(err, { context: 'sw_register' });
      });
  }, []);

  // ── Sync subscription to Supabase DB ─────────────────────────────────────
  const syncSubscriptionToDb = useCallback(
    async (sub: PushSubscription) => {
      if (!user) return;
      const subJson = sub.toJSON();
      if (!subJson.endpoint || !subJson.keys) return;

      try {
        // IMPORTANTE: supabase.from().upsert() não lança exceção em erros de RLS ou constraint.
        // É necessário verificar { error } explicitamente — o catch abaixo captura apenas
        // exceções JavaScript (ex: rede), não erros da API Supabase.
        const { error } = await supabase.from('push_subscriptions').upsert(
          {
            user_id: user.id,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
            user_agent: navigator.userAgent.slice(0, 500),
            // is_active: true must be explicit — upsert does not overwrite columns
            // omitted from payload. If a subscription was set to is_active=false
            // (e.g. after APNs 410 cleanup), this restores it so crons can send again.
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,endpoint' }
        );
        if (error) {
          captureException(new Error(error.message), {
            context: 'push_subscription_sync',
            errorCode: error.code,
          });
        }
      } catch (err) {
        captureException(err, { context: 'push_subscription_sync' });
      }
    },
    [user]
  );

  // ── Ouvir mensagem do SW quando pushsubscriptionchange é disparado ───────
  // O SW tenta re-assinar e envia a nova subscription via postMessage.
  // Recebemos aqui e sincronizamos ao Supabase sem precisar que o usuário abra Ajustes.
  useEffect(() => {
    if (!user || !isPushSupported()) return;

    const handleSwMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED' && event.data.subscription) {
        // SW conseguiu re-assinar — sincronizar ao banco
        try {
          const reg = await navigator.serviceWorker.getRegistration('/');
          const activeSub = reg ? await reg.pushManager.getSubscription() : null;
          if (activeSub) {
            await syncSubscriptionToDb(activeSub);
            setIsSubscribed(true);
          }
        } catch (err) {
          captureException(err, { context: 'push_subscription_change_sync' });
        }
      } else if (event.data?.type === 'PUSH_SUBSCRIPTION_LOST') {
        // SW não conseguiu re-assinar — marcar como não inscrito para UX
        setIsSubscribed(false);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [user, syncSubscriptionToDb]);

  // ── Re-sync subscription when user signs in ──────────────────────────────
  // After signOut, useAuth deletes the DB row. On re-login the PushManager
  // subscription still exists in the browser but is gone from the DB, so
  // crons can't deliver notifications until the user visits Notificações.
  // This effect re-syncs on every user identity change (null → user after OAuth).
  //
  // Auto-resubscribe: iOS periodically revokes push subscriptions (device reboot,
  // OS update, or natural APNs endpoint expiration). When this happens,
  // PushManager.getSubscription() returns null even though Notification.permission
  // is still 'granted'. We auto-resubscribe silently — no user gesture needed
  // when permission was already granted.
  useEffect(() => {
    if (!user || !isPushSupported()) return;

    navigator.serviceWorker.getRegistration('/').then(async (reg) => {
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        if (!vapidKeyMatches(sub)) {
          // VAPID key rotation: subscription existente usa chave antiga.
          // Unsubscribe + re-subscribe com a chave atual silenciosamente.
          // Sem isso, o servidor enviaria com a nova chave e o APNs/FCM retornaria 403.
          try {
            await sub.unsubscribe();
            await navigator.serviceWorker.ready;
            const newSub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
            });
            await syncSubscriptionToDb(newSub);
            setIsSubscribed(true);
          } catch (err) {
            captureException(err, { context: 'push_resubscribe_after_key_rotation' });
          }
        } else {
          setIsSubscribed(true);
          await syncSubscriptionToDb(sub);
        }
      } else if (Notification.permission === 'granted') {
        // Subscription was revoked by iOS but permission is still granted.
        // Re-subscribe automatically without requiring a user gesture.
        try {
          await navigator.serviceWorker.ready;
          const newSub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
          });
          await syncSubscriptionToDb(newSub);
          setIsSubscribed(true);
        } catch (err) {
          // Non-critical: fails silently. User can re-enable manually in Ajustes → Notificações.
          captureException(err, { context: 'push_auto_resubscribe' });
        }
      }
    }).catch(() => { /* non-critical */ });
  }, [user, syncSubscriptionToDb]);

  // ── Remove subscription from DB ────────────────────────────────────────────
  const removeSubscriptionFromDb = useCallback(
    async (endpoint: string) => {
      if (!user) return;
      try {
        await supabase.from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', endpoint);
      } catch (err) {
        captureException(err, { context: 'push_subscription_remove' });
      }
    },
    [user]
  );

  // ── Request permission + subscribe ────────────────────────────────────────
  const requestPermissionAndSubscribe = useCallback(async () => {
    if (!isPushSupported()) {
      toast.warning('Seu dispositivo não suporta notificações push.');
      return;
    }
    if (!user) return;

    setIsLoading(true);
    try {
      // 1. Ensure SW is registered
      let reg = swRegRef.current;
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        swRegRef.current = reg;
      }
      await navigator.serviceWorker.ready;

      // 2. Request Notification permission (must be in response to user gesture on iOS)
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);

      if (perm !== 'granted') {
        toast.warning(
          perm === 'denied'
            ? 'Notificações bloqueadas. Ative nas configurações do dispositivo.'
            : 'Permissão negada. Ative nas configurações do app.'
        );
        return;
      }

      // 3. Subscribe via PushManager (VAPID)
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true, // Required — cannot send silent notifications
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      // 4. Persist to Supabase
      await syncSubscriptionToDb(subscription);
      setIsSubscribed(true);
      toast.success('Notificações ativadas! 🔔');
    } catch (err) {
      captureException(err, { context: 'push_subscribe' });
      toast.error('Não foi possível ativar as notificações. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [user, syncSubscriptionToDb]);

  // ── Unsubscribe ───────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = swRegRef.current ?? (await navigator.serviceWorker.getRegistration('/'));
      if (!reg) return;

      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removeSubscriptionFromDb(sub.endpoint);
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      toast.success('Notificações desativadas.');
    } catch (err) {
      captureException(err, { context: 'push_unsubscribe' });
      toast.error('Erro ao desativar notificações.');
    } finally {
      setIsLoading(false);
    }
  }, [removeSubscriptionFromDb]);

  return { permission, isSubscribed, isLoading, requestPermissionAndSubscribe, unsubscribe };
}
