import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: any[] = [];
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const API_OFICINA = process.env.NEXT_PUBLIC_API_OFICINA || 'https://db-sql.tiendasmovil.com';
    const batchSize = 100;

    const pullResponse = await fetch(`${API_OFICINA}/api/pull`);
    if (!pullResponse.ok) throw new Error("La Mini-API de la oficina no respondió.");
    const pullData = await pullResponse.json();

    // --- ZONAS ---
    if (pullData.zones?.length > 0) {
      const data = pullData.zones.map((z: any) => ({
        legacy_id: z.idz || z.idzon,
        name: z.zonnom || z.zonom || 'Ruta'
      }));
      const { error } = await supabase.from('zones').upsert(data, { onConflict: 'legacy_id' });
      if (error) console.error('zones error:', error.message);
      results.push({ tabla: 'zones', procesados: data.length, error: error?.message });
    }

    // --- EMPLEADOS ---
    if (pullData.employees?.length > 0) {
      const data = pullData.employees.map((e: any) => ({
        legacy_id: e.idemp,
        full_name: (e.empnom || 'Sin Nombre').trim(),
        email: e.empemail?.includes('@') ? e.empemail.trim() : `vendedor_${e.idemp}@tiendasmovil.com`,
        status: 'Activo'
      }));
      const { error } = await supabase.from('employees').upsert(data, { onConflict: 'legacy_id' });
      if (error) console.error('employees error:', error.message);
      results.push({ tabla: 'employees', procesados: data.length, error: error?.message });
    }

    // --- CATEGORÍAS ---
    if (pullData.categories?.length > 0) {
      const data = pullData.categories.map((c: any) => ({
        legacy_id: c.idlinea,
        nombre_categoria: (c.linnom || '').trim()
      }));
      const { error } = await supabase.from('categorias').upsert(data, { onConflict: 'legacy_id' });
      if (error) console.error('categorias error:', error.message);
      results.push({ tabla: 'categorias', procesados: data.length, error: error?.message });
    }

    // --- PRODUCTOS ---
    if (pullData.products?.length > 0) {
      const data = pullData.products.map((p: any) => ({
        legacy_id: p.idprd,
        codigo_producto: p.prdcod?.trim(),
        nombre_producto: p.prdnom?.trim(),
        precio_base_venta: p.prdpoficial || 0,
        stock_actual: p.prdstmax || 0,
        activo: true
      }));
      for (let i = 0; i < data.length; i += batchSize) {
        const { error } = await supabase.from('productos')
          .upsert(data.slice(i, i + batchSize), { onConflict: 'legacy_id' });
        if (error) console.error(`productos batch ${i} error:`, error.message);
      }
      results.push({ tabla: 'productos', procesados: data.length });
    }

    // --- CLIENTES ---
    if (pullData.clients?.length > 0) {
      const { data: sbZones } = await supabase.from('zones').select('id, legacy_id');
      const { data: sbEmps } = await supabase.from('employees').select('id, legacy_id');

      const data = pullData.clients.map((c: any) => ({
        legacy_id: c.idcli,
        code: c.clicod?.trim(),
        name: c.clinom?.trim(),
        address: c.clidir?.trim(),
        zone_id: sbZones?.find(z => z.legacy_id == c.idz)?.id || null,
        vendor_id: sbEmps?.find(e => e.legacy_id == c.cliidemp)?.id || null,
        status: 'Vigente'
      }));

      for (let i = 0; i < data.length; i += batchSize) {
        const { error } = await supabase.from('clients')
          .upsert(data.slice(i, i + batchSize), { onConflict: 'legacy_id' });
        if (error) console.error(`clients batch ${i} error:`, error.message);
      }
      results.push({ tabla: 'clients', procesados: data.length });
    }

    // --- PUSH PEDIDOS ---
 const { data: pendingOrders } = await supabase.from('pedidos')
  .select(`*, clients_id ( legacy_id ), detalle_pedido ( producto_id, cantidad, precio_unitario, productos:producto_id ( codigo_producto ) )`)
  .is('legacy_id', null).eq('estado', 'Pendiente');

    if (pendingOrders && pendingOrders.length > 0) {
      const pushResp = await fetch(`${API_OFICINA}/api/push-orders`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ orders: pendingOrders }) 
      });
      const pushJson = await pushResp.json();
      if (pushJson.results) {
        for (const res of pushJson.results) {
          if (res.success) await supabase.from('pedidos').update({ legacy_id: res.legacy_id }).eq('id', res.id);
        }
      }
      results.push({ tabla: 'pedidos', procesados: pendingOrders.length, direccion: 'Supabase→SQL' });
    }

    return NextResponse.json({ success: true, resultados: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}