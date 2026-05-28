import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
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
  is_approved: boolean;
}

export default function Businesses() {
  const { user } = useAuth();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const categories = ['barber', 'tutor', 'mechanic', 'salon', 'spa', 'dentist', 'therapist', 'fitness', 'beauty', 'wellness', 'healthcare'];

  const searchTermRef = useRef(searchTerm);

  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

  const fetchBusinesses = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 12, page };
      if (category) params.category = category;
      if (searchTermRef.current) params.search = searchTermRef.current;

      const response = await api.get('/businesses', { params });

      if (page === 1) {
        setBusinesses(response.data.businesses);
      } else {
        setBusinesses(prev => [...prev, ...response.data.businesses]);
      }

      setHasMore(response.data.businesses.length === 12);
    } catch (error: any) {
      toast.error('Failed to load businesses');
    } finally {
      setLoading(false);
    }
  }, [category, page]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBusinesses();
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setPage(1);
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  return (
    <>
      <Head>
        <title>Browse Businesses - BookIt</title>
        <meta name="description" content="Find and book appointments with local businesses" />
      </Head>

      <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
        {/* Header Section */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Browse Businesses</h1>
            <p className="text-xl text-gray-600">Find the perfect service provider for your needs</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search and Filters */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Search businesses by name or service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-5 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                />
                <button
                  type="submit"
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-md"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Category Filters */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Filter by Category</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleCategoryChange('')}
                  className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200 ${category === ''
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200 ${category === cat
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="mb-6">
            <p className="text-gray-600">
              {loading && page === 1 ? (
                'Loading...'
              ) : (
                <>
                  Showing <span className="font-semibold text-gray-900">{businesses.length}</span> businesses
                  {category && <> in <span className="font-semibold text-blue-600">{category}</span></>}
                </>
              )}
            </p>
          </div>

          {/* Business Grid */}
          {loading && page === 1 ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading businesses...</p>
            </div>
          ) : businesses.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {businesses.map((business, index) => (
                  <div
                    key={business.id}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden card-hover border border-gray-100 animate-fade-in"
                    style={{ animationDelay: `${(index % 12) * 0.05}s` }}
                  >
                    <div className="h-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-bold text-gray-800">{business.name}</h3>
                            {!business.is_approved && (
                              <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                                Pending
                              </span>
                            )}
                          </div>
                          <span className="inline-block px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 text-xs font-semibold rounded-full">
                            {business.category}
                          </span>
                        </div>
                      </div>

                      <p className="text-gray-600 mb-4 line-clamp-2 min-h-[3rem]">{business.description}</p>

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center bg-yellow-50 px-3 py-1 rounded-full">
                          <span className="text-yellow-500 text-lg">★</span>
                          <span className="ml-1 text-sm font-semibold text-gray-700">
                            {business.rating ? Number(business.rating).toFixed(1) : '0.0'}
                          </span>
                          <span className="ml-1 text-xs text-gray-500">
                            ({business.total_reviews || 0})
                          </span>
                        </div>
                        {business.city && (
                          <p className="text-sm text-gray-500 font-medium">📍 {business.city}</p>
                        )}
                      </div>

                      <Link
                        href={`/business/${business.id}`}
                        className="block w-full text-center px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-md"
                      >
                        View Details & Book →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="text-center mt-12">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl border-2 border-blue-600 hover:bg-blue-50 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Loading...' : 'Load More Businesses'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No businesses found</h3>
              <p className="text-gray-600 mb-6">Try adjusting your search or filters</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCategory('');
                  setPage(1);
                }}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
