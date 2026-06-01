import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import api from '@/lib/api';
import Link from 'next/link';
import { toast } from 'react-toastify';

interface Business {
  id: number;
  name: string;
  category: string;
  is_approved: boolean;
  address?: string;
  city?: string;
  contact_info?: string;
  image_url?: string | null;
  services?: Service[];
}

interface Service {
  id: number;
  service_name: string;
  price: number;
  duration: number;
  is_active: boolean;
}

interface Booking {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_name: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  total_price: number;
  customer_notes: string | null;
  escrow_status: string;
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

type Tab = 'requests' | 'bookings' | 'services' | 'profile';

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('requests');

  // Per-row reject form state: bookingId → reason string (undefined = form hidden)
  const [rejectForms, setRejectForms] = useState<Record<number, string>>({});
  const [acting, setActing] = useState<number | null>(null);

  const fetchBusinessData = useCallback(async () => {
    try {
      const response = await api.get('/businesses/my/profile');
      setBusiness(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.info('Please create your business profile');
      } else {
        toast.error('Failed to load business data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    if (!business) return;
    try {
      const response = await api.get(`/bookings/business/${business.id}`);
      setBookings(response.data.bookings);
    } catch {
      console.error('Failed to load bookings');
    }
  }, [business]);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role === 'admin') { router.push('/admin'); return; }
    if (user.role !== 'business') { router.push('/'); return; }
    fetchBusinessData();
  }, [user, router, fetchBusinessData]);

  useEffect(() => {
    if (business) fetchBookings();
  }, [business, fetchBookings]);

  const handleAccept = async (bookingId: number) => {
    setActing(bookingId);
    try {
      await api.post(`/bookings/${bookingId}/accept`);
      toast.success('Booking accepted — customer notified to pay');
      fetchBookings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to accept booking');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (bookingId: number) => {
    const reason = rejectForms[bookingId] ?? '';
    setActing(bookingId);
    try {
      await api.post(`/bookings/${bookingId}/reject`, { reason: reason.trim() || undefined });
      toast.success('Booking rejected');
      setRejectForms(prev => { const next = { ...prev }; delete next[bookingId]; return next; });
      fetchBookings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject booking');
    } finally {
      setActing(null);
    }
  };

  const handleMarkComplete = async (bookingId: number) => {
    setActing(bookingId);
    try {
      await api.post(`/bookings/${bookingId}/complete`);
      toast.success('Marked as complete — awaiting customer confirmation');
      fetchBookings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to mark complete');
    } finally {
      setActing(null);
    }
  };

  const showRejectForm = (bookingId: number) =>
    setRejectForms(prev => ({ ...prev, [bookingId]: '' }));

  const hideRejectForm = (bookingId: number) =>
    setRejectForms(prev => { const next = { ...prev }; delete next[bookingId]; return next; });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Welcome to Your Dashboard</h2>
          <p className="text-gray-600 mb-6">
            You haven&apos;t created your business profile yet. Let&apos;s get started!
          </p>
          <Link
            href="/dashboard/business-setup"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
          >
            Create Business Profile
          </Link>
        </div>
      </div>
    );
  }

  const requests = bookings.filter(b => b.status === 'pending_provider_approval');
  const otherBookings = bookings.filter(b => b.status !== 'pending_provider_approval');

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'requests',  label: 'Requests',  count: requests.length },
    { key: 'bookings',  label: 'Bookings'  },
    { key: 'services',  label: 'Services'  },
    { key: 'profile',   label: 'Profile'   },
  ];

  return (
    <>
      <Head>
        <title>Business Dashboard — BookIt</title>
      </Head>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{business.name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 bg-primary-100 text-primary-600 text-sm rounded-full">
                  {business.category}
                </span>
                {!business.is_approved && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
                    Pending Admin Approval
                  </span>
                )}
              </div>
            </div>
            <Link
              href={`/business/${business.id}`}
              className="px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition"
            >
              View Public Profile
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <div className="flex gap-8">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-4 font-medium border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.5 bg-yellow-500 text-white text-xs rounded-full leading-none">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── REQUESTS tab ── */}
        {activeTab === 'requests' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Booking Requests</h2>

            {requests.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-500">No pending booking requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map(booking => (
                  <div key={booking.id} className="bg-white rounded-xl shadow-md p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{booking.customer_name}</p>
                        <p className="text-sm text-gray-500">{booking.customer_email}</p>
                        <p className="text-sm text-gray-700 mt-1">
                          <span className="font-medium">{booking.service_name}</span>
                          {booking.start_time && (
                            <> &mdash; {new Date(booking.start_time).toLocaleDateString()} at {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                          )}
                        </p>
                        {booking.customer_notes && (
                          <p className="text-xs text-gray-400 mt-1 italic">&ldquo;{booking.customer_notes}&rdquo;</p>
                        )}
                        <p className="text-sm font-semibold text-primary-600 mt-1">
                          UGX {Number(booking.total_price).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex-shrink-0 flex gap-2">
                        <button
                          onClick={() => handleAccept(booking.id)}
                          disabled={acting === booking.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                        >
                          {acting === booking.id ? '…' : 'Accept'}
                        </button>
                        {rejectForms[booking.id] === undefined ? (
                          <button
                            onClick={() => showRejectForm(booking.id)}
                            disabled={acting === booking.id}
                            className="px-4 py-2 border border-red-400 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 text-sm font-medium"
                          >
                            Reject
                          </button>
                        ) : null}
                        <Link
                          href={`/booking/${booking.id}`}
                          className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium"
                        >
                          View
                        </Link>
                      </div>
                    </div>

                    {/* Inline reject form */}
                    {rejectForms[booking.id] !== undefined && (
                      <div className="mt-3 border border-red-200 rounded-lg p-3 bg-red-50">
                        <p className="text-xs font-medium text-red-800 mb-1">
                          Reason for rejection (optional)
                        </p>
                        <textarea
                          value={rejectForms[booking.id]}
                          onChange={e => setRejectForms(prev => ({ ...prev, [booking.id]: e.target.value }))}
                          rows={2}
                          className="w-full border border-red-300 rounded px-2 py-1.5 text-sm focus:outline-none"
                          placeholder="Let the customer know why you're declining…"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleReject(booking.id)}
                            disabled={acting === booking.id}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-xs font-medium"
                          >
                            {acting === booking.id ? 'Rejecting…' : 'Confirm Rejection'}
                          </button>
                          <button
                            onClick={() => hideRejectForm(booking.id)}
                            className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BOOKINGS tab ── */}
        {activeTab === 'bookings' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">All Bookings</h2>

            {otherBookings.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-500">No bookings yet</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {otherBookings.map(booking => (
                      <tr key={booking.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">{booking.customer_name}</p>
                          <p className="text-xs text-gray-500">{booking.customer_email}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {booking.service_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {booking.start_time
                            ? new Date(booking.start_time).toLocaleString()
                            : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${STATUS_STYLE[booking.status] || 'bg-gray-100 text-gray-700'}`}>
                            {STATUS_LABEL[booking.status] || booking.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          UGX {Number(booking.total_price).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/booking/${booking.id}`}
                              className="text-xs text-primary-600 hover:underline font-medium"
                            >
                              View
                            </Link>
                            {booking.status === 'booked' && (
                              <button
                                onClick={() => handleMarkComplete(booking.id)}
                                disabled={acting === booking.id}
                                className="text-xs text-green-700 hover:underline font-medium disabled:opacity-50"
                              >
                                {acting === booking.id ? '…' : 'Mark Complete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── SERVICES tab ── */}
        {activeTab === 'services' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Your Services</h2>
              <div className="flex gap-3">
                <Link
                  href="/dashboard/add-service"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  Add Service
                </Link>
              </div>
            </div>

            {business.services && business.services.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {business.services.map(service => (
                  <div key={service.id} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-semibold">{service.service_name}</h3>
                      <span className={`px-3 py-1 text-xs rounded-full ${service.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {service.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p>UGX {Number(service.price).toLocaleString()}</p>
                      <p>{service.duration} minutes</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-600 mb-4">No services added yet</p>
                <Link
                  href="/dashboard/add-service"
                  className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  Add Your First Service
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE tab ── */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Business Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1 flex flex-col items-center">
                <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden mb-3 border border-dashed border-gray-300">
                  {business.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={business.image_url} alt={business.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl text-gray-400">{business.name.charAt(0)}</span>
                  )}
                </div>
                <Link
                  href="/dashboard/edit-profile"
                  className="px-4 py-2 text-xs bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition font-medium"
                >
                  Upload / change logo
                </Link>
              </div>

              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Business name</label>
                    <p className="text-sm text-gray-900">{business.name}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Contact info</label>
                    <p className="text-sm text-gray-900">{business.contact_info || 'Not set'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Location</label>
                    <p className="text-sm text-gray-900">{business.city || business.address || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Category</label>
                    <p className="text-sm text-gray-900">{business.category}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Approval status</label>
                  <p className="text-sm text-gray-900">{business.is_approved ? 'Approved' : 'Pending admin approval'}</p>
                </div>
                <div className="pt-4">
                  <Link
                    href="/dashboard/edit-profile"
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    Edit profile details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
