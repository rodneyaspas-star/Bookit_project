import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';
import { toast } from 'react-toastify';

interface Service {
  id: number;
  service_name: string;
  duration: number;
}

interface TimeSlot {
  id: number;
  service_id: number;
  start_time: string;
  end_time: string;
  is_booked: boolean;
}

export default function Availability() {
  const { user } = useAuth();
  const router = useRouter();

  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // new-slot form state
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('10:00');

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'business') { router.push('/'); return; }

    api.get('/businesses/my/profile')
      .then(res => api.get(`/services/${res.data.id}`))
      .then(res => {
        const list: Service[] = res.data.services ?? [];
        setServices(list);
        if (list.length > 0) setSelectedService(list[0].id);
      })
      .catch(() => toast.error('Could not load your services'));
  }, [user, router]);

  const fetchSlots = useCallback(async () => {
    if (!selectedService) return;
    setLoadingSlots(true);
    try {
      const res = await api.get(`/timeslots/${selectedService}`);
      setSlots(res.data.timeSlots);
    } catch {
      toast.error('Failed to load time slots');
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedService]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !newDate) return;

    const start = new Date(`${newDate}T${newStart}:00`);
    const end   = new Date(`${newDate}T${newEnd}:00`);
    if (end <= start) {
      toast.error('End time must be after start time');
      return;
    }

    setAdding(true);
    try {
      await api.post('/timeslots', {
        service_id: selectedService,
        start_time: start.toISOString(),
        end_time:   end.toISOString(),
      });
      toast.success('Time slot added');
      setNewDate('');
      setNewStart('09:00');
      setNewEnd('10:00');
      fetchSlots();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add slot');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (slotId: number) => {
    setDeletingId(slotId);
    try {
      await api.delete(`/timeslots/${slotId}`);
      toast.success('Slot removed');
      setSlots(prev => prev.filter(s => s.id !== slotId));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete slot');
    } finally {
      setDeletingId(null);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const today = new Date().toISOString().split('T')[0];

  return (
    <>
      <Head>
        <title>Manage Availability — BookIt</title>
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Manage Availability</h1>
        </div>

        {/* Service selector */}
        {services.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-6 text-center text-gray-500">
            No services yet.{' '}
            <Link href="/dashboard/add-service" className="text-primary-600 hover:underline">
              Add a service first.
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
              <select
                value={selectedService ?? ''}
                onChange={e => setSelectedService(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.service_name} ({s.duration} min)
                  </option>
                ))}
              </select>
            </div>

            {/* Add slot form */}
            <form onSubmit={handleAdd} className="bg-white rounded-xl shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Add Time Slot</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    min={today}
                    required
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                  <input
                    type="time"
                    required
                    value={newStart}
                    onChange={e => setNewStart(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                  <input
                    type="time"
                    required
                    value={newEnd}
                    onChange={e => setNewEnd(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={adding}
                className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium text-sm"
              >
                {adding ? 'Adding…' : 'Add Slot'}
              </button>
            </form>

            {/* Existing slots */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Upcoming Slots</h2>

              {loadingSlots ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-gray-500 text-sm">No upcoming slots for this service.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {slots.map(slot => (
                    <li key={slot.id} className="flex items-center justify-between py-3 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{fmt(slot.start_time)}</p>
                        <p className="text-xs text-gray-500">ends {fmt(slot.end_time)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {slot.is_booked ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                            Booked
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDelete(slot.id)}
                            disabled={deletingId === slot.id}
                            className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 font-medium"
                          >
                            {deletingId === slot.id ? 'Removing…' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
