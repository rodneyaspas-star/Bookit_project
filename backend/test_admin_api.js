const API_URL = 'http://localhost:5000/api';

async function testAdminApi() {
    try {
        // 1. Login as admin
        console.log('Logging in as admin...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@appointment.com',
                password: 'password123'
            })
        });

        if (!loginRes.ok) {
            const err = await loginRes.json();
            throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(err)}`);
        }

        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('Login successful, token received.');

        // 2. Access admin stats
        console.log('Accessing /api/admin/stats...');
        const statsRes = await fetch(`${API_URL}/admin/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!statsRes.ok) {
            const err = await statsRes.json();
            throw new Error(`Admin stats failed: ${statsRes.status} ${JSON.stringify(err)}`);
        }

        const statsData = await statsRes.json();
        console.log('Admin stats access successful:', statsData);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testAdminApi();
