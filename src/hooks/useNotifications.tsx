import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useFamilyGroup } from "./useFamilyGroup";

export type Notification = {
  id: string;
  user_id: string;
  family_member_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean | null;
  action_url: string | null;
  scheduled_for: string;
  created_at: string | null;
};

export const useNotifications = () => {
  const { user } = useAuth();
  const { groupId, isAdmin, linkedMemberId, managedProfiles, isLoading: groupLoading } = useFamilyGroup();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", user?.id, groupId, isAdmin, linkedMemberId],
    queryFn: async () => {
      let q = supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (isAdmin && groupId) {
        // RLS handles group-level visibility; no user_id filter needed
        // But we still need some filter to scope — RLS does the work
      } else if (!isAdmin && linkedMemberId) {
        const allowedIds = [linkedMemberId, ...(managedProfiles || [])].filter(Boolean);
        q = q.in("family_member_id", allowedIds);
      } else {
        q = q.eq("user_id", user!.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user && !groupLoading,
    staleTime: 5 * 60 * 1000,
  });

  const unreadCount = (query.data ?? []).filter((n) => !n.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  const clearAllNotifications = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  return {
    notifications: query.data ?? [],
    unreadCount,
    isLoading: query.isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  };
};
