import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { toast } from 'react-toastify';

interface Stats {
    total_customers: string;
    total_businesses: string;
    approved_businesses: string;
    total_bookings: string;
    completed_bookings: string;
    total_revenue: string;
    open_disputes: number;
}

interface AdminBooking {
    id: number;
    status: string;
    total_price: number;
    created_at: string;
    customer_name: string;
    customer_email: string;
    business_name: string;
    service_name: string;
    start_time: string;
    end_time: string;
}

interface AdminUser {
    id: number;
    name: string;
    email: string;
    role: 'customer' | 'business' | 'admin';
    phone?: string | null;
    created_at: string;
}

interface AdminBusiness {
    id: number;
    name: string;
    category: string;
    is_approved: boolean;
    owner_name: string;
    owner_email: string;
    owner_phone?: string | null;
    created_at: string;
}

interface RevenueByBusiness {
    business_id: number;
    business_name: string;
    revenue: number;
    completed_bookings: number;
}

interface AdminDispute {
    id: number;
    booking_id: number;
    reason: string;
    status: string;
    admin_notes: string | null;
    created_at: string;
    resolved_at: string | null;
    opened_by_name: string;
    customer_name: string;
    business_name: string;
    service_name: string;
    total_price: number;
}

type ActiveSection =
    | 'none'
    | 'revenue'
    | 'totalBookings'
    | 'completedBookings'
    | 'customers'
    | 'businesses'
    | 'approvedBusinesses'
    | 'disputes';

export default function AdminDashboard() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    const [activeSection, setActiveSection] = useState<ActiveSection>('none');
    const [bookings, setBookings] = useState<AdminBooking[]>([]);
    const [bookingsLoading, setBookingsLoading] = useState(false);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
    const [businessesLoading, setBusinessesLoading] = useState(false);
    const [revenueRows, setRevenueRows] = useState<RevenueByBusiness[]>([]);
    const [revenueLoading, setRevenueLoading] = useState(false);
    const [disputes, setDisputes] = useState<AdminDispute[]>([]);
    const [disputesLoading, setDisputesLoading] = useState(false);

    useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') {
                router.push('/login');
                return;
            }
            fetchStats();
        }
    }, [user, authLoading, router]);

    const fetchStats = async () => {
        try {
            const response = await api.get('/admin/stats');
            setStats(response.data.stats);
        } catch (error: any) {
            console.error('Error fetching stats:', error);
            toast.error('Failed to load statistics');
        } finally {
            setLoading(false);
        }
    };

    const fetchBookings = async (status?: string) => {
        try {
            setBookingsLoading(true);
            const params: any = {};
            if (status) params.status = status;
            const response = await api.get('/admin/bookings', { params });
            setBookings(response.data.bookings || []);
        } catch (error: any) {
            console.error('Error fetching bookings:', error);
            toast.error('Failed to load bookings');
        } finally {
            setBookingsLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            setUsersLoading(true);
            const response = await api.get('/admin/users', { params: { role: 'customer' } });
            setUsers(response.data.users || []);
        } catch (error: any) {
            console.error('Error fetching customers:', error);
            toast.error('Failed to load customers');
        } finally {
            setUsersLoading(false);
        }
    };

    const fetchBusinesses = async (approvedOnly?: boolean) => {
        try {
            setBusinessesLoading(true);
            const params: any = {};
            if (approvedOnly) params.is_approved = true;
            const response = await api.get('/admin/businesses', { params });
            setBusinesses(response.data.businesses || []);
        } catch (error: any) {
            console.error('Error fetching businesses:', error);
            toast.error('Failed to load businesses');
        } finally {
            setBusinessesLoading(false);
        }
    };

    const fetchRevenueByBusiness = async () => {
        try {
            setRevenueLoading(true);
            const response = await api.get('/admin/revenue-by-business');
            setRevenueRows(response.data.revenue || []);
        } catch (error: any) {
            console.error('Error fetching revenue by business:', error);
            toast.error('Failed to load revenue breakdown');
        } finally {
            setRevenueLoading(false);
        }
    };

    const handleShowTotalBookings = () => {
        setActiveSection('totalBookings');
        fetchBookings();
    };

    const handleShowCompletedBookings = () => {
        setActiveSection('completedBookings');
        fetchBookings('completed');
    };

    const handleShowCustomers = () => {
        setActiveSection('customers');
        fetchCustomers();
    };

    const handleShowBusinesses = () => {
        setActiveSection('businesses');
        fetchBusinesses();
    };

    const handleShowApprovedBusinesses = () => {
        setActiveSection('approvedBusinesses');
        fetchBusinesses(true);
    };

    const handleRemoveCustomer = async (id: number) => {
        if (!window.confirm('Are you sure you want to remove this customer?')) return;

        try {
            await api.delete(`/admin/users/${id}`);
            toast.success('Customer removed successfully');
            setUsers((prev) => prev.filter((u) => u.id !== id));
        } catch (error: any) {
            console.error('Error removing customer:', error);
            toast.error(error.response?.data?.error || 'Failed to remove customer');
        }
    };

    const fetchDisputes = async () => {
        try {
            setDisputesLoading(true);
            const response = await api.get('/admin/disputes', { params: { status: 'open' } });
            setDisputes(response.data.disputes || []);
        } catch (error: any) {
            toast.error('Failed to load disputes');
        } finally {
            setDisputesLoading(false);
        }
    };

    const handleToggleApproval = async (id: number, approve: boolean) => {
        try {
            await api.put(`/admin/businesses/${id}`, { is_approved: approve });
            toast.success(approve ? 'Business approved' : 'Business approval revoked');
            setBusinesses((prev: AdminBusiness[]) => prev.map((b: AdminBusiness) => b.id === id ? { ...b, is_approved: approve } : b));
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to update business');
        }
    };

    const handleFavourProvider = async (disputeId: number) => {
        const adminNotes = window.prompt('Resolve in favour of provider — release escrow to them.\nAdd optional admin notes:');
        if (adminNotes === null) return;
        try {
            await api.post(`/admin/disputes/${disputeId}/release`, { admin_notes: adminNotes || undefined });
            toast.success('Dispute resolved — escrow released to provider');
            fetchDisputes();
            fetchStats();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to release escrow');
        }
    };

    const handleRefundCustomer = async (disputeId: number) => {
        const adminNotes = window.prompt('Resolve in favour of customer — refund escrow to them.\nAdd optional admin notes:');
        if (adminNotes === null) return;
        try {
            await api.post(`/admin/disputes/${disputeId}/refund`, { admin_notes: adminNotes || undefined });
            toast.success('Dispute resolved — escrow refunded to customer');
            fetchDisputes();
            fetchStats();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to process refund');
        }
    };

    const handleShowRevenue = () => {
        setActiveSection('revenue');
        fetchRevenueByBusiness();
    };

    const handleShowDisputes = () => {
        setActiveSection('disputes');
        fetchDisputes();
    };

    const handleRemoveBusiness = async (id: number) => {
        if (!window.confirm('Are you sure you want to remove this business?')) return;

        try {
            await api.delete(`/admin/businesses/${id}`);
            toast.success('Business removed successfully');
            setBusinesses((prev) => prev.filter((b) => b.id !== id));
        } catch (error: any) {
            console.error('Error removing business:', error);
            toast.error(error.response?.data?.error || 'Failed to remove business');
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>Admin Dashboard - BookIt</title>
            </Head>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

                {stats && (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {/* Total Revenue */}
                        <button
                            type="button"
                            onClick={handleShowRevenue}
                            className="bg-white overflow-hidden shadow rounded-lg text-left hover:shadow-md transition"
                        >
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                                            <dd className="text-lg font-medium text-gray-900">UGX {stats.total_revenue}</dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Total Bookings */}
                        <button
                            type="button"
                            onClick={handleShowTotalBookings}
                            className="bg-white overflow-hidden shadow rounded-lg text-left hover:shadow-md transition"
                        >
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">Total Bookings</dt>
                                            <dd className="text-lg font-medium text-gray-900">{stats.total_bookings}</dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Completed Bookings */}
                        <button
                            type="button"
                            onClick={handleShowCompletedBookings}
                            className="bg-white overflow-hidden shadow rounded-lg text-left hover:shadow-md transition"
                        >
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">Completed Bookings</dt>
                                            <dd className="text-lg font-medium text-gray-900">{stats.completed_bookings}</dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Total Customers */}
                        <button
                            type="button"
                            onClick={handleShowCustomers}
                            className="bg-white overflow-hidden shadow rounded-lg text-left hover:shadow-md transition"
                        >
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">Total Customers</dt>
                                            <dd className="text-lg font-medium text-gray-900">{stats.total_customers}</dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Total Businesses */}
                        <button
                            type="button"
                            onClick={handleShowBusinesses}
                            className="bg-white overflow-hidden shadow rounded-lg text-left hover:shadow-md transition"
                        >
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">Total Businesses</dt>
                                            <dd className="text-lg font-medium text-gray-900">{stats.total_businesses}</dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Approved Businesses */}
                        <button
                            type="button"
                            onClick={handleShowApprovedBusinesses}
                            className="bg-white overflow-hidden shadow rounded-lg text-left hover:shadow-md transition"
                        >
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-teal-500 rounded-md p-3">
                                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">Approved Businesses</dt>
                                            <dd className="text-lg font-medium text-gray-900">{stats.approved_businesses}</dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Open Disputes */}
                        <button
                            type="button"
                            onClick={handleShowDisputes}
                            className="bg-white overflow-hidden shadow rounded-lg text-left hover:shadow-md transition"
                        >
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-orange-500 rounded-md p-3">
                                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                        </svg>
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">Open Disputes</dt>
                                            <dd className="text-lg font-medium text-gray-900">{stats.open_disputes ?? 0}</dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>
                )}

                {/* Detail panel based on active section */}
                <div className="mt-10">
                    {activeSection === 'none' && (
                        <p className="text-sm text-gray-500">
                            Click a card above (Total Bookings, Completed Bookings, Total Customers, or Total Businesses) to view detailed data.
                        </p>
                    )}

                    {activeSection === 'revenue' && (
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Revenue by business
                                </h2>
                                <p className="text-xs text-gray-500">
                                    Based on completed bookings only.
                                </p>
                            </div>
                            {revenueLoading ? (
                                <div className="py-10 flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                </div>
                            ) : revenueRows.length === 0 ? (
                                <div className="py-10 text-center text-sm text-gray-500">
                                    No revenue data available.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Business
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Completed bookings
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Revenue (UGX)
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {revenueRows.map((row) => (
                                                <tr key={row.business_id}>
                                                    <td className="px-4 py-2 whitespace-nowrap">
                                                        {row.business_name}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">
                                                        {row.completed_bookings}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                                                        UGX {row.revenue.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeSection === 'totalBookings' && (
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">All bookings</h2>
                                <p className="text-xs text-gray-500">
                                    Active and completed bookings across the platform.
                                </p>
                            </div>
                            {bookingsLoading ? (
                                <div className="py-10 flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                </div>
                            ) : bookings.length === 0 ? (
                                <div className="py-10 text-center text-sm text-gray-500">
                                    No bookings found.
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-200">
                                    <div className="px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                                        Active bookings
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {bookings
                                            .filter((b) => ['pending_provider_approval','awaiting_payment','booked','awaiting_confirmation','disputed'].includes(b.status))
                                            .map((booking) => (
                                                <div
                                                    key={booking.id}
                                                    className="px-6 py-3 text-sm flex justify-between items-center border-b border-gray-50"
                                                >
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {booking.customer_name}{' '}
                                                            <span className="text-gray-400 text-xs">→</span>{' '}
                                                            <span className="text-gray-700">
                                                                {booking.business_name}
                                                            </span>
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {booking.service_name} ·{' '}
                                                            {new Date(booking.start_time).toLocaleString()}
                                                        </p>
                                                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                            booking.status === 'disputed'                  ? 'bg-orange-100 text-orange-700' :
                                                            booking.status === 'awaiting_confirmation'     ? 'bg-purple-100 text-purple-700' :
                                                            booking.status === 'pending_provider_approval' ? 'bg-yellow-100 text-yellow-700' :
                                                            booking.status === 'awaiting_payment'          ? 'bg-blue-100 text-blue-700' :
                                                            'bg-indigo-100 text-indigo-700'
                                                        }`}>
                                                            {booking.status.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs text-gray-500">Amount</p>
                                                        <p className="text-sm font-semibold text-gray-900">
                                                            UGX {booking.total_price.toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        {bookings.filter((b) => ['pending_provider_approval', 'awaiting_payment', 'booked', 'awaiting_confirmation', 'disputed'].includes(b.status)).length === 0 && (
                                            <div className="px-6 py-4 text-xs text-gray-500">
                                                No active bookings.
                                            </div>
                                        )}
                                    </div>

                                    <div className="px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                                        Completed bookings
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {bookings
                                            .filter((b) => b.status === 'completed')
                                            .map((booking) => (
                                                <div
                                                    key={booking.id}
                                                    className="px-6 py-3 text-sm flex justify-between items-center border-b border-gray-50"
                                                >
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {booking.customer_name}{' '}
                                                            <span className="text-gray-400 text-xs">→</span>{' '}
                                                            <span className="text-gray-700">
                                                                {booking.business_name}
                                                            </span>
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {booking.service_name} · Completed{' '}
                                                            {new Date(
                                                                booking.start_time,
                                                            ).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs text-gray-500">Amount</p>
                                                        <p className="text-sm font-semibold text-gray-900">
                                                            UGX {booking.total_price.toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        {bookings.filter((b) => b.status === 'completed').length ===
                                            0 && (
                                            <div className="px-6 py-4 text-xs text-gray-500">
                                                No completed bookings.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeSection === 'completedBookings' && (
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Completed bookings
                                </h2>
                            </div>
                            {bookingsLoading ? (
                                <div className="py-10 flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                </div>
                            ) : bookings.length === 0 ? (
                                <div className="py-10 text-center text-sm text-gray-500">
                                    No completed bookings found.
                                </div>
                            ) : (
                                <div className="max-h-[28rem] overflow-y-auto divide-y divide-gray-100">
                                    {bookings.map((booking) => (
                                        <div
                                            key={booking.id}
                                            className="px-6 py-3 text-sm flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {booking.customer_name}{' '}
                                                    <span className="text-gray-400 text-xs">→</span>{' '}
                                                    <span className="text-gray-700">
                                                        {booking.business_name}
                                                    </span>
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {booking.service_name} · Completed{' '}
                                                    {new Date(booking.start_time).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500">Amount</p>
                                                <p className="text-sm font-semibold text-gray-900">
                                                    UGX {booking.total_price.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeSection === 'customers' && (
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">Customers</h2>
                                <p className="text-xs text-gray-500">
                                    View and remove customer accounts.
                                </p>
                            </div>
                            {usersLoading ? (
                                <div className="py-10 flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                </div>
                            ) : users.length === 0 ? (
                                <div className="py-10 text-center text-sm text-gray-500">
                                    No customers found.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Name
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Email
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Phone
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Joined
                                                </th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {users.map((u) => (
                                                <tr key={u.id}>
                                                    <td className="px-4 py-2 whitespace-nowrap">
                                                        {u.name}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">
                                                        {u.email}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">
                                                        {u.phone || '-'}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                                        {new Date(u.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-right">
                                                        <button
                                                            onClick={() => handleRemoveCustomer(u.id)}
                                                            className="inline-flex items-center px-3 py-1.5 border border-red-500 text-xs font-medium rounded text-red-600 hover:bg-red-50"
                                                        >
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {(activeSection === 'businesses' || activeSection === 'approvedBusinesses') && (
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    {activeSection === 'approvedBusinesses'
                                        ? 'Approved businesses'
                                        : 'Businesses'}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    {activeSection === 'approvedBusinesses'
                                        ? 'Showing businesses that have been approved.'
                                        : 'View all registered businesses and their owners. You can remove a business from the platform.'}
                                </p>
                            </div>
                            {businessesLoading ? (
                                <div className="py-10 flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                </div>
                            ) : businesses.length === 0 ? (
                                <div className="py-10 text-center text-sm text-gray-500">
                                    No businesses found.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Organisation
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Category
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Owner
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Contact
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Approved
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Created
                                                </th>
                                                {activeSection === 'businesses' && (
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                        Actions
                                                    </th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {businesses.map((b) => (
                                                <tr key={b.id}>
                                                    <td className="px-4 py-2 whitespace-nowrap">
                                                        {b.name}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">
                                                        {b.category}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">
                                                        {b.owner_name}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">
                                                        <div className="flex flex-col">
                                                            <span>{b.owner_email}</span>
                                                            {b.owner_phone && (
                                                                <span className="text-gray-500">
                                                                    {b.owner_phone}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-xs">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                                                b.is_approved
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : 'bg-yellow-100 text-yellow-800'
                                                            }`}
                                                        >
                                                            {b.is_approved ? 'Approved' : 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                                        {new Date(b.created_at).toLocaleDateString()}
                                                    </td>
                                                    {activeSection === 'businesses' && (
                                                        <td className="px-4 py-2 whitespace-nowrap text-right">
                                                            <div className="flex gap-2 justify-end">
                                                                {b.is_approved ? (
                                                                    <button
                                                                        onClick={() => handleToggleApproval(b.id, false)}
                                                                        className="inline-flex items-center px-3 py-1.5 border border-yellow-500 text-xs font-medium rounded text-yellow-700 hover:bg-yellow-50"
                                                                    >
                                                                        Revoke
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleToggleApproval(b.id, true)}
                                                                        className="inline-flex items-center px-3 py-1.5 border border-green-500 text-xs font-medium rounded text-green-700 hover:bg-green-50"
                                                                    >
                                                                        Approve
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleRemoveBusiness(b.id)}
                                                                    className="inline-flex items-center px-3 py-1.5 border border-red-500 text-xs font-medium rounded text-red-600 hover:bg-red-50"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                    {activeSection === 'disputes' && (
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">Open Disputes</h2>
                                <p className="text-xs text-gray-500">Resolve in favour of the provider or customer.</p>
                            </div>
                            {disputesLoading ? (
                                <div className="py-10 flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                </div>
                            ) : disputes.length === 0 ? (
                                <div className="py-10 text-center text-sm text-gray-500">No open disputes.</div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {disputes.map((d) => (
                                        <div key={d.id} className="px-6 py-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        Booking #{d.booking_id} — {d.service_name}
                                                    </p>
                                                    <p className="text-xs text-gray-600 mt-0.5">
                                                        Customer: <span className="font-medium">{d.customer_name}</span>
                                                        {' · '}
                                                        Business: <span className="font-medium">{d.business_name}</span>
                                                        {' · '}
                                                        UGX {Number(d.total_price).toLocaleString()}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1 italic">"{d.reason}"</p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Opened {new Date(d.created_at).toLocaleDateString()} by {d.opened_by_name}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={() => handleFavourProvider(d.id)}
                                                        className="px-3 py-1.5 border border-blue-500 text-xs font-medium rounded text-blue-700 hover:bg-blue-50"
                                                    >
                                                        Favour Provider
                                                    </button>
                                                    <button
                                                        onClick={() => handleRefundCustomer(d.id)}
                                                        className="px-3 py-1.5 border border-orange-500 text-xs font-medium rounded text-orange-700 hover:bg-orange-50"
                                                    >
                                                        Refund Customer
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
