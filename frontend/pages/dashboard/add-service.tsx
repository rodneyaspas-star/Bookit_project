import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';
import { toast } from 'react-toastify';

export default function AddService() {
  const { user } = useAuth();
  const router = useRouter();

  const [businessId, setBusinessId] = useState<number | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingBusiness, setLoadingBusiness] = useState(true);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'business') { router.push('/'); return; }

    api.get('/businesses/my/profile')
      .then(res => setBusinessId(res.data.id))
      .catch(() => toast.error('Could not load your business profile'))
      .finally(() => setLoadingBusiness(false));
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) { toast.error('Business profile not found'); return; }

    const priceNum = parseFloat(price);
    const durationNum = parseInt(duration);

    if (isNaN(priceNum) || priceNum < 500) { toast.error('Price must be at least UGX 500'); return; }
    if (isNaN(durationNum) || durationNum <= 0) { toast.error('Enter a valid duration in minutes'); return; }

    setSubmitting(true);
    try {
      await api.post('/services', {
        business_id: businessId,
        service_name: serviceName.trim(),
        description: description.trim(),
        price: priceNum,
        duration: durationNum
      });
      toast.success('Service added successfully');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add service');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingBusiness) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Add Service — BookIt</title>
      </Head>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-primary-600 hover:text-primary-500">
            ← Back to dashboard
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Add a Service</h1>
          <p className="text-sm text-gray-500 mb-6">Services are listed on your public profile for customers to book.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={serviceName}
                onChange={e => setServiceName(e.target.value)}
                maxLength={255}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="e.g. Haircut, Deep tissue massage"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                maxLength={1000}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="What does this service include?"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (UGX) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min={500}
                  step={500}
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="e.g. 30000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min={5}
                  max={480}
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="e.g. 60"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Link
                href="/dashboard"
                className="flex-1 text-center py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
              >
                {submitting ? 'Saving…' : 'Add Service'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
