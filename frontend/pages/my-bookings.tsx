import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';
import { toast } from 'react-toastify';

interface Booking {
  id: number;
  status: string;
  escrow_status: string;
  total_price: number;
  created_at: string;
  business_name: string;
  city: string;
  service_name: string;
  duration: number;
  start_time: string | null;
  end_time: string | null;
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

const FILTERS = [
  { value: 'all',                    label: 'All'                  },
  { value: 'pending_provider_approval', label: 'Awaiting Approval' },
  { value: 'awaiting_payment',       label: 'Awaiting Payment'     },
  { value: 'booked',                 label: 'Booked'               },
  { value: 'awaiting_confirmation',  label: 'Awaiting Confirmation'},
  { value: 'completed',              label: 'Completed'            },
  { value: 'disputed',               label: 'Disputed'             },
  { value: 'cancelled',              label: 'Cancelled'            },
  { value: 'rejected',               label: 'Rejected'             },
];

export default function MyBookings() {
  const { user } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (filter !== 'all') params.status = filter;
      const response = await api.get('/bookings/customer/my', { params });
      setBookings(response.data.bookings);
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    fetchBookings();
  }, [user, router, fetchBookings]);

  return (
    <>
      <Head>
        <title>My Bookings — BookIt</title>
      </Head>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">My Bookings</h1>

        {/* Status filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filter === value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
          </div>
        ) : bookings.length > 0 ? (
          <div className="space-y-4">
            {bookings.map(booking => (
              <div key={booking.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-900">{booking.business_name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[booking.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABEL[booking.status] || booking.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">{booking.service_name} &bull; {booking.duration} min</p>

                    {booking.status === 'pending_provider_approval' && (
                      <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 inline-block mb-2">
                        Waiting for the provider to accept your request
                      </p>
                    )}
                    {booking.status === 'awaiting_payment' && (
                      <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 inline-block mb-2">
                        Provider accepted — go to booking to complete payment
                      </p>
                    )}
                    {booking.status === 'rejected' && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 inline-block mb-2">
                        Provider declined this request
                      </p>
                    )}

                    <div className="text-sm text-gray-500 space-y-0.5">
                      {booking.start_time ? (
                        <p>
                          {new Date(booking.start_time).toLocaleDateString()} &nbsp;
                          {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {booking.end_time && (
                            <> &ndash; {new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                          )}
                        </p>
                      ) : (
                        <p className="italic text-gray-400">No time slot assigned</p>
                      )}
                      <p className="font-semibold text-primary-600">UGX {Number(booking.total_price).toLocaleString()}</p>
                    </div>
                  </div>

                  <Link
                    href={`/booking/${booking.id}`}
                    className="flex-shrink-0 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium text-sm text-center"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl shadow">
            <p className="text-gray-500 mb-4">No bookings found</p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
            >
              Browse Businesses
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
