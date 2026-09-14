import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ArrowLeft, CalendarX, MapPin, Calendar, Users, Check, Star, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { GET_EVENT, RSVP_TO_EVENT, CANCEL_RSVP, DELETE_EVENT } from '@/lib/graphql';
import { AppLayout } from './Home';
import { Avatar } from '@/components/UI/Avatar';
import { useAuthStore } from '@/store';
import { cn } from '@/utils';

function formatEventDateTime(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const { data, loading, error } = useQuery(GET_EVENT, {
    variables: { id },
    skip: !id,
  });
  const [rsvpToEvent, { loading: rsvping }] = useMutation(RSVP_TO_EVENT);
  const [cancelRsvp, { loading: cancelling }] = useMutation(CANCEL_RSVP);
  const [deleteEvent, { loading: deleting }] = useMutation(DELETE_EVENT);

  const [showAllAttendees, setShowAllAttendees] = useState(false);

  const event = data?.event;
  const isHost = currentUser?.id === event?.host?.id;
  const myRsvp = event?.myRsvp;
  const busy = rsvping || cancelling;

  const handleRsvp = useCallback(
    async (status: 'GOING' | 'INTERESTED') => {
      if (busy || !event) return;
      try {
        if (myRsvp === status) await cancelRsvp({ variables: { eventId: event.id } });
        else await rsvpToEvent({ variables: { eventId: event.id, status } });
      } catch {
        toast.error('Something went wrong');
      }
    },
    [busy, event, myRsvp, rsvpToEvent, cancelRsvp]
  );

  const handleDelete = useCallback(async () => {
    if (deleting || !event) return;
    if (!window.confirm("Delete this event? This can't be undone.")) return;
    try {
      await deleteEvent({ variables: { id: event.id } });
      toast.success('Event deleted');
      navigate('/events');
    } catch {
      toast.error('Could not delete event');
    }
  }, [deleting, event, deleteEvent, navigate]);

  const attendees = event?.attendees ?? [];
  const going = attendees.filter((a: any) => a.status === 'GOING');
  const interested = attendees.filter((a: any) => a.status === 'INTERESTED');
  const visibleGoing = showAllAttendees ? going : going.slice(0, 10);

  return (
    <AppLayout>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {loading && (
        <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark overflow-hidden animate-pulse">
          <div className="h-56 w-full bg-gray-200 dark:bg-surface-dark-3" />
          <div className="p-5 space-y-3">
            <div className="h-5 w-2/3 bg-gray-200 dark:bg-surface-dark-3 rounded" />
            <div className="h-3 w-1/3 bg-gray-200 dark:bg-surface-dark-3 rounded" />
            <div className="h-3 w-1/2 bg-gray-200 dark:bg-surface-dark-3 rounded" />
          </div>
        </div>
      )}

      {!loading && (error || !event) && (
        <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark p-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center mb-4">
            <CalendarX size={24} className="text-gray-400" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">Event not found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
            This event may have been deleted, or you may not have permission to view it.
          </p>
          <Link
            to="/events"
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Back to Events
          </Link>
        </div>
      )}

      {!loading && event && (
        <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark overflow-hidden">
          <div className="relative aspect-[2.5/1] bg-gray-100 dark:bg-surface-dark-3">
            {event.coverImage ? (
              <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Calendar size={40} className="text-gray-300 dark:text-gray-600" />
              </div>
            )}
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{event.title}</h1>
                <p className="text-sm font-semibold text-brand-500 mt-1">{formatEventDateTime(event.startAt)}</p>
                {event.endAt && (
                  <p className="text-xs text-gray-400 mt-0.5">Ends {formatEventDateTime(event.endAt)}</p>
                )}
              </div>
              {isHost && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>

            {event.location && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <MapPin size={16} className="flex-shrink-0" />
                {event.location}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Avatar src={event.host?.avatar} name={event.host?.fullName ?? ''} size="sm" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Hosted by <span className="font-semibold text-gray-700 dark:text-gray-200">{event.host?.fullName}</span>
              </span>
            </div>

            {event.description && (
              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{event.description}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRsvp('GOING')}
                disabled={busy}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50',
                  myRsvp === 'GOING'
                    ? 'bg-brand-500 text-white hover:bg-brand-600'
                    : 'bg-gray-100 dark:bg-surface-dark-3 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                <Check size={16} /> Going
              </button>
              <button
                onClick={() => handleRsvp('INTERESTED')}
                disabled={busy}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50',
                  myRsvp === 'INTERESTED'
                    ? 'bg-brand-500 text-white hover:bg-brand-600'
                    : 'bg-gray-100 dark:bg-surface-dark-3 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                <Star size={16} /> Interested
              </button>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                <Users size={16} />
                {event.goingCount} going{event.interestedCount > 0 ? ` · ${event.interestedCount} interested` : ''}
              </div>

              {going.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-2">
                  {visibleGoing.map((a: any) => (
                    <Link
                      key={a.user.id}
                      to={`/profile/${a.user.username}`}
                      className="flex flex-col items-center gap-1 w-16 text-center"
                    >
                      <Avatar src={a.user.avatar} name={a.user.fullName} size="sm" />
                      <span className="text-xs text-gray-600 dark:text-gray-300 truncate w-full">
                        {a.user.firstName}
                      </span>
                    </Link>
                  ))}
                  {!showAllAttendees && going.length > 10 && (
                    <button
                      onClick={() => setShowAllAttendees(true)}
                      className="flex flex-col items-center justify-center w-16 text-xs font-semibold text-brand-500 hover:underline"
                    >
                      +{going.length - 10} more
                    </button>
                  )}
                </div>
              )}

              {going.length === 0 && interested.length === 0 && (
                <p className="text-sm text-gray-400">No responses yet — be the first to RSVP.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
