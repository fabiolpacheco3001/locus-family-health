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
          setIsSubscribed(true);
          setPermission('granted');
          // Ensure the subscription is still in our DB (handles reinstalls)
          await syncSubscriptionToDb(existingSub);
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
        await supabase.from('push_subscriptions').upsert(
          {
            user_id: user.id,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
            user_agent: navigator.userAgent.slice(0, 500),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,endpoint' }
        );
      } catch (err) {
        captureException(err, { context: 'push_subscription_sync' });
      }
    },
    [user]
  );

  // ── Remove subscription from DB ────────────────────────────────────────────
  const removeSubscriptionFromDb = useCallback(
    async (endpoint: string) => {
      if (!user) return;
      try {
        await supabase
          .from('push_subscriptions')
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
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
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
