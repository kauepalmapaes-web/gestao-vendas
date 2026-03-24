const url = 'https://qfrsktdectlwlyfpsuzl.supabase.co/auth/v1/signup';
const apikey = 'sb_publishable_O2o2QthySnYnuqhW-Qxu_A_TlhQa4Ww';

const users = [
  { email: 'kauekurosaki@gmail.com', password: 'kaue1234' },
  { email: 'julia@estetica.com', password: 'Julia1234' },
  { email: 'ilash@ilash.com', password: 'Ilash1234' }
];

async function createUsers() {
  for (const user of users) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': apikey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(user)
    });
    const data = await res.json();
    console.log(`User ${user.email} response:`, data);
  }
}

createUsers();
