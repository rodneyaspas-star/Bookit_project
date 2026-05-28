import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { toast } from 'react-toastify';

export default function CreateBooking() {
  const router = useRouter();
  const { business_id, service_id, requested_date, requested_time } = router.query;
  const { user, loading: authLoading } = useAuth();
  const [customerNotes, setCustomerNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Part A — redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && user === null) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Existing role guard — non-customers go to dashboard
  useEffect(() => {
    if (user && user.role !== 'customer') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // Part B — validate required query params
  useEffect(() => {
    if (!router.isReady) return;
    const bid = parseInt(business_id as string);
    const sid = parseInt(service_id as string);
    const dateStr = requested_date as string;
    const timeStr = requested_time as string;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isDateValid = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && new Date(dateStr) > today;
    if (!bid || bid <= 0 || !sid || sid <= 0 || !isDateValid || !timeStr) {
      toast.error('Invalid booking link — please pick a date and time from the business page');
      router.replace('/businesses');
    }
  }, [router.isReady, business_id, service_id, requested_date, requested_time, router]);

  const formattedDateTime = (() => {
    if (!requested_date || !requested_time) return '';
    const dt = new Date(`${requested_date}T${requested_time}`);
    return dt.toLocaleString([], {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please login to book an appointment');
      router.push('/login');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/bookings', {
        business_id: parseInt(business_id as string),
        service_id: parseInt(service_id as string),
        requested_date,
        requested_time,
        customer_notes: customerNotes,
      });

      toast.success('Booking request sent — waiting for business approval');
      router.push(`/booking/${response.data.booking.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Complete Booking - BookIt</title>
      </Head>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Complete Your Booking</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
          {formattedDateTime && (
            <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
              <p className="text-sm font-medium text-primary-700">Requested appointment</p>
              <p className="text-base font-semibold text-primary-900 mt-1">{formattedDateTime}</p>
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              id="notes"
              rows={4}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="Any special requests or notes for the business..."
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
            >
              Go Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold disabled:opacity-50"
            >
              {loading ? 'Creating Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
