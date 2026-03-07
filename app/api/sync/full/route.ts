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

    // --- 1. ZONAS ---
    if (pullData.zones?.length > 0) {
      const data = pullData.zones.map((z: any) => ({
        legacy_id: z.idz || z.idzon,
        codigo_zona: String(z.zcod || z.idz || ''),
        name: (z.zonnom || z.znom || 'Ruta').trim()
      }));
      const { error } = await supabase.from('zones').upsert(data, { onConflict: 'legacy_id' });
      if (error) console.error('zones error:', error.message);
      results.push({ tabla: 'zones', procesados: data.length, error: error?.message || null });
    }

    // --- 2. EMPLEADOS ---
    if (pullData.employees?.length > 0) {
      const data = pullData.employees.map((e: any) => ({
        legacy_id: e.idemp,
        full_name: (e.empnom || 'Sin Nombre').trim(),
        email: e.empemail?.includes('@') ? e.empemail.trim() : `vendedor_${e.idemp}@tiendasmovil.com`,
        status: 'Habilitado'
      }));
      const { error } = await supabase.from('employees').upsert(data, { onConflict: 'legacy_id' });
      if (error) console.error('employees error:', error.message);
      results.push({ tabla: 'employees', procesados: data.length, error: error?.message || null });
    }

    // --- 3. CATEGORÍAS ---
    if (pullData.categories?.length > 0) {
      const data = pullData.categories.map((c: any) => ({
        legacy_id: c.idlinea,
        nombre_categoria: (c.linnom || '').trim()
      }));
      const { error } = await supabase.from('categorias').upsert(data, { onConflict: 'legacy_id' });
      if (error) console.error('categorias error:', error.message);
      results.push({ tabla: 'categorias', procesados: data.length, error: error?.message || null });
    }

    // --- 4. PROVEEDORES ---
    if (pullData.providers?.length > 0) {
      const data = pullData.providers.map((p: any) => ({
        legacy_id: p.idprv,
        codigo: (p.prvcod || '').trim(),
        nombre: (p.prvnom || '').trim()
      }));
      const { error } = await supabase.from('proveedores').upsert(data, { onConflict: 'legacy_id' });
      if (error) console.error('proveedores error:', error.message);
      results.push({ tabla: 'proveedores', procesados: data.length, error: error?.message || null });
    }

    // --- 5. PRODUCTOS con stock_real desde tbcd ---
    if (pullData.products?.length > 0) {
      const { data: sbCat } = await supabase.from('categorias').select('id, legacy_id');
      const { data: sbProv } = await supabase.from('proveedores').select('id, legacy_id');

      const data = pullData.products.map((p: any) => ({
        legacy_id: p.idprd,
        codigo_producto: (p.prdcod || '').trim(),
        nombre_producto: (p.prdnom || '').trim(),
        precio_base_venta: p.prdpoficial || 0,
        unidad_base_venta: (p.prdunid || 'UND').trim(),
        // ✅ stock_real viene calculado desde tbcd en el index.js
        stock_actual: Math.max(0, p.stock_real || 0),
        activo: true,
        categoria_id: sbCat?.find(c => c.legacy_id == p.idlinea)?.id || null,
        proveedor_id: null // idprv no existe en tbprd, pendiente confirmar nombre real
      }));

      let productErrors: string[] = [];
      for (let i = 0; i < data.length; i += batchSize) {
        const { error } = await supabase.from('productos')
          .upsert(data.slice(i, i + batchSize), { onConflict: 'legacy_id' });
        if (error) productErrors.push(`batch ${i}: ${error.message}`);
      }
      results.push({ tabla: 'productos', procesados: data.length, error: productErrors[0] || null });
    }

    // --- 6. CLIENTES ---
    if (pullData.clients?.length > 0) {
      const { data: sbZones } = await supabase.from('zones').select('id, legacy_id');
      const { data: sbEmps } = await supabase.from('employees').select('id, legacy_id');

      const data = pullData.clients.map((c: any) => ({
        legacy_id: c.idcli,
        code: (c.clicod || '').trim(),
        name: (c.clinom || '').trim(),
        address: (c.clidir || '').trim(),
        zone_id: sbZones?.find(z => z.legacy_id == c.idz)?.id || null,
        vendor_id: sbEmps?.find(e => e.legacy_id == c.cliidemp)?.id || null,
        status: 'Vigente'
      }));

      let clientErrors: string[] = [];
      for (let i = 0; i < data.length; i += batchSize) {
        const { error } = await supabase.from('clients')
          .upsert(data.slice(i, i + batchSize), { onConflict: 'legacy_id' });
        if (error) clientErrors.push(`batch ${i}: ${error.message}`);
      }
      results.push({ tabla: 'clients', procesados: data.length, error: clientErrors[0] || null });
    }

    // --- 7. PUSH PEDIDOS (Supabase → SQL Server) ---
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('pedidos')
      .select(`
        *,
        clients_id ( legacy_id ),
        detalle_pedido (
          producto_id,
          cantidad,
          precio_unitario,
          productos:producto_id ( codigo_producto )
        )
      `)
      .is('legacy_id', null)
      .eq('estado', 'Pendiente');

    if (ordersError) console.error('pedidos fetch error:', ordersError.message);

    if (pendingOrders && pendingOrders.length > 0) {
      const pushResp = await fetch(`${API_OFICINA}/api/push-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: pendingOrders })
      });
      const pushJson = await pushResp.json();
      if (pushJson.results) {
        for (const res of pushJson.results) {
          if (res.success) {
            await supabase.from('pedidos').update({ legacy_id: res.legacy_id }).eq('id', res.id);
          }
        }
      }
      results.push({ tabla: 'pedidos', procesados: pendingOrders.length, error: null });
    } else {
      results.push({ tabla: 'pedidos', procesados: 0, error: null });
    }

    return NextResponse.json({ success: true, resultados: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}