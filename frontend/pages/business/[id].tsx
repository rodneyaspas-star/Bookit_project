import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { toast } from 'react-toastify';

interface Business {
  id: number;
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  category: string;
  contact_info: string;
  rating: number;
  total_reviews: number;
  owner_name: string;
  owner_phone: string;
  services: Service[];
}

interface Service {
  id: number;
  service_name: string;
  description: string;
  price: number;
  duration: number;
}

interface Review {
  id: number;
  rating: number;
  comment: string;
  customer_name: string;
  created_at: string;
}

export default function BusinessProfile() {
  const router = useRouter();
  const { id } = router.query;

  const [business, setBusiness] = useState<Business | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBusiness = useCallback(async () => {
    try {
      const response = await api.get(`/businesses/${id}`);
      setBusiness(response.data);
    } catch (error) {
      toast.error('Failed to load business details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReviews = useCallback(async () => {
    try {
      const response = await api.get(`/reviews/business/${id}`);
      setReviews(response.data.reviews);
    } catch (error) {
      console.error('Failed to load reviews');
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchBusiness();
      fetchReviews();
    }
  }, [id, fetchBusiness, fetchReviews]);

  const handleBooking = () => {
    if (!selectedService || !requestedDate || !requestedTime) {
      toast.error('Please select a service, date, and time');
      return;
    }

    router.push({
      pathname: '/booking/create',
      query: {
        business_id: id,
        service_id: selectedService.id,
        requested_date: requestedDate,
        requested_time: requestedTime,
      }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="text-center py-12">
        <p>Business not found</p>
        <Link href="/" className="text-primary-600 hover:underline mt-4 inline-block">
          Go back home
        </Link>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{business.name} - BookIt</title>
      </Head>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Business Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{business.name}</h1>
              <span className="inline-block px-3 py-1 bg-primary-100 text-primary-600 text-sm rounded-full mb-4">
                {business.category}
              </span>
              <p className="text-gray-600 mb-4">{business.description}</p>
              <div className="space-y-2 text-sm text-gray-600">
                {business.address && (
                  <p>📍 {business.address}, {business.city}, {business.state}</p>
                )}
                {business.contact_info && <p>📞 {business.contact_info}</p>}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center mb-2">
                <span className="text-3xl text-yellow-400 mr-2">★</span>
                <div>
                  <div className="text-2xl font-bold">{business.rating ? Number(business.rating).toFixed(1) : '0.0'}</div>
                  <div className="text-sm text-gray-500">{business.total_reviews || 0} reviews</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Services */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">Services</h2>
              <div className="space-y-4">
                {business.services && business.services.length > 0 ? (
                  business.services.map((service) => (
                    <div
                      key={service.id}
                      className={`border rounded-lg p-4 cursor-pointer transition ${selectedService?.id === service.id
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'
                        }`}
                      onClick={() => setSelectedService(service)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{service.service_name}</h3>
                          <p className="text-gray-600 text-sm mt-1">{service.description}</p>
                          <p className="text-sm text-gray-500 mt-2">⏱️ {service.duration} minutes</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary-600">UGX {service.price.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No services available</p>
                )}
              </div>
            </div>

            {/* Reviews */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-4">Reviews</h2>
              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b pb-4 last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold">{review.customer_name}</p>
                        <div className="flex items-center">
                          <span className="text-yellow-400 mr-1">★</span>
                          <span>{review.rating}/5</span>
                        </div>
                      </div>
                      <p className="text-gray-600">{review.comment}</p>
                      <p className="text-sm text-gray-400 mt-2">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No reviews yet</p>
              )}
            </div>
          </div>

          {/* Booking Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4">Book Appointment</h2>

              {selectedService ? (
                <>
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <p className="font-semibold">{selectedService.service_name}</p>
                    <p className="text-sm text-gray-600">UGX {selectedService.price.toLocaleString()} · {selectedService.duration} min</p>
                  </div>

                  <h3 className="font-semibold mb-3">Choose Date &amp; Time</h3>
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        min={(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })()}
                        value={requestedDate}
                        onChange={e => setRequestedDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                      <input
                        type="time"
                        value={requestedTime}
                        onChange={e => setRequestedTime(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleBooking}
                    disabled={!requestedDate || !requestedTime}
                    className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue to Booking
                  </button>
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  Select a service to choose a date and time
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
