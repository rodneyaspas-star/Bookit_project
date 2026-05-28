import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import Link from 'next/link';

export default function BusinessSetup() {
  const { user } = useAuth();
  const router = useRouter();

  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'business') {
      router.push('/');
      return;
    }
  }, [user, router]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setLogoFile(file || null);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setLogoPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category) {
      toast.error('Category is required');
      return;
    }

    setSubmitting(true);

    try {
      const payload: any = {
        name: user?.name || '',
        category,
        description,
        address: '',
        city: location,
        state: '',
        zip_code: '',
        contact_info: '',
        image_url: logoPreview || '',
      };

      await api.post('/businesses', payload);
      toast.success('Business profile created successfully');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create business profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Create Business Profile - BookIt</title>
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-primary-600 hover:text-primary-500">
            ← Back to dashboard
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Create your business profile
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Add your business details so customers can find and book you.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Logo upload */}
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo
                </label>
                <div className="flex flex-col items-center">
                  <div className="w-28 h-28 rounded-full bg-gray-50 flex items-center justify-center overflow-hidden border border-dashed border-gray-300 mb-3">
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-400 text-xs text-center px-2">
                        Logo preview
                      </span>
                    )}
                  </div>
                  <label className="inline-flex items-center px-3 py-2 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                    <span>Upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                  </label>
                  <p className="mt-2 text-[11px] text-gray-500 text-center">
                    PNG or JPG, up to ~1MB recommended.
                  </p>
                </div>
              </div>

              {/* Business details */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="">Select a category</option>
                    <option value="barber">Barber</option>
                    <option value="spa">Spa</option>
                    <option value="tutor">Tutor</option>
                    <option value="mechanic">Mechanic</option>
                    <option value="salon">Salon</option>
                    <option value="dentist">Dentist</option>
                    <option value="therapist">Therapist</option>
                    <option value="fitness">Fitness</option>
                    <option value="beauty">Beauty</option>
                    <option value="wellness">Wellness</option>
                    <option value="healthcare">Healthcare</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="City or area where your business operates"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="Tell customers what you offer."
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving profile...' : 'Save profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}


