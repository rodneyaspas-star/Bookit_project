import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';
import { toast } from 'react-toastify';

export default function CreateReview() {
  const router = useRouter();
  const { booking_id } = router.query;
  const { user } = useAuth();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hovered, setHovered] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a star rating');
      return;
    }
    if (!booking_id) {
      toast.error('Invalid booking reference');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/reviews', {
        booking_id: parseInt(booking_id as string),
        rating,
        comment: comment.trim()
      });
      toast.success('Review submitted — thank you!');
      router.push(`/booking/${booking_id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Leave a Review — BookIt</title>
      </Head>

      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link href={`/booking/${booking_id}`} className="text-sm text-primary-600 hover:text-primary-500">
            ← Back to booking
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Leave a Review</h1>
          <p className="text-sm text-gray-500 mb-6">Share your experience to help others.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Star picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    className="text-3xl focus:outline-none transition-transform hover:scale-110"
                  >
                    <span className={(hovered || rating) >= star ? 'text-yellow-400' : 'text-gray-300'}>
                      ★
                    </span>
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][rating]}
                </p>
              )}
            </div>

            {/* Comment */}
            <div>
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
                Comment <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="comment"
                rows={4}
                value={comment}
                onChange={e => setComment(e.target.value)}
                maxLength={1000}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Describe your experience…"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{comment.length}/1000</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Link
                href={`/booking/${booking_id}`}
                className="flex-1 text-center py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || rating === 0}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {submitting ? 'Submitting…' : 'Submit Review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
