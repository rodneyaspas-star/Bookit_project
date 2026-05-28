import Head from 'next/head';
import Link from 'next/link';

export default function SignupChoice() {
  return (
    <>
      <Head>
        <title>Sign Up - BookIt</title>
      </Head>

      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              How would you like to sign up?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Choose the option that best describes you to continue.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Customer option */}
            <Link
              href="/signup/customer"
              className="group flex flex-col items-center justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg hover:border-blue-500 transition-all duration-200 cursor-pointer"
            >
              <div className="flex flex-col items-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-3xl group-hover:bg-blue-100">
                  <span>👤</span>
                </div>
                <div className="text-center">
                  <h3 className="text-base font-semibold text-gray-900">Customer</h3>
                  <p className="mt-1 text-xs text-gray-600">
                    I want to discover and book services from local businesses.
                  </p>
                </div>
              </div>
            </Link>

            {/* Business option */}
            <Link
              href="/signup/business"
              className="group flex flex-col items-center justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg hover:border-indigo-500 transition-all duration-200 cursor-pointer"
            >
              <div className="flex flex-col items-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-3xl group-hover:bg-indigo-100">
                  <span>🏢</span>
                </div>
                <div className="text-center">
                  <h3 className="text-base font-semibold text-gray-900">Business</h3>
                  <p className="mt-1 text-xs text-gray-600">
                    I want to list my company and manage customer bookings.
                  </p>
                </div>
              </div>
            </Link>
          </div>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
