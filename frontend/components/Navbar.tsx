import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-white/95 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          {/* Logo and Main Navigation */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <span className="ml-3 text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                BookIt
              </span>
            </Link>
            
            <div className="hidden md:ml-10 md:flex md:space-x-2">
              <Link 
                href="/" 
                className="text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2"
              >
                <span></span> Home
              </Link>
              <Link 
                href="/businesses" 
                className="text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2"
              >
                <span></span> Browse
              </Link>
            </div>
          </div>

          {/* User Actions */}
          <div className="hidden md:flex md:items-center md:space-x-3">
            {user ? (
              <>
                {user.role === 'business' && (
                  <Link 
                    href="/dashboard" 
                    className="text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2"
                  >
                    <span>📊</span> Dashboard
                  </Link>
                )}
                {user.role === 'customer' && (
                  <Link 
                    href="/my-bookings" 
                    className="text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2"
                  >
                    <span>📅</span> My Bookings
                  </Link>
                )}
                {user.role === 'admin' && (
                  <Link 
                    href="/admin" 
                    className="text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2"
                  >
                    <span>⚙️</span> Admin
                  </Link>
                )}
                <div className="flex items-center bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 rounded-xl border border-blue-200">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-2">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-gray-800 font-semibold text-sm">
                    {user.name}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="px-5 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 shadow-lg text-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="text-gray-700 hover:text-blue-600 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:bg-blue-50"
                >
                  Login
                </Link>
                <Link 
                  href="/signup" 
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg text-sm"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2.5 rounded-xl text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white shadow-xl animate-slide-up">
          <div className="px-4 pt-2 pb-4 space-y-2">
            <Link 
              href="/" 
              className="block px-4 py-3 rounded-xl text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-600 font-semibold transition-all duration-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              🏠 Home
            </Link>
            <Link 
              href="/businesses" 
              className="block px-4 py-3 rounded-xl text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-600 font-semibold transition-all duration-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              🏢 Browse Businesses
            </Link>
            {user ? (
              <>
                {user.role === 'business' && (
                  <Link 
                    href="/dashboard" 
                    className="block px-4 py-3 rounded-xl text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-600 font-semibold transition-all duration-200"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    📊 Dashboard
                  </Link>
                )}
                {user.role === 'customer' && (
                  <Link 
                    href="/my-bookings" 
                    className="block px-4 py-3 rounded-xl text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-600 font-semibold transition-all duration-200"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    📅 My Bookings
                  </Link>
                )}
                {user.role === 'admin' && (
                  <Link 
                    href="/admin" 
                    className="block px-4 py-3 rounded-xl text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-600 font-semibold transition-all duration-200"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    ⚙️ Admin Panel
                  </Link>
                )}
                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 my-2">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{user.name}</p>
                      <p className="text-xs text-gray-600">{user.email}</p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }} 
                  className="w-full text-center px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold hover:from-red-600 hover:to-pink-600 transition-all duration-300 shadow-lg"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="block px-4 py-3 rounded-xl text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-600 font-semibold transition-all duration-200"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
                <Link 
                  href="/signup" 
                  className="block text-center px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
