const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const sbAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function syncAuth() {
  console.log('Obteniendo empleados...');
  const { data: employees, error: empErr } = await sbAdmin.from('employees').select('*').not('email', 'is', null);
  if (empErr) {
    console.error('Error fetching employees:', empErr);
    return;
  }

  const { data: { users }, error: authErr } = await sbAdmin.auth.admin.listUsers();
  
  const authEmails = new Set(users.map(u => u.email.toLowerCase()));
  
  const pass = 'Movil2025*';
  
  for (const emp of employees) {
    if (authEmails.has(emp.email.toLowerCase())) {
      console.log(`✔️ [${emp.email}] ya tiene cuenta Auth.`);
      continue;
    }
    
    console.log(`CREANDO: [${emp.email}]...`);
    const { data: newUser, error: createErr } = await sbAdmin.auth.admin.createUser({
      email: emp.email,
      password: pass,
      email_confirm: true,
      user_metadata: { full_name: emp.full_name }
    });
    
    if (createErr) {
      console.error(`❌ Error creando ${emp.email}:`, createErr);
    } else {
      console.log(`✅ Creado exitosamente: ${emp.email} - ID: ${newUser.user.id}`);
      // IF the id is different, maybe update employees using email?
    }
  }
}

syncAuth().catch(console.error);
