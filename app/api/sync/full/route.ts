import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const API_OFICINA = process.env.NEXT_PUBLIC_API_OFICINA || 'https://db-sql.tiendasmovil.com';
    const batchSize = 100; // Para no saturar la conexión con los 8000 clientes

    // ==================================================================
    // BLOQUE A: SOLICITAR DATOS A LA OFICINA (PULL)
    // ==================================================================
    const pullResponse = await fetch(`${API_OFICINA}/api/pull`);
    if (!pullResponse.ok) throw new Error(`La oficina no responde: ${pullResponse.status}`);
    const pullData = await pullResponse.json();

    // 1. ZONAS / RUTAS
    if (pullData.zones?.length > 0) {
      const toUpsert = pullData.zones.map((z: any) => ({
        legacy_id: z.idzon || z.idz,
        name: z.zonnom || z.zonom || 'Ruta'
      }));
      await supabase.from('zones').upsert(toUpsert, { onConflict: 'legacy_id' });
      results.push({ tabla: 'zones', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: 'Zonas listas' });
    }

    // 2. EMPLEADOS
    if (pullData.employees?.length > 0) {
      const toUpsert = pullData.employees.map((e: any) => ({
        legacy_id: e.idemp,
        full_name: e.empnom?.trim() || 'Sin Nombre',
        email: e.empemail?.includes('@') ? e.empemail.trim() : `vendedor_${e.idemp}@tiendasmovil.com`,
        status: 'Activo'
      }));
      await supabase.from('employees').upsert(toUpsert, { onConflict: 'legacy_id' });
      results.push({ tabla: 'employees', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: 'Empleados listos' });
    }

    // 3. CATEGORÍAS
    if (pullData.categories?.length > 0) {
      const toUpsert = pullData.categories.map((c: any) => ({
        legacy_id: c.idlinea,
        nombre_categoria: c.linnom?.trim() || '',
        codigo_categoria: c.lincod?.trim() || ''
      }));
      for (let i = 0; i < toUpsert.length; i += batchSize) {
        await supabase.from('categorias').upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'legacy_id' });
      }
      results.push({ tabla: 'categorias', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: 'Categorías listas' });
    }

    // 4. PROVEEDORES
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
        await supabase.from('proveedores').upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'legacy_id' });
      }
      results.push({ tabla: 'proveedores', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: 'Proveedores listos' });
    }

    // 5. PRODUCTOS
    if (pullData.products?.length > 0) {
      const toUpsert = pullData.products.map((p: any) => ({
        codigo_producto: p.prdcod?.trim() || '',
        nombre_producto: p.prdnom?.trim() || '',
        precio_base_venta: p.prdpoficial || 0,
        stock_actual: p.prdstmax || 0,
        estado: 'Activo'
      }));
      for (let i = 0; i < toUpsert.length; i += batchSize) {
        await supabase.from('productos').upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'codigo_producto' });
      }
      results.push({ tabla: 'productos', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: 'Productos listos' });
    }

    // 6. CLIENTES (Vincular con UUIDs)
    if (pullData.clients?.length > 0) {
      const { data: sbZones } = await supabase.from('zones').select('id, legacy_id');
      const { data: sbEmps } = await supabase.from('employees').select('id, legacy_id');
      
      const toUpsert = pullData.clients.map((c: any) => ({
        legacy_id: c.idcli,
        code: c.clicod?.trim(),
        name: c.clinom?.trim(),
        address: c.clidir?.trim(),
        zone_id: sbZones?.find(z => z.legacy_id == c.idz)?.id || null,
        vendor_id: sbEmps?.find(e => e.legacy_id == c.cliidemp)?.id || null,
        status: 'Vigente'
      }));

      for (let i = 0; i < toUpsert.length; i += batchSize) {
        await supabase.from('clients').upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'legacy_id' });
      }
      results.push({ tabla: 'clients', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: 'Clientes listos' });
    }

    // ==================================================================
    // BLOQUE B: ENVIAR TRANSACCIONES A LA OFICINA (PUSH)
    // ==================================================================
    
    // B1. Pedidos
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
      results.push({ tabla: 'pedidos', direccion: 'Supabase→SQL', procesados, errores: pendingOrders.length - procesados, mensaje: 'Pedidos procesados' });
    }

    return NextResponse.json({ success: true, resultados: results });

  } catch (error: any) {
    console.error('Error FATAL en sync/full:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}