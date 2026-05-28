require('dotenv').config();
const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Configuration
const CATEGORIES = [
  'barber', 'tutor', 'spa', 'fitness', 'healthcare',
  'mechanic', 'salon', 'dentist', 'therapist', 'beauty', 'wellness'
];

const KAMPALA_SUBURBS = [
  'Kololo', 'Nakasero', 'Bugolobi', 'Ntinda', 'Muyenga',
  'Kabalagala', 'Mengo', 'Rubaga', 'Makindye', 'Kawempe',
  'Bwaise', 'Wandegeya', 'Mulago', 'Kamwokya', 'Bukoto', 'Naguru'
];

const OTHER_CITIES = [
  'Entebbe', 'Jinja', 'Mbarara', 'Gulu', 'Mbale',
  'Fort Portal', 'Arua', 'Soroti', 'Hoima', 'Kabale',
  'Lira', 'Masaka', 'Mukono', 'Kasese'
];

const SERVICE_TEMPLATES = {
  barber: [
    { name: 'Classic Haircut', price: 110000, duration: 30, desc: 'Professional haircut with styling' },
    { name: 'Beard Trim', price: 55000, duration: 15, desc: 'Beard grooming and shaping' },
    { name: 'Hot Towel Shave', price: 90000, duration: 45, desc: 'Traditional hot towel shave' }
  ],
  tutor: [
    { name: 'Math Tutoring', price: 185000, duration: 60, desc: 'One-on-one mathematics tutoring' },
    { name: 'English Lesson', price: 165000, duration: 60, desc: 'English language and literature' },
    { name: 'Science Class', price: 200000, duration: 60, desc: 'Physics, Chemistry, or Biology tutoring' }
  ],
  spa: [
    { name: 'Swedish Massage', price: 295000, duration: 60, desc: 'Relaxing full body massage' },
    { name: 'Deep Tissue', price: 350000, duration: 60, desc: 'Therapeutic deep tissue massage' },
    { name: 'Facial Treatment', price: 260000, duration: 45, desc: 'Rejuvenating facial treatment' }
  ],
  fitness: [
    { name: 'Personal Training', price: 220000, duration: 60, desc: '1-on-1 fitness coaching' },
    { name: 'Yoga Class', price: 90000, duration: 60, desc: 'Group yoga session' },
    { name: 'HIIT Workout', price: 110000, duration: 45, desc: 'High intensity interval training' }
  ],
  healthcare: [
    { name: 'General Checkup', price: 370000, duration: 30, desc: 'Routine medical examination' },
    { name: 'Consultation', price: 275000, duration: 20, desc: 'Specialist medical consultation' },
    { name: 'Lab Tests', price: 150000, duration: 15, desc: 'Basic laboratory testing services' }
  ],
  mechanic: [
    { name: 'Oil Change', price: 180000, duration: 45, desc: 'Full synthetic oil change and filter' },
    { name: 'Brake Service', price: 250000, duration: 90, desc: 'Brake pad replacement and inspection' },
    { name: 'Diagnostic Scan', price: 100000, duration: 30, desc: 'Computerized engine diagnostic' }
  ],
  salon: [
    { name: 'Hair Styling', price: 150000, duration: 60, desc: 'Wash, cut, and style' },
    { name: 'Manicure', price: 80000, duration: 45, desc: 'Classic manicure with polish' },
    { name: 'Pedicure', price: 100000, duration: 60, desc: 'Relaxing pedicure treatment' }
  ],
  dentist: [
    { name: 'Dental Cleaning', price: 300000, duration: 45, desc: 'Professional teeth cleaning' },
    { name: 'Teeth Whitening', price: 500000, duration: 60, desc: 'Laser teeth whitening session' },
    { name: 'Checkup & X-Ray', price: 250000, duration: 30, desc: 'Dental exam and necessary X-rays' }
  ],
  therapist: [
    { name: 'Counseling Session', price: 200000, duration: 60, desc: 'Individual therapy session' },
    { name: 'Couples Therapy', price: 300000, duration: 90, desc: 'Relationship counseling' },
    { name: 'Stress Management', price: 180000, duration: 60, desc: 'Stress reduction techniques' }
  ],
  beauty: [
    { name: 'Makeup Application', price: 120000, duration: 60, desc: 'Full face professional makeup' },
    { name: 'Eyelash Extensions', price: 150000, duration: 90, desc: 'Classic lash extensions' },
    { name: 'Eyebrow Shaping', price: 40000, duration: 30, desc: 'Threading or waxing' }
  ],
  wellness: [
    { name: 'Nutrition Planning', price: 150000, duration: 60, desc: 'Personalized diet plan' },
    { name: 'Meditation Class', price: 50000, duration: 45, desc: 'Guided meditation session' },
    { name: 'Life Coaching', price: 250000, duration: 60, desc: 'Personal development coaching' }
  ]
};

// Helpers
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Random rating between 3.5 and 5.0, one decimal place
const randomRating = () => Math.round((3.5 + Math.random() * 1.5) * 10) / 10;

// Random review count between 5 and 80
const randomReviewCount = () => Math.floor(5 + Math.random() * 76);

const generateLocation = () => {
  const isKampala = Math.random() > 0.4; // 60% Kampala
  const city = isKampala ? 'Kampala' : getRandom(OTHER_CITIES);
  const suburb = isKampala ? getRandom(KAMPALA_SUBURBS) : city;
  const street = `Plot ${Math.floor(Math.random() * 500) + 1} ${
    ['Main', 'High', 'Market', 'Church', 'Mosque', 'School', 'Hospital'][Math.floor(Math.random() * 7)]
  } Road`;

  return {
    address: street,
    city,
    state: isKampala ? 'Central Region' : 'Uganda',
    zip_code: '00256',
    suburb
  };
};

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    // Clear existing data (order respects FK constraints)
    await db.none('DELETE FROM reviews');
    await db.none('DELETE FROM disputes');
    await db.none('DELETE FROM transactions');
    await db.none('DELETE FROM payments');
    await db.none('DELETE FROM bookings');
    await db.none('DELETE FROM time_slots');
    await db.none('DELETE FROM services');
    await db.none('DELETE FROM businesses');
    await db.none('DELETE FROM users');

    console.log('Cleared existing data');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create Admin
    await db.one(
      `INSERT INTO users (name, email, password, role, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Admin User', 'admin@appointment.com', hashedPassword, 'admin', '0772123456']
    );
    console.log('Created admin user');

    // 2. Create Businesses — 6 per category × 11 categories = 66 total
    let totalBusinesses = 0;

    for (const category of CATEGORIES) {
      console.log(`Seeding ${category} businesses...`);

      for (let i = 1; i <= 6; i++) {
        // Create the business owner user
        const ownerEmail = `${category}${i}@test.com`;
        const ownerName = `${category.charAt(0).toUpperCase() + category.slice(1)} Owner ${i}`;
        const ownerPhone = `0750${(100000 + totalBusinesses).toString().padStart(6, '0')}`;

        const businessUser = await db.one(
          `INSERT INTO users (name, email, password, role, phone)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [ownerName, ownerEmail, hashedPassword, 'business', ownerPhone]
        );

        // Generate location
        const location = generateLocation();
        const businessName = `${location.city} ${category.charAt(0).toUpperCase() + category.slice(1)} ${i}`;

        // Create business profile (approved + with rating + review count)
        const business = await db.one(
          `INSERT INTO businesses
            (user_id, name, description, address, city, state, zip_code,
             category, contact_info, is_approved, rating, total_reviews)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
          [
            businessUser.id,
            businessName,
            `Located in the heart of ${location.suburb}, we provide professional ${category} services.`,
            location.address,
            location.city,
            location.state,
            location.zip_code,
            category,
            ownerEmail,
            true,
            randomRating(),
            randomReviewCount()
          ]
        );

        // Create services for this business
        const templates = SERVICE_TEMPLATES[category];
        for (const template of templates) {
          await db.none(
            `INSERT INTO services (business_id, service_name, description, price, duration)
             VALUES ($1, $2, $3, $4, $5)`,
            [business.id, template.name, template.desc, template.price, template.duration]
          );
        }

        totalBusinesses++;
      }
    }

    console.log(`\n✅ Successfully seeded ${totalBusinesses} businesses across ${CATEGORIES.length} categories!`);
    console.log('   - All approved (visible to customers)');
    console.log('   - All have services');
    console.log('   - All have ratings and review counts (display-only)');
    console.log('   - No bookings, no timeslots');
    console.log('\n🔑 Test Credentials:');
    console.log('   Admin:      admin@appointment.com / password123');
    console.log('   Businesses: [category][1-6]@test.com / password123');
    console.log('   e.g.        barber1@test.com, salon3@test.com, spa5@test.com');
    console.log('\n   Customers: register through the UI as needed.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedDatabase();