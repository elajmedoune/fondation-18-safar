import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2, X, Info, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth.js';
import { notificationsService } from '../../services/notifications.service.js';
import { supabase } from '../../lib/supabaseClient.js';

const TYPE_ICONS = {
  info: { icon: Info, color: 'text-blue-500' },
  success: { icon: CheckCircle2, color: 'text-green-500' },
  warning: { icon: AlertTriangle, color: 'text-amber-500' },
  action: { icon: Zap, color: 'text-purple-500' },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 8 });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notif-count', user?.id],
    queryFn: () => notificationsService.countUnread(user.id),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => notificationsService.listByUser(user.id, { limit: 30 }),
    enabled: !!user?.id && open,
  });

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      setPos({ top: 0, right: 0 });
    } else {
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('notif-bell')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notif-count', user.id] });
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notif-count', user.id] });
    queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
  };

  const handleMarkRead = async (id) => { await notificationsService.markRead(id); invalidate(); };
  const handleMarkAllRead = async () => { await notificationsService.markAllRead(user.id); invalidate(); };
  const handleDelete = async (id) => { await notificationsService.remove(id); invalidate(); };
  const handleDeleteAll = async () => {
    if (!confirm('Supprimer toutes les notifications ?')) return;
    await notificationsService.removeAll(user.id); invalidate();
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Notifications"
      >
        <Bell className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white min-w-[18px] px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed z-[100] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-2xl shadow-gray-200/50 dark:shadow-black/30 overflow-hidden border border-gray-200/70 dark:border-gray-800"
          style={isMobile
            ? { inset: 0, borderRadius: 0, maxHeight: '100vh' }
            : { top: pos.top, right: pos.right, width: 384, borderRadius: 16, maxHeight: '28rem' }
          }
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" title="Tout marquer lu">
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={handleDeleteAll} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Supprimer tout">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="overflow-y-auto" style={{ maxHeight: isMobile ? 'calc(100vh - 52px)' : '24rem' }}>
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Aucune notification</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {notifications.map((n) => {
                  const config = TYPE_ICONS[n.type] || TYPE_ICONS.info;
                  const Icon = config.icon;
                  return (
                    <li key={n.id} className={`px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors ${!n.lu ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 shrink-0 ${config.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium truncate ${!n.lu ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{n.titre}</p>
                            {!n.lu && <span className="h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {!n.lu && (
                            <button onClick={() => handleMarkRead(n.id)} className="p-1 rounded text-gray-400 hover:text-green-600 transition-colors" title="Marquer lu">
                              <Check className="h-3 w-3" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(n.id)} className="p-1 rounded text-gray-400 hover:text-red-600 transition-colors" title="Supprimer">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
