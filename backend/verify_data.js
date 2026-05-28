require('dotenv').config({ path: './backend/.env' });
const db = require('./config/database');

async function verifyData() {
    try {
        const businessCount = await db.one('SELECT count(*) FROM businesses');
        const serviceCount = await db.one('SELECT count(*) FROM services');
        const userCount = await db.one('SELECT count(*) FROM users');

        console.log('--- Database Verification ---');
        console.log(`Total Users: ${userCount.count}`);
        console.log(`Total Businesses: ${businessCount.count}`);
        console.log(`Total Services: ${serviceCount.count}`);

        const categories = await db.any('SELECT category, count(*) FROM businesses GROUP BY category');
        console.log('\nBusinesses per Category:');
        categories.forEach(c => console.log(`${c.category}: ${c.count}`));

        const sampleBusiness = await db.oneOrNone('SELECT * FROM businesses LIMIT 1');
        console.log('\nSample Business:', sampleBusiness ? sampleBusiness.name : 'None');
        console.log('Sample Location:', sampleBusiness ? sampleBusiness.city : 'None');

        process.exit(0);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

verifyData();
