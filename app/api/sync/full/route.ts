import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Tipo para el reporte de resultados
type SyncResult = { 
  tabla: string; 
  direccion: 'SQL→Supabase' | 'Supabase→SQL'; 
  procesados: number; 
  errores: number; 
  mensaje: string; 
};

export async function GET() {
  const results: SyncResult[] = [];
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // URL de la Mini-API local (Cloudflare)
    const API_OFICINA = process.env.NEXT_PUBLIC_API_OFICINA || 'https://db-sql.tiendasmovil.com';
    const batchSize = 100;

    // ==================================================================
    // BLOQUE A: SOLICITAR DATOS A LA OFICINA (PULL)
    // ==================================================================
    const pullResponse = await fetch(`${API_OFICINA}/api/pull`);
    if (!pullResponse.ok) throw new Error(`La API de la oficina no responde: ${pullResponse.status}`);
    const pullData = await pullResponse.json();

    // 1. ZONAS (RUTAS) - Sincronizar primero para poder vincular clientes
    if (pullData.zones?.length > 0) {
      const toUpsert = pullData.zones.map((z: any) => ({
        legacy_id: z.idz || z.idzon, // Ajuste según tu SQL
        name: z.zonnom || z.zonom || 'Sin Nombre'
      }));
      const { error } = await supabase.from('zones').upsert(toUpsert, { onConflict: 'legacy_id' });
      results.push({ tabla: 'zones', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: error ? 1 : 0, mensaje: error ? error.message : 'Zonas listas' });
    }

    // 2. EMPLEADOS
    if (pullData.employees?.length > 0) {
      const toUpsert = pullData.employees.map((e: any) => ({
        legacy_id: e.idemp,
        full_name: e.empnom ? e.empnom.trim() : 'Sin Nombre',
        email: e.empemail?.includes('@') ? e.empemail.trim() : `vendedor_${e.idemp}@tiendasmovil.com`,
        phone: e.emptel ? e.emptel.trim() : '',
        job_title: e.empcar ? e.empcar.trim() : 'Ventas',
        status: 'Activo',
        role: 'user'
      }));
      const { error } = await supabase.from('employees').upsert(toUpsert, { onConflict: 'legacy_id' });
      results.push({ tabla: 'employees', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: error ? 1 : 0, mensaje: error ? error.message : 'Empleados listos' });
    }

    // 3. CATEGORÍAS (idlinea en tu JSON)
    if (pullData.categories?.length > 0) {
      const toUpsert = pullData.categories.map((c: any) => ({
        legacy_id: c.idlinea,
        nombre_categoria: c.linnom?.trim() || '',
        codigo_categoria: c.lincod?.trim() || ''
      }));
      for (let i = 0; i < toUpsert.length; i += batchSize) {
        await supabase.from('categorias').upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'nombre_categoria' });
      }
      results.push({ tabla: 'categorias', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: 'Categorías listas' });
    }

    // 4. PROVEEDORES (idprv en tu JSON)
    if (pullData.providers?.length > 0) {
      const toUpsert = pullData.providers.map((p: any) => ({
        legacy_id: p.idprv,
        codigo: p.prvcod?.trim() || '',
        nombre: p.prvnom?.trim() || '',
        razon_social: p.prvraz?.trim() || '',
        nit_ci: p.prvnit?.trim() || '',
        direccion: p.prvdir?.trim() || '',
        telefono: p.prvtel?.trim() || ''
      }));
      for (let i = 0; i < toUpsert.length; i += batchSize) {
        await supabase.from('proveedores').upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'codigo' });
      }
      results.push({ tabla: 'proveedores', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: 'Proveedores listos' });
    }

    // 5. PRODUCTOS (idprd en tu JSON)
    if (pullData.products?.length > 0) {
      const toUpsert = pullData.products.map((p: any) => ({
        codigo_producto: p.prdcod?.trim() || '',
        nombre_producto: p.prdnom?.trim() || '',
        precio_base_venta: p.prdpoficial || 0,
        stock_actual: p.prdstmax || 0,
        stock_min: p.prdstmin || 0,
        unidad_base_venta: p.prdunid?.trim() || 'UND',
        estado: 'Activo'
      }));
      for (let i = 0; i < toUpsert.length; i += batchSize) {
        await supabase.from('productos').upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'codigo_producto' });
      }
      results.push({ tabla: 'productos', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: 'Productos listos' });
    }

    // 6. CLIENTES (Vincular con UUID de Zonas y Empleados)
    if (pullData.clients?.length > 0) {
      // Obtenemos los mapas de UUIDs para cruzar datos
      const { data: sbZones } = await supabase.from('zones').select('id, legacy_id');
      const { data: sbEmps } = await supabase.from('employees').select('id, legacy_id');

      const toUpsert = pullData.clients.map((c: any) => ({
        legacy_id: c.idcli,
        code: c.clicod?.trim() || '',
        name: c.clinom?.trim() || 'Sin nombre',
        tax_id: c.clinit?.trim() || '',
        address: c.clidir?.trim() || '',
        phones: c.clitel?.trim() || '',
        credit_limit: c.clitlimcre || 0,
        // Buscamos el ID interno de Supabase usando el ID de la oficina
        zone_id: sbZones?.find(z => z.legacy_id == c.idz)?.id || null,
        vendor_id: sbEmps?.find(e => e.legacy_id == c.cliidemp)?.id || null,
        status: 'Vigente'
      }));

      for (let i = 0; i < toUpsert.length; i += batchSize) {
        await supabase.from('clients').upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'legacy_id' });
      }
      results.push({ tabla: 'clients', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: 'Clientes vinculados y listos' });
    }

    // ==================================================================
    // BLOQUE B: ENVIAR TRANSACCIONES A LA OFICINA (PUSH)
    // ==================================================================
    
    // B1. Pedidos pendientes
    const { data: pendingOrders } = await supabase.from('pedidos')
      .select(`*, clients:clients_id ( legacy_id ), detalle_pedido ( producto_id, cantidad, precio_unitario, productos:producto_id ( codigo_producto ) )`)
      .is('legacy_id', null).eq('estado', 'Pendiente').limit(20);
    
    if (pendingOrders && pendingOrders.length > 0) {
      const pushResp = await fetch(`${API_OFICINA}/api/push-orders`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ orders: pendingOrders }) 
      });
      const pushJson = await pushResp.json();
      
      let procesados = 0;
      if (pushJson.results) {
        for (const res of pushJson.results) {
          if (res.success) {
            await supabase.from('pedidos').update({ legacy_id: res.legacy_id }).eq('id', res.id);
            procesados++;
          }
        }
      }
      results.push({ tabla: 'pedidos', direccion: 'Supabase→SQL', procesados, errores: pendingOrders.length - procesados, mensaje: 'Pedidos enviados' });
    }

    return NextResponse.json({ success: true, resumen: results });

  } catch (error: any) {
    console.error('Error en sync/full:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}