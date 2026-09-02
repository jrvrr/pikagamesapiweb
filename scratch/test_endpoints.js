async function testEndpoints() {
  const baseUrl = 'http://localhost:5000/api';
  console.log('--- Probando Endpoints Activos ---');

  // 1. Registro
  console.log('\\n[POST] /api/auth/registro');
  try {
    const res = await fetch(`${baseUrl}/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Test', apellidos: 'User', email: 'test@example.com', password: 'password123' })
    });
    console.log('Status:', res.status);
    console.log('Response:', await res.json());
  } catch (err) { console.error('Error:', err.message); }

  // 2. Login
  console.log('\\n[POST] /api/auth/login');
  let token = '';
  try {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', data);
    if (data.token) token = data.token;
  } catch (err) { console.error('Error:', err.message); }

  // 3. Obtener Videojuegos
  console.log('\\n[GET] /api/videojuegos/');
  try {
    const res = await fetch(`${baseUrl}/videojuegos/`);
    console.log('Status:', res.status);
    console.log('Response:', await res.json());
  } catch (err) { console.error('Error:', err.message); }
}

testEndpoints();
