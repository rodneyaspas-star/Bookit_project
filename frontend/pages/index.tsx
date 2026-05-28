import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';

interface Business {
  id: number;
  name: string;
  description: string;
  category: string;
  city: string;
  rating: number;
  total_reviews: number;
}

interface CustomerBooking {
  id: number;
  status: string;
  total_price: number;
  service_name: string;
  business_name: string;
  start_time: string;
  end_time: string;
}

interface BusinessBooking {
  id: number;
  status: string;
  total_price: number;
  service_name: string;
  customer_name: string;
  start_time: string;
  end_time: string;
}

type EarningsPeriod = 'day' | 'month' | 'year';

const getDateKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

const getPendingDatesFromBookings = (bookings: { status: string; start_time: string }[]) => {
  const dates = new Set<string>();
  const activeStatuses = ['pending_provider_approval', 'awaiting_payment', 'booked', 'awaiting_confirmation'];
  bookings
    .filter((b) => activeStatuses.includes(b.status))
    .forEach((b) => {
      const d = new Date(b.start_time);
      dates.add(getDateKey(d));
    });
  return dates;
};

const PendingBookingsCalendar = ({ bookings }: { bookings: { status: string; start_time: string }[] }) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startWeekday = firstDayOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = lastDayOfMonth.getDate();

  const pendingDates = getPendingDatesFromBookings(bookings);

  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];

  // Fill initial empty days
  for (let i = 0; i < startWeekday; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  const monthLabel = today.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Upcoming bookings calendar</h3>
        <span className="text-xs text-gray-500">{monthLabel}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 mb-2">
        <span className="text-center">Sun</span>
        <span className="text-center">Mon</span>
        <span className="text-center">Tue</span>
        <span className="text-center">Wed</span>
        <span className="text-center">Thu</span>
        <span className="text-center">Fri</span>
        <span className="text-center">Sat</span>
      </div>
      <div className="grid grid-rows-6 gap-1">
        {weeks.map((week, i) => (
          <div key={i} className="grid grid-cols-7 gap-1 text-xs">
            {week.map((day, idx) => {
              if (day === null) {
                return <div key={idx} className="h-8 rounded-md" />;
              }

              const date = new Date(year, month, day);
              const dateKey = getDateKey(date);
              const isToday = date.toDateString() === today.toDateString();
              const hasBooking = pendingDates.has(dateKey);

              return (
                <div
                  key={idx}
                  className={`h-8 flex items-center justify-center rounded-md border text-[11px] ${hasBooking
                    ? 'bg-primary-50 border-primary-400 text-primary-700 font-semibold'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                    } ${isToday ? 'ring-1 ring-primary-500' : ''}`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary-200 border border-primary-500" />
          Pending booking
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-gray-100 border border-gray-300" />
          No booking
        </span>
      </div>
    </div>
  );
};

export default function Home() {
  const { user } = useAuth();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const [customerBookings, setCustomerBookings] = useState<CustomerBooking[]>([]);
  const [businessBookings, setBusinessBookings] = useState<BusinessBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>('day');
  const [businessName, setBusinessName] = useState<string | null>(null);

  const categories = ['barber', 'tutor', 'mechanic', 'salon', 'spa', 'dentist', 'therapist'];

  const fetchBusinesses = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 12 };
      if (category) params.category = category;
      if (searchTerm) params.search = searchTerm;

      const response = await api.get('/businesses', { params });
      setBusinesses(response.data.businesses);
    } catch (error: any) {
      toast.error('Failed to load businesses');
    } finally {
      setLoading(false);
    }
  }, [category, searchTerm]);

  const fetchCustomerBookings = useCallback(async () => {
    try {
      setBookingsLoading(true);
      const response = await api.get('/bookings/customer/my');
      setCustomerBookings(response.data.bookings || []);
    } catch (error) {
      toast.error('Failed to load your bookings');
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  const fetchBusinessHomeData = useCallback(async () => {
    try {
      setBookingsLoading(true);
      // Get current user's business to know ID and name
      const businessResponse = await api.get('/businesses/my/profile');
      const business = businessResponse.data;
      setBusinessName(business.name);

      const bookingsResponse = await api.get(`/bookings/business/${business.id}`);
      setBusinessBookings(bookingsResponse.data.bookings || []);
    } catch (error) {
      toast.error('Failed to load your business data');
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  useEffect(() => {
    if (!user) return;

    if (user.role === 'customer') {
      fetchCustomerBookings();
    } else if (user.role === 'business') {
      fetchBusinessHomeData();
    }
  }, [user, fetchCustomerBookings, fetchBusinessHomeData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBusinesses();
  };

  return (
    <>
      <Head>
        <title>BookIt - Appointment Booking Platform</title>
        <meta name="description" content="Book appointments with local businesses" />
      </Head>

      {/* Logged-out marketing homepage */}
      {!user && (
        <>
          {/* Hero Section */}
          <div className="bg-white relative overflow-hidden">
            <div className="max-w-7xl mx-auto py-20 px-4 sm:py-32 sm:px-6 lg:px-8">
              <div className="text-center">
                <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold text-gray-900 tracking-tight leading-none mb-8">
                  Appointment booking
                  <br />
                  <span className="text-indigo-600">System</span> for Online
                  <br />
                  Businesses
                </h1>
                <p className="mt-8 max-w-2xl mx-auto text-xl text-gray-600 leading-relaxed">
                  Millions of businesses use BookIt to accept bookings online and in person, manage calendars, send reminders, and build a more profitable business.
                </p>

                {/* CTA Buttons */}
                <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Link
                    href="/signup"
                    className="px-8 py-4 bg-indigo-600 text-white font-semibold text-lg rounded-full hover:bg-indigo-700 transition-colors duration-200"
                  >
                    Start now →
                  </Link>
                  <Link
                    href="#businesses"
                    className="px-8 py-4 text-indigo-600 font-semibold text-lg hover:text-indigo-700 transition-colors duration-200"
                  >
                    Browse businesses
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="bg-gray-50 py-24 border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-20">
                <h2 className="text-5xl font-bold text-gray-900 mb-6">Modular solutions</h2>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  A unified platform to accept bookings, manage calendars, and grow your revenue
                </p>
              </div>

              <div className="space-y-32">
                {/* Payments */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <div>
                    <div className="text-sm font-semibold text-indigo-600 mb-4 uppercase tracking-wide">Bookings</div>
                    <h3 className="text-4xl font-bold text-gray-900 mb-6">Accept and manage bookings, 24/7</h3>
                    <p className="text-lg text-gray-600 mb-8">
                      Let customers book appointments anytime with our online booking system. Manage your calendar, services, and availability in one place.
                    </p>
                    <Link href="/businesses" className="text-indigo-600 font-semibold text-lg hover:text-indigo-700">
                      Start with Bookings →
                    </Link>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                    <div className="text-sm text-gray-500 mb-4">📅 Calendar View</div>
                    <div className="space-y-3">
                      <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded">
                        <div className="font-semibold text-gray-900">10:00 AM - Haircut with John</div>
                        <div className="text-sm text-gray-600">Classic Cuts Barbershop</div>
                      </div>
                      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
                        <div className="font-semibold text-gray-900">2:00 PM - Spa Treatment</div>
                        <div className="text-sm text-gray-600">Relaxation Wellness Center</div>
                      </div>
                      <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded">
                        <div className="font-semibold text-gray-900">4:30 PM - Consultation</div>
                        <div className="text-sm text-gray-600">Expert Tutoring Services</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Billing */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 lg:order-first order-last">
                    <div className="text-sm text-gray-500 mb-4">💳 Payment Processing</div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-4 border-b">
                        <div>
                          <div className="font-semibold">Haircut Service</div>
                          <div className="text-sm text-gray-600">Completed today</div>
                        </div>
                        <div className="font-bold text-green-600">+UGX 45,000</div>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b">
                        <div>
                          <div className="font-semibold">Massage Therapy</div>
                          <div className="text-sm text-gray-600">Completed yesterday</div>
                        </div>
                        <div className="font-bold text-green-600">+UGX 120,000</div>
                      </div>
                      <div className="pt-4">
                        <div className="text-2xl font-bold text-gray-900">UGX 165,000</div>
                        <div className="text-sm text-gray-600">Total revenue (Last 2 days)</div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-indigo-600 mb-4 uppercase tracking-wide">Payments</div>
                    <h3 className="text-4xl font-bold text-gray-900 mb-6">Secure payment processing</h3>
                    <p className="text-lg text-gray-600 mb-8">
                      Accept payments online and in person. Process transactions securely with built-in fraud protection and instant payouts.
                    </p>
                    <Link href="/signup" className="text-indigo-600 font-semibold text-lg hover:text-indigo-700">
                      Explore Payments →
                    </Link>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <div>
                    <div className="text-sm font-semibold text-indigo-600 mb-4 uppercase tracking-wide">Client Management</div>
                    <h3 className="text-4xl font-bold text-gray-900 mb-6">Build lasting relationships</h3>
                    <p className="text-lg text-gray-600 mb-8">
                      Track customer history, send automated reminders, and keep clients coming back with personalized service.
                    </p>
                    <Link href="/signup" className="text-indigo-600 font-semibold text-lg hover:text-indigo-700">
                      Learn about Management →
                    </Link>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="text-4xl font-bold text-gray-900 mb-2">500+</div>
                        <div className="text-sm text-gray-600">Active Businesses</div>
                      </div>
                      <div>
                        <div className="text-4xl font-bold text-gray-900 mb-2">10K+</div>
                        <div className="text-sm text-gray-600">Monthly Bookings</div>
                      </div>
                      <div>
                        <div className="text-4xl font-bold text-gray-900 mb-2">99.9%</div>
                        <div className="text-sm text-gray-600">Uptime</div>
                      </div>
                      <div>
                        <div className="text-4xl font-bold text-gray-900 mb-2">5K+</div>
                        <div className="text-sm text-gray-600">Happy Customers</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="bg-white py-24 border-t border-gray-200">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-5xl font-bold text-gray-900 mb-6">Ready to get started?</h2>
              <p className="text-xl text-gray-600 mb-10">
                Create an account instantly and start accepting bookings in minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signup"
                  className="px-8 py-4 bg-indigo-600 text-white font-semibold text-lg rounded-full hover:bg-indigo-700 transition-colors duration-200"
                >
                  Start now
                </Link>
                <Link
                  href="/businesses"
                  className="px-8 py-4 text-indigo-600 font-semibold text-lg hover:text-indigo-700 transition-colors duration-200"
                >
                  Browse businesses
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Logged-in customer home */}
      {user && user.role === 'customer' && (
        <div className="bg-gray-50 min-h-[calc(100vh-200px)] py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Your Bookings</h1>
                <p className="mt-2 text-sm text-gray-600">
                  View your upcoming and completed appointments in one place.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Pending and finished lists */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
                  <h2 className="text-xl font-semibold mb-4">Upcoming bookings</h2>
                  {bookingsLoading ? (
                    <div className="py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                    </div>
                  ) : (
                    <>
                      {customerBookings.filter((b) => ['pending_provider_approval', 'awaiting_payment', 'booked', 'awaiting_confirmation'].includes(b.status)).length > 0 ? (
                        <div className="space-y-4">
                          {customerBookings
                            .filter((b) => ['pending_provider_approval', 'awaiting_payment', 'booked', 'awaiting_confirmation'].includes(b.status))
                            .sort(
                              (a, b) =>
                                new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                            )
                            .map((booking) => (
                              <div
                                key={booking.id}
                                className="border border-gray-100 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:border-primary-200 hover:shadow-sm transition"
                              >
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900">
                                    {booking.business_name}
                                  </h3>
                                  <p className="text-xs text-gray-500 mb-1">{booking.service_name}</p>
                                  <p className="text-xs text-gray-500">
                                    📅{' '}
                                    {new Date(booking.start_time).toLocaleDateString()}{' '}
                                    · 🕒{' '}
                                    {new Date(booking.start_time).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500 mb-1">Amount</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    UGX {booking.total_price.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">You have no upcoming bookings.</p>
                      )}
                    </>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
                  <h2 className="text-xl font-semibold mb-4">Finished bookings</h2>
                  {bookingsLoading ? (
                    <div className="py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                    </div>
                  ) : (
                    <>
                      {customerBookings.filter((b) => b.status === 'completed').length > 0 ? (
                        <div className="space-y-4">
                          {customerBookings
                            .filter((b) => b.status === 'completed')
                            .sort(
                              (a, b) =>
                                new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
                            )
                            .slice(0, 5)
                            .map((booking) => (
                              <div
                                key={booking.id}
                                className="border border-gray-100 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:border-gray-200 transition"
                              >
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900">
                                    {booking.business_name}
                                  </h3>
                                  <p className="text-xs text-gray-500 mb-1">{booking.service_name}</p>
                                  <p className="text-xs text-gray-500">
                                    ✅ Completed on{' '}
                                    {new Date(booking.start_time).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500 mb-1">Paid</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    UGX {booking.total_price.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No completed bookings yet.</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Calendar */}
              <div>
                <PendingBookingsCalendar bookings={customerBookings} />
              </div>
            </div>

            {/* Popular businesses */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Popular businesses</h2>
                <Link
                  href="/businesses"
                  className="text-sm font-semibold text-primary-600 hover:text-primary-500"
                >
                  View all
                </Link>
              </div>

              {loading ? (
                <div className="text-center py-10">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-indigo-600" />
                </div>
              ) : businesses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {businesses.slice(0, 6).map((business) => (
                    <Link
                      key={business.id}
                      href={`/business/${business.id}`}
                      className="group block bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg hover:border-primary-200 transition-all duration-200"
                    >
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-600">
                        {business.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">{business.category}</p>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {business.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                        <span>
                          ★ {business.rating ? Number(business.rating).toFixed(1) : '0.0'} ·{' '}
                          {business.total_reviews || 0} reviews
                        </span>
                        {business.city && <span>{business.city}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No popular businesses found right now.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logged-in business home */}
      {user && user.role === 'business' && (
        <div className="bg-gray-50 min-h-[calc(100vh-200px)] py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  {businessName ? `${businessName} overview` : 'Your business overview'}
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  See your upcoming bookings, completed work, and earnings at a glance.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Bookings lists */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
                  <h2 className="text-xl font-semibold mb-4">Upcoming bookings</h2>
                  {bookingsLoading ? (
                    <div className="py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                    </div>
                  ) : (
                    <>
                      {businessBookings.filter((b) => ['pending_provider_approval', 'awaiting_payment', 'booked', 'awaiting_confirmation'].includes(b.status)).length > 0 ? (
                        <div className="space-y-4">
                          {businessBookings
                            .filter((b) => ['pending_provider_approval', 'awaiting_payment', 'booked', 'awaiting_confirmation'].includes(b.status))
                            .sort(
                              (a, b) =>
                                new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                            )
                            .map((booking) => (
                              <div
                                key={booking.id}
                                className="border border-gray-100 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:border-primary-200 hover:shadow-sm transition"
                              >
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900">
                                    {booking.customer_name}
                                  </h3>
                                  <p className="text-xs text-gray-500 mb-1">{booking.service_name}</p>
                                  <p className="text-xs text-gray-500">
                                    📅{' '}
                                    {new Date(booking.start_time).toLocaleDateString()}{' '}
                                    · 🕒{' '}
                                    {new Date(booking.start_time).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500 mb-1">Amount</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    UGX {booking.total_price.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No upcoming bookings.</p>
                      )}
                    </>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
                  <h2 className="text-xl font-semibold mb-4">Finished bookings</h2>
                  {bookingsLoading ? (
                    <div className="py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                    </div>
                  ) : (
                    <>
                      {businessBookings.filter((b) => b.status === 'completed').length > 0 ? (
                        <div className="space-y-4">
                          {businessBookings
                            .filter((b) => b.status === 'completed')
                            .sort(
                              (a, b) =>
                                new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
                            )
                            .slice(0, 5)
                            .map((booking) => (
                              <div
                                key={booking.id}
                                className="border border-gray-100 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:border-gray-200 transition"
                              >
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900">
                                    {booking.customer_name}
                                  </h3>
                                  <p className="text-xs text-gray-500 mb-1">{booking.service_name}</p>
                                  <p className="text-xs text-gray-500">
                                    ✅ Completed on{' '}
                                    {new Date(booking.start_time).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500 mb-1">Earned</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    UGX {booking.total_price.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No completed bookings yet.</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Calendar & earnings */}
              <div className="space-y-6">
                <PendingBookingsCalendar bookings={businessBookings} />

                {/* Earnings summary */}
                <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Total amount earned</h2>
                    <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 p-1 text-xs">
                      <button
                        className={`px-2 py-0.5 rounded-full ${earningsPeriod === 'day' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
                        onClick={() => setEarningsPeriod('day')}
                      >
                        Day
                      </button>
                      <button
                        className={`px-2 py-0.5 rounded-full ${earningsPeriod === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
                        onClick={() => setEarningsPeriod('month')}
                      >
                        Month
                      </button>
                      <button
                        className={`px-2 py-0.5 rounded-full ${earningsPeriod === 'year' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
                        onClick={() => setEarningsPeriod('year')}
                      >
                        Year
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const completed = businessBookings.filter((b) => b.status === 'completed');
                    const now = new Date();

                    const totals = completed.reduce(
                      (acc, booking) => {
                        const d = new Date(booking.start_time);
                        if (
                          d.getFullYear() === now.getFullYear() &&
                          d.getMonth() === now.getMonth() &&
                          d.getDate() === now.getDate()
                        ) {
                          acc.day += booking.total_price;
                        }
                        if (
                          d.getFullYear() === now.getFullYear() &&
                          d.getMonth() === now.getMonth()
                        ) {
                          acc.month += booking.total_price;
                        }
                        if (d.getFullYear() === now.getFullYear()) {
                          acc.year += booking.total_price;
                        }
                        return acc;
                      },
                      { day: 0, month: 0, year: 0 }
                    );

                    const value = totals[earningsPeriod];
                    const label =
                      earningsPeriod === 'day'
                        ? 'Today'
                        : earningsPeriod === 'month'
                          ? 'This month'
                          : 'This year';

                    return (
                      <>
                        <p className="text-xs text-gray-500 mb-1">{label}</p>
                        <p className="text-3xl font-bold text-gray-900">
                          UGX {value.toLocaleString()}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          Based on completed bookings only.
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Popular businesses for inspiration */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Popular businesses</h2>
                <Link
                  href="/businesses"
                  className="text-sm font-semibold text-primary-600 hover:text-primary-500"
                >
                  View all
                </Link>
              </div>

              {loading ? (
                <div className="text-center py-10">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-indigo-600" />
                </div>
              ) : businesses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {businesses.slice(0, 6).map((business) => (
                    <Link
                      key={business.id}
                      href={`/business/${business.id}`}
                      className="group block bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg hover:border-primary-200 transition-all duration-200"
                    >
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-600">
                        {business.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">{business.category}</p>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {business.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                        <span>
                          ★ {business.rating ? Number(business.rating).toFixed(1) : '0.0'} ·{' '}
                          {business.total_reviews || 0} reviews
                        </span>
                        {business.city && <span>{business.city}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No popular businesses found right now.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
