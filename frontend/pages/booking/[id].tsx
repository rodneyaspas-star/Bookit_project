import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';
import { toast } from 'react-toastify';

interface BookingDetails {
  id: number;
  status: string;
  customer_notes: string;
  rejection_reason: string | null;
  total_price: number;
  created_at: string;
  customer_id: number;
  business_owner_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  business_name: string;
  business_address: string;
  contact_info: string;
  service_name: string;
  service_description: string;
  duration: number;
  start_time: string | null;
  end_time: string | null;
  escrow_status: string;
  amount: number;
  simulated_at: string | null;
  held_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  released_to: string | null;
  has_review: boolean;
}

interface Transaction {
  action: string;
  from_state: string | null;
  to_state: string | null;
  amount: number | null;
  notes: string | null;
  created_at: string;
  actor_name: string;
}

interface Dispute {
  id: number;
  reason: string;
  status: string;
  admin_notes: string | null;
  opened_by_name?: string;
  created_at: string;
  resolved_at: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending_provider_approval: 'bg-yellow-100 text-yellow-800',
  awaiting_payment:          'bg-blue-100 text-blue-700',
  booked:                    'bg-indigo-100 text-indigo-800',
  awaiting_confirmation:     'bg-purple-100 text-purple-800',
  completed:                 'bg-green-100 text-green-800',
  disputed:                  'bg-orange-100 text-orange-800',
  cancelled:                 'bg-red-100 text-red-700',
  rejected:                  'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<string, string> = {
  pending_provider_approval: 'Awaiting Approval',
  awaiting_payment:          'Awaiting Payment',
  booked:                    'Booked',
  awaiting_confirmation:     'Awaiting Confirmation',
  completed:                 'Completed',
  disputed:                  'Disputed',
  cancelled:                 'Cancelled',
  rejected:                  'Rejected',
};

const LIFECYCLE_STEPS = [
  { key: 'pending_provider_approval', label: 'Requested' },
  { key: 'awaiting_payment',          label: 'Approved'  },
  { key: 'booked',                    label: 'Paid'      },
  { key: 'awaiting_confirmation',     label: 'In Progress' },
  { key: 'completed',                 label: 'Done'      },
];

function getLifecycleIndex(status: string): number {
  const map: Record<string, number> = {
    pending_provider_approval: 0,
    awaiting_payment:          1,
    booked:                    2,
    awaiting_confirmation:     3,
    disputed:                  3,
    completed:                 4,
  };
  return map[status] ?? -1;
}

export default function BookingDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [events, setEvents] = useState<Transaction[]>([]);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);

  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [acting, setActing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    try {
      const [bookingRes, escrowRes] = await Promise.all([
        api.get(`/bookings/${id}`),
        api.get(`/escrow/status/${id}`),
      ]);
      setBooking(bookingRes.data.booking);
      setEvents(escrowRes.data.events || []);
      setDispute(escrowRes.data.dispute || null);
    } catch {
      toast.error('Failed to load booking');
      router.push('/my-bookings');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (id) fetchAll();
  }, [id, fetchAll]);

  const act = async (label: string, fn: () => Promise<void>) => {
    setActing(true);
    try {
      await fn();
      await fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed: ${label}`);
    } finally {
      setActing(false);
    }
  };

  const handleAccept = () =>
    act('accept booking', async () => {
      await api.post(`/bookings/${id}/accept`);
      toast.success('Booking accepted — customer notified to pay');
    });

  const handleReject = () =>
    act('reject booking', async () => {
      await api.post(`/bookings/${id}/reject`, { reason: rejectReason.trim() || undefined });
      toast.success('Booking rejected');
      setShowRejectForm(false);
      setRejectReason('');
    });

  const handleSimulatePayment = () =>
    act('simulate payment', async () => {
      await api.post(`/payments/simulate/${id}`);
      toast.success('Payment simulated — funds held in escrow');
    });

  const handleRelease = () =>
    act('release escrow', async () => {
      await api.post(`/escrow/release/${id}`);
      toast.success('Payment released — booking complete');
    });

  const handleDispute = () =>
    act('open dispute', async () => {
      if (disputeReason.trim().length < 10)
        throw { response: { data: { error: 'Reason must be at least 10 characters' } } };
      await api.post(`/escrow/dispute/${id}`, { reason: disputeReason });
      toast.success('Dispute opened — admin will review');
      setShowDisputeForm(false);
    });

  const handleMarkComplete = () =>
    act('mark complete', async () => {
      await api.post(`/bookings/${id}/complete`);
      toast.success('Marked as complete — awaiting customer confirmation');
    });

  const handleCancel = () => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    act('cancel booking', async () => {
      await api.put(`/bookings/${id}/cancel`);
      toast.success('Booking cancelled');
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!booking) return null;

  const isCustomer = user?.id === booking.customer_id;
  const isProvider = user?.id === booking.business_owner_id;
  const showLifecycle = !['cancelled', 'rejected'].includes(booking.status);
  const lifecycleIndex = getLifecycleIndex(booking.status);

  return (
    <>
      <Head>
        <title>Booking #{booking.id} — BookIt</title>
      </Head>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-primary-600 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Booking #{booking.id}</h1>
              <p className="text-primary-100 text-sm mt-0.5">
                {booking.service_name} at {booking.business_name}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[booking.status] || 'bg-gray-100 text-gray-700'}`}>
              {STATUS_LABEL[booking.status] || booking.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>

          {/* Lifecycle progress bar */}
          {showLifecycle && (
            <div className="px-6 py-4 bg-gray-50 border-b">
              <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Booking Progress</p>
              <div className="flex items-center">
                {LIFECYCLE_STEPS.map((step, i) => {
                  const done      = i <= lifecycleIndex;
                  const current   = i === lifecycleIndex;
                  const isDisputed = booking.status === 'disputed' && i === 3;
                  const dotClass  = done
                    ? isDisputed
                      ? 'bg-red-500 border-red-500'
                      : 'bg-primary-600 border-primary-600'
                    : 'bg-white border-gray-300';
                  const ringClass = current
                    ? isDisputed ? 'ring-2 ring-red-300' : 'ring-2 ring-primary-300'
                    : '';
                  const labelClass = done
                    ? isDisputed ? 'text-red-600 font-medium' : 'text-primary-600 font-medium'
                    : 'text-gray-400';
                  const labelText = isDisputed ? 'Disputed' : step.label;
                  return (
                    <div key={step.key} className="flex-1 flex flex-col items-center">
                      <div className="flex items-center w-full">
                        {i > 0 && (
                          <div className={`flex-1 h-1 ${i <= lifecycleIndex ? (isDisputed ? 'bg-red-400' : 'bg-primary-500') : 'bg-gray-200'}`} />
                        )}
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${dotClass} ${ringClass}`} />
                        {i < LIFECYCLE_STEPS.length - 1 && (
                          <div className={`flex-1 h-1 ${i < lifecycleIndex ? 'bg-primary-500' : 'bg-gray-200'}`} />
                        )}
                      </div>
                      <span className={`text-[10px] mt-1 ${labelClass}`}>
                        {labelText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rejection notice */}
        {booking.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <h2 className="font-semibold text-red-800 mb-1">Booking Rejected</h2>
            <p className="text-sm text-red-700">
              {booking.rejection_reason || 'The provider declined this booking request.'}
            </p>
          </div>
        )}

        {/* Dispute notice */}
        {dispute && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
            <h2 className="font-semibold text-orange-800 mb-2">Dispute Filed</h2>
            <p className="text-sm text-orange-700 mb-1"><strong>Reason:</strong> {dispute.reason}</p>
            <p className="text-sm text-orange-700"><strong>Status:</strong> {dispute.status.replace(/_/g, ' ')}</p>
            {dispute.admin_notes && (
              <p className="text-sm text-orange-700 mt-1"><strong>Admin notes:</strong> {dispute.admin_notes}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Business & Customer */}
          <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">Business</h2>
              <p className="font-semibold">{booking.business_name}</p>
              {booking.business_address && <p className="text-sm text-gray-600">{booking.business_address}</p>}
              {booking.contact_info && <p className="text-sm text-gray-600">{booking.contact_info}</p>}
            </div>
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">Customer</h2>
              <p className="font-semibold">{booking.customer_name}</p>
              <p className="text-sm text-gray-600">{booking.customer_email}</p>
              {booking.customer_phone && <p className="text-sm text-gray-600">{booking.customer_phone}</p>}
            </div>
          </div>

          {/* Appointment & Payment */}
          <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">Appointment</h2>
              <p className="font-semibold">{booking.service_name}</p>
              <p className="text-sm text-gray-600">{booking.duration} min</p>
              {booking.start_time ? (
                <p className="text-sm text-gray-600">
                  {new Date(booking.start_time).toLocaleDateString()} &nbsp;
                  {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {booking.end_time && (
                    <>{' – '}{new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">Time slot no longer assigned</p>
              )}
            </div>
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">Payment</h2>
              <p className="text-2xl font-bold text-primary-600">UGX {Number(booking.total_price).toLocaleString()}</p>
              <p className="text-sm text-gray-500 capitalize">
                Escrow: {booking.escrow_status?.replace(/_/g, ' ') || 'none'}
              </p>
              {booking.released_to && (
                <p className="text-xs text-gray-400">Released to: {booking.released_to}</p>
              )}
            </div>
          </div>
        </div>

        {/* Customer notes */}
        {booking.customer_notes && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes</h2>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{booking.customer_notes}</p>
          </div>
        )}

        {/* Actions panel */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="font-semibold mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">

            {/* ── PROVIDER actions ── */}
            {isProvider && booking.status === 'pending_provider_approval' && !showRejectForm && (
              <>
                <button
                  onClick={handleAccept}
                  disabled={acting}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
                >
                  {acting ? 'Accepting…' : 'Accept Booking'}
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="px-5 py-2.5 border border-red-400 text-red-600 rounded-lg hover:bg-red-50 font-medium text-sm"
                >
                  Reject Booking
                </button>
              </>
            )}

            {isProvider && booking.status === 'booked' && (
              <button
                onClick={handleMarkComplete}
                disabled={acting}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
              >
                {acting ? 'Saving…' : 'Mark Service as Complete'}
              </button>
            )}

            {isProvider && booking.status === 'awaiting_confirmation' && (
              <p className="text-sm text-gray-500 self-center">Waiting for customer to confirm or dispute.</p>
            )}

            {/* ── CUSTOMER actions ── */}
            {isCustomer && booking.status === 'pending_provider_approval' && (
              <p className="text-sm text-gray-500 self-center">Waiting for the provider to accept your request.</p>
            )}

            {isCustomer && booking.status === 'awaiting_payment' && (
              <button
                onClick={handleSimulatePayment}
                disabled={acting}
                className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium text-sm"
              >
                {acting ? 'Processing…' : 'Simulate Payment'}
              </button>
            )}

            {isCustomer && booking.status === 'awaiting_confirmation' && !showDisputeForm && (
              <>
                <button
                  onClick={handleRelease}
                  disabled={acting}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
                >
                  {acting ? 'Releasing…' : 'Confirm & Release Payment'}
                </button>
                <button
                  onClick={() => setShowDisputeForm(true)}
                  className="px-5 py-2.5 border border-orange-500 text-orange-600 rounded-lg hover:bg-orange-50 font-medium text-sm"
                >
                  Open Dispute
                </button>
              </>
            )}

            {isCustomer && booking.status === 'completed' && !booking.has_review && (
              <Link
                href={`/reviews/create?booking_id=${booking.id}`}
                className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
              >
                Leave a Review
              </Link>
            )}

            {/* Cancel — customer or provider on cancellable statuses */}
            {(isCustomer || isProvider) &&
              ['pending_provider_approval', 'awaiting_payment', 'booked'].includes(booking.status) && (
              <button
                onClick={handleCancel}
                disabled={acting}
                className="px-5 py-2.5 border border-red-400 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 font-medium text-sm"
              >
                Cancel Booking
              </button>
            )}

            <Link
              href="/my-bookings"
              className="px-5 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              My Bookings
            </Link>
          </div>

          {/* Reject form */}
          {showRejectForm && (
            <div className="mt-4 border border-red-200 rounded-lg p-4 bg-red-50">
              <p className="text-sm font-medium text-red-800 mb-2">Reason for rejection (optional)</p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                className="w-full border border-red-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-red-400"
                placeholder="Let the customer know why you're declining…"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleReject}
                  disabled={acting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                >
                  {acting ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
                <button
                  onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Go Back
                </button>
              </div>
            </div>
          )}

          {/* Dispute form */}
          {showDisputeForm && (
            <div className="mt-4 border border-orange-200 rounded-lg p-4 bg-orange-50">
              <p className="text-sm font-medium text-orange-800 mb-2">Describe the issue (min 10 characters)</p>
              <textarea
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
                rows={3}
                className="w-full border border-orange-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-orange-400"
                placeholder="Explain what went wrong with the service…"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleDispute}
                  disabled={acting}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium"
                >
                  {acting ? 'Submitting…' : 'Submit Dispute'}
                </button>
                <button
                  onClick={() => setShowDisputeForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Audit log */}
        {events.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="font-semibold mb-4">Booking History</h2>
            <ol className="relative border-l border-gray-200 space-y-4 ml-3">
              {events.map((ev, i) => (
                <li key={i} className="pl-5">
                  <span className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-primary-400 border-2 border-white" />
                  <p className="text-sm font-medium capitalize text-gray-800">
                    {ev.action.replace(/_/g, ' ')}
                  </p>
                  {ev.from_state && ev.to_state && (
                    <p className="text-xs text-gray-500">
                      {ev.from_state.replace(/_/g, ' ')} → {ev.to_state.replace(/_/g, ' ')}
                    </p>
                  )}
                  {ev.notes && (
                    <p className="text-xs text-gray-400 mt-0.5 italic">{ev.notes}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {ev.actor_name} · {new Date(ev.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </>
  );
}
