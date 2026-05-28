require('dotenv').config();
const db = require('./config/database');

async function checkAdminRole() {
    try {
        const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', ['admin@appointment.com']);
        if (user) {
            console.log('User found:', user);
        } else {
            console.log('User not found');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAdminRole();
