# Getting Started with Appointment Booking Platform

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn package manager

## Quick Start Guide

### 1. Clone or Navigate to Project

```bash
cd c:\Users\LOSIKA\Desktop\mukama
```

### 2. Backend Setup

#### Install Dependencies

```bash
cd backend
npm install
```

#### Configure Environment

1. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` file with your settings:
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/appointment_db
   JWT_SECRET=your_super_secret_jwt_key_change_in_production
   JWT_EXPIRES_IN=7d
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_specific_password
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   PORT=5000
   NODE_ENV=development
   ```

#### Setup Database

1. Create PostgreSQL database:
   ```sql
   CREATE DATABASE appointment_db;
   ```

2. Run migrations:
   ```bash
   npm run migrate
   ```

3. Seed test data (optional):
   ```bash
   npm run seed
   ```

#### Start Backend Server

```bash
npm run dev
```

Server will start on http://localhost:5000

### 3. Frontend Setup

#### Install Dependencies

Open a new terminal and run:

```bash
cd frontend
npm install
```

#### Configure Environment

1. Copy the example environment file:
   ```bash
   copy .env.local.example .env.local
   ```

2. Edit `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key
   ```

#### Start Frontend Server

```bash
npm run dev
```

Frontend will start on http://localhost:3000

## Test Accounts

After running the seed script, you can use these test accounts:

### Customer Account
- **Email**: customer@test.com
- **Password**: password123

### Business Account
- **Email**: barber@test.com
- **Password**: password123

### Admin Account
- **Email**: admin@appointment.com
- **Password**: password123

## Email Configuration

### Using Gmail

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to Google Account Settings
   - Security → 2-Step Verification
   - App Passwords
   - Select "Mail" and your device
   - Copy the generated password

3. Use this password in your `.env` file:
   ```env
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_16_character_app_password
   ```

### Using Other Email Services

Update these settings in `.env`:
- **Outlook**: `smtp.office365.com` (Port: 587)
- **Yahoo**: `smtp.mail.yahoo.com` (Port: 587)
- **Custom SMTP**: Use your provider's settings

## Stripe Setup

1. Create a Stripe account at https://stripe.com
2. Get your API keys from the Dashboard
3. Add them to your environment files:
   - Backend `.env`: `STRIPE_SECRET_KEY`
   - Frontend `.env.local`: `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`

## Project Structure

```
mukama/
├── backend/
│   ├── config/          # Database configuration
│   ├── database/        # Migrations and seeds
│   ├── middleware/      # Auth middleware
│   ├── routes/          # API routes
│   ├── utils/           # Email and payment utilities
│   └── server.js        # Express server
│
├── frontend/
│   ├── components/      # React components
│   ├── context/         # Auth context
│   ├── lib/            # API client
│   ├── pages/          # Next.js pages
│   ├── styles/         # Global styles
│   └── public/         # Static assets
│
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Businesses
- `GET /api/businesses` - List all businesses
- `GET /api/businesses/:id` - Get business details
- `POST /api/businesses` - Create/update business (Auth required)

### Services
- `GET /api/services/:business_id` - Get services for a business
- `POST /api/services` - Add service (Business auth required)
- `PUT /api/services/:id` - Update service
- `DELETE /api/services/:id` - Delete service

### Time Slots
- `GET /api/timeslots/:service_id` - Get available time slots
- `POST /api/timeslots` - Add time slot (Business auth required)
- `DELETE /api/timeslots/:id` - Delete time slot

### Bookings
- `POST /api/bookings` - Create booking (Auth required)
- `GET /api/bookings/:id` - Get booking details
- `GET /api/bookings/customer/my` - Get customer's bookings
- `GET /api/bookings/business/:business_id` - Get business bookings
- `PUT /api/bookings/:id/cancel` - Cancel booking

### Reviews
- `POST /api/reviews` - Create review (Auth required)
- `GET /api/reviews/business/:business_id` - Get business reviews

### Admin
- `GET /api/admin/businesses` - List all businesses
- `PUT /api/admin/businesses/:id` - Approve/reject business
- `GET /api/admin/stats` - Platform statistics

## Development Tips

### Testing API Endpoints

Use tools like Postman or Thunder Client:

1. Login to get JWT token:
   ```json
   POST http://localhost:5000/api/auth/login
   {
     "email": "customer@test.com",
     "password": "password123"
   }
   ```

2. Use the token in Authorization header:
   ```
   Authorization: Bearer <your_token_here>
   ```

### Database Management

View all tables:
```sql
\dt
```

Query bookings:
```sql
SELECT * FROM bookings;
```

Reset database:
```bash
# Drop all tables and re-run migrations
npm run migrate
npm run seed
```

## Troubleshooting

### Port Already in Use

Backend (5000):
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

Frontend (3000):
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database Connection Issues

1. Ensure PostgreSQL is running
2. Check DATABASE_URL in `.env`
3. Verify database exists:
   ```sql
   \l
   ```

### Module Not Found Errors

```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json .next
npm install
```

## Next Steps

1. ✅ Set up local development environment
2. ✅ Test all features (booking, cancellation, reviews)
3. ⚙️ Configure Stripe for payments
4. ⚙️ Set up email notifications
5. 🚀 Deploy to production (see DEPLOYMENT.md)

## Additional Features to Implement

- [ ] SMS notifications via Twilio
- [ ] Calendar integration (Google Calendar)
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] Push notifications
- [ ] Social media login (OAuth)
- [ ] Invoice generation (PDF)

## Support

For issues or questions:
1. Check the API documentation
2. Review error logs in terminal
3. Check database for data integrity
4. Verify environment variables are set correctly

## License

MIT License - See LICENSE file for details
