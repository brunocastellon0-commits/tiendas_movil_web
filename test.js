const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const sbAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const anonRes = await sb.from('detalle_pedido').select('*').limit(1);
  console.log('ANON:', anonRes.data, anonRes.error);
  
  const adminRes = await sbAdmin.from('detalle_pedido').select('*').limit(1);
  console.log('ADMIN:', adminRes.data);
}

test();
