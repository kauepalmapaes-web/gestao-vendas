const url = 'https://qfrsktdectlwlyfpsuzl.supabase.co/auth/v1/token?grant_type=password';
const apikey = 'sb_publishable_O2o2QthySnYnuqhW-Qxu_A_TlhQa4Ww';

async function testLogin(email, password) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': apikey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  console.log(`Login ${email}:`, data);
}

testLogin('kauekurosaki@gestaopro.com.br', 'kaue1234');
testLogin('juliaestetica@gestaopro.com.br', 'Julia1234');
testLogin('ilash@gestaopro.com.br', 'Ilash1234');
