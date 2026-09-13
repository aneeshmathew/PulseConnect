import { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, Trash2, MoreHorizontal, Check, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { RSVP_TO_EVENT, CANCEL_RSVP, DELETE_EVENT } from '@/lib/graphql';
import { Avatar } from '@/components/UI/Avatar';
import { useAuthStore } from '@/store';
import { cn } from '@/utils';

// Same day/time formatting used across the card and the detail view —
// deliberately not `formatDate`/`timeAgo` from utils, since an event's
// start time is a future-facing fact ("Sat, Oct 3 · 6:00 PM"), not a
// relative "posted 2h ago" timestamp the rest of the app uses for content.
function formatEventDateTime(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

interface EventCardProps {
  event: any;
  onDeleted?: (id: string) => void;
}

export function EventCard({ event, onDeleted }: EventCardProps) {
  const { user: currentUser } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const isHost = currentUser?.id === event.host?.id;
  const myRsvp = event.myRsvp;

  const [rsvpToEvent, { loading: rsvping }] = useMutation(RSVP_TO_EVENT);
  const [cancelRsvp, { loading: cancelling }] = useMutation(CANCEL_RSVP);
  const [deleteEvent, { loading: deleting }] = useMutation(DELETE_EVENT);

  const busy = rsvping || cancelling;

  const handleRsvp = useCallback(
    async (status: 'GOING' | 'INTERESTED') => {
      if (busy) return;
      try {
        if (myRsvp === status) await cancelRsvp({ variables: { eventId: event.id } });
        else await rsvpToEvent({ variables: { eventId: event.id, status } });
      } catch {
        toast.error('Something went wrong');
      }
    },
    [busy, myRsvp, event.id, rsvpToEvent, cancelRsvp]
  );

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    if (!window.confirm("Delete this event? This can't be undone.")) return;
    try {
      await deleteEvent({ variables: { id: event.id } });
      onDeleted?.(event.id);
      toast.success('Event deleted');
    } catch {
      toast.error('Could not delete event');
    }
  }, [deleting, deleteEvent, event.id, onDeleted]);

  return (
    <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark overflow-hidden flex flex-col">
      <Link to={`/event/${event.id}`} className="block relative aspect-[2/1] bg-gray-100 dark:bg-surface-dark-3">
        {event.coverImage ? (
          <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Calendar size={32} className="text-gray-300 dark:text-gray-600" />
          </div>
        )}
      </Link>

      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/event/${event.id}`}>
              <h3 className="font-bold text-gray-900 dark:text-white leading-snug truncate hover:underline">
                {event.title}
              </h3>
            </Link>
            <p className="text-sm font-semibold text-brand-500 mt-0.5">{formatEventDateTime(event.startAt)}</p>
          </div>

          {isHost && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowMenu((v) => !v)}
                aria-label="Event options"
                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors"
              >
                <MoreHorizontal size={18} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-surface-dark-2 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-10">
                  <button
                    onClick={() => { setShowMenu(false); handleDelete(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors"
                  >
                    <Trash2 size={14} /> Delete event
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {event.location && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <MapPin size={14} className="flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <Users size={14} className="flex-shrink-0" />
          <span>
            {event.goingCount} going{event.interestedCount > 0 ? ` · ${event.interestedCount} interested` : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <Avatar src={event.host?.avatar} name={event.host?.fullName ?? ''} size="xs" />
          <span className="text-xs text-gray-400 truncate">Hosted by {event.host?.fullName}</span>
        </div>

        <div className="flex items-center gap-2 mt-auto pt-2">
          <button
            onClick={() => handleRsvp('GOING')}
            disabled={busy}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50',
              myRsvp === 'GOING'
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : 'bg-gray-100 dark:bg-surface-dark-3 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            <Check size={14} /> Going
          </button>
          <button
            onClick={() => handleRsvp('INTERESTED')}
            disabled={busy}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50',
              myRsvp === 'INTERESTED'
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : 'bg-gray-100 dark:bg-surface-dark-3 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            <Star size={14} /> Interested
          </button>
        </div>
      </div>
    </div>
  );
}
