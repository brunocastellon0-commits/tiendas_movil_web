import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSqlConnection } from '@/utils/mssql';

// Cliente con permisos de admin para escribir en tablas protegidas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    const pool = await getSqlConnection();
    
    // --- DEFINICIÓN GLOBAL DEL TAMAÑO DE LOTE ---
    const batchSize = 100; // <--- CORRECCIÓN: Declarado aquí para que todos lo usen

    // ==============================================================================
    // PASO 1: SINCRONIZAR EMPLEADOS (Vendedores)
    // ==============================================================================
    const sqlEmployees = await pool.request().query(`
      SELECT idemp, empcod, empnom, emptel, empemail, empcar 
      FROM tbemp 
      WHERE empest = 1 
    `);

    if (sqlEmployees.recordset.length > 0) {
      const employeesToUpsert = sqlEmployees.recordset.map((e: any) => {
        const emailGenerado = e.empemail && e.empemail.includes('@') 
          ? e.empemail.trim() 
          : `vendedor_${e.empcod.trim()}@tiendasmovil.com`;

        return {
          legacy_id: e.idemp,
          full_name: e.empnom ? e.empnom.trim() : 'Sin Nombre',
          email: emailGenerado,
          phone: e.emptel ? e.emptel.trim() : '',
          job_title: e.empcar ? e.empcar.trim() : 'Preventista',
          status: 'Activo',
          role: 'user'
        };
      });

      const { error: empError } = await supabase
        .from('employees')
        .upsert(employeesToUpsert, { onConflict: 'legacy_id' });

      if (empError) console.error('Error sync empleados:', empError);
    }

    // ==============================================================================
    // PASO 2: CREAR MAPA DE VINCULACIÓN (SQL ID -> Supabase UUID)
    // ==============================================================================
    const { data: sbEmployees } = await supabase
      .from('employees')
      .select('id, legacy_id');
    
    const vendorMap = new Map();
    sbEmployees?.forEach(emp => {
      if (emp.legacy_id) vendorMap.set(emp.legacy_id, emp.id);
    });

    // ==============================================================================
    // PASO 3: SINCRONIZAR CLIENTES Y ASIGNAR VENDEDOR
    // ==============================================================================
    const sqlClients = await pool.request().query(`
      SELECT clicod, clinom, clinit, clidir, clitel, clitlimcre, idven 
      FROM tbcli 
      WHERE cliest = 0 
    `);

    if (sqlClients.recordset.length > 0) {
      const clientsToUpsert = sqlClients.recordset.map((c: any) => {
        const vendedorUUID = vendorMap.get(c.idven) || null;

        return {
          code: c.clicod ? c.clicod.trim() : '',
          name: c.clinom ? c.clinom.trim() : 'Sin nombre',
          tax_id: c.clinit ? c.clinit.trim() : '',
          address: c.clidir ? c.clidir.trim() : '',
          phones: c.clitel ? c.clitel.trim() : '',
          credit_limit: c.clitlimcre || 0,
          vendor_id: vendedorUUID,
          status: 'Vigente'
        };
      });

      // Insertamos en lotes
      for (let i = 0; i < clientsToUpsert.length; i += batchSize) {
        const batch = clientsToUpsert.slice(i, i + batchSize);
        const { error: cliError } = await supabase
          .from('clients')
          .upsert(batch, { onConflict: 'code' });

        if (cliError) console.error('Error insertando lote clientes:', cliError);
      }
    }

    // ==============================================================================
    // PASO 4: SINCRONIZAR PRODUCTOS
    // ==============================================================================
    const sqlProducts = await pool.request().query(`
      SELECT prdcod, prdnom, prdpoficial, prdstmax, prdstmin, prdunid 
      FROM tbprd WHERE prdest = 0 
    `);

    if (sqlProducts.recordset.length > 0) {
      const productsToUpsert = sqlProducts.recordset.map((p: any) => ({
        codigo_producto: p.prdcod.trim(),
        nombre_producto: p.prdnom.trim(),
        precio_base_venta: p.prdpoficial,
        stock_actual: p.prdstmax,
        stock_min: p.prdstmin,
        unidad_base_venta: p.prdunid || 'UND',
        estado: 'Activo'
      }));

      // Ahora 'batchSize' ya es visible aquí también
      for (let i = 0; i < productsToUpsert.length; i += batchSize) {
        const batch = productsToUpsert.slice(i, i + batchSize);
        await supabase.from('productos').upsert(batch, { onConflict: 'codigo_producto' });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sync Completo: ${sqlEmployees.recordset.length} Empleados, ${sqlClients.recordset.length} Clientes, ${sqlProducts.recordset.length} Productos.` 
    });

  } catch (error: any) {
    console.error('Error FATAL en Pull-All:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}