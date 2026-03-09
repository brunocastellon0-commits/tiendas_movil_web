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

    // 🛠️ HERRAMIENTA: Aspiradora para traer TODOS los registros sin el límite de 1000
    async function fetchAllRecords(table: string, columns: string) {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await supabase.from(table).select(columns).range(from, from + step - 1);
        if (error || !data || data.length === 0) break;
        allData.push(...data);
        if (data.length < step) break;
        from += step;
      }
      return allData;
    }

    // ========================================================================
    // --- 1. PULL DE DATOS MAESTROS (Oficina -> Supabase) ---
    // ========================================================================
    const pullResponse = await fetch(`${API_OFICINA}/api/pull`, { cache: 'no-store' });
    if (!pullResponse.ok) throw new Error("La Mini-API de la oficina no respondió.");
    const pullData = await pullResponse.json();

    // --- ZONAS ---
    if (pullData.zones?.length > 0) {
      const data = pullData.zones.map((z: any) => ({
        legacy_id: z.idz || z.idzon,
        codigo_zona: String(z.zcod || z.idz || ''),
        name: (z.zonnom || z.znom || 'Ruta').trim()
      }));
      const { error } = await supabase.from('zones').upsert(data, { onConflict: 'legacy_id' });
      results.push({ tabla: 'zones', procesados: data.length, error: error?.message || null });
    }

    // --- EMPLEADOS ---
    if (pullData.employees?.length > 0) {
      const data = pullData.employees.map((e: any) => ({
        legacy_id: e.idemp,
        full_name: (e.empnom || 'Sin Nombre').trim(),
        email: e.empemail?.includes('@') ? e.empemail.trim() : `vendedor_${e.idemp}@tiendasmovil.com`,
        status: 'Habilitado'
      }));
      const { error } = await supabase.from('employees').upsert(data, { onConflict: 'legacy_id' });
      results.push({ tabla: 'employees', procesados: data.length, error: error?.message || null });
    }

    // --- CATEGORÍAS ---
    if (pullData.categories?.length > 0) {
      const data = pullData.categories.map((c: any) => ({
        legacy_id: c.idlinea,
        nombre_categoria: (c.linnom || '').trim()
      }));
      const { error } = await supabase.from('categorias').upsert(data, { onConflict: 'legacy_id' });
      results.push({ tabla: 'categorias', procesados: data.length, error: error?.message || null });
    }

    // --- PROVEEDORES ---
    if (pullData.providers?.length > 0) {
      const data = pullData.providers.map((p: any) => ({
        legacy_id: p.idprv,
        codigo: (p.prvcod || '').trim(),
        nombre: (p.prvnom || '').trim()
      }));
      const { error } = await supabase.from('proveedores').upsert(data, { onConflict: 'legacy_id' });
      results.push({ tabla: 'proveedores', procesados: data.length, error: error?.message || null });
    }

    // --- PRODUCTOS ---
    if (pullData.products?.length > 0) {
      const sbCat = await fetchAllRecords('categorias', 'id, legacy_id');
      const data = pullData.products.map((p: any) => ({
        legacy_id: p.idprd,
        codigo_producto: (p.prdcod || '').trim(),
        nombre_producto: (p.prdnom || '').trim(),
        precio_base_venta: p.prdpoficial || 0,
        unidad_base_venta: (p.prdunid || 'UND').trim(),
        stock_actual: Math.max(0, p.stock_real || 0),
        activo: true,
        categoria_id: sbCat.find((c: any) => c.legacy_id == p.idlinea)?.id || null
      }));

      for (let i = 0; i < data.length; i += batchSize) {
        await supabase.from('productos').upsert(data.slice(i, i + batchSize), { onConflict: 'legacy_id' });
      }
      results.push({ tabla: 'productos', procesados: data.length });
    }

    // --- CLIENTES ---
    if (pullData.clients?.length > 0) {
      const sbZones = await fetchAllRecords('zones', 'id, legacy_id');
      const sbEmps = await fetchAllRecords('employees', 'id, legacy_id');

      const data = pullData.clients.map((c: any) => ({
        legacy_id: c.idcli,
        code: (c.clicod || '').trim(),
        name: (c.clinom || '').trim(),
        address: (c.clidir || '').trim(),
        zone_id: sbZones.find((z: any) => z.legacy_id == c.idz)?.id || null,
        vendor_id: sbEmps.find((e: any) => e.legacy_id == c.cliidemp)?.id || null,
        status: 'Vigente'
      }));

      for (let i = 0; i < data.length; i += batchSize) {
        await supabase.from('clients').upsert(data.slice(i, i + batchSize), { onConflict: 'legacy_id' });
      }
      results.push({ tabla: 'clients', procesados: data.length });
    }

    // ========================================================================
    // --- 2. PUSH PEDIDOS NUEVOS (Supabase → SQL Server) ---
    // ========================================================================
    const { data: pendingOrders } = await supabase
      .from('pedidos')
      .select(`*, clients_id ( legacy_id ), detalle_pedido ( producto_id, cantidad, precio_unitario, productos:producto_id ( codigo_producto ) )`)
      .is('legacy_id', null)
      .eq('estado', 'Pendiente');

    if (pendingOrders && pendingOrders.length > 0) {
      const pushResp = await fetch(`${API_OFICINA}/api/push-orders`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ orders: pendingOrders }),
        cache: 'no-store'
      });
      const pushJson = await pushResp.json();
      if (pushJson.results) {
        for (const res of pushJson.results) {
          if (res.success) await supabase.from('pedidos').update({ legacy_id: res.legacy_id }).eq('id', res.id);
        }
      }
      results.push({ tabla: 'pedidos_nuevos', procesados: pendingOrders.length });
    }

    // ========================================================================
    // --- 3. PULL HISTORIAL DE PEDIDOS (SQL Server → Supabase) ---
    // ========================================================================
    try {
      const pullOrdersResp = await fetch(`${API_OFICINA}/api/pull-orders`, { cache: 'no-store' });
      
      if (pullOrdersResp.ok) {
        const ordersData = await pullOrdersResp.json();
        
        if (ordersData.success && ordersData.pedidos?.length > 0) {
          const sbClients = await fetchAllRecords('clients', 'id, legacy_id');
          const sbProducts = await fetchAllRecords('productos', 'id, codigo_producto');
          const sbEmps = await fetchAllRecords('employees', 'id, legacy_id');

          let pedidosActualizados = 0;
          let pedidosErrores = 0;

          for (const pedido of ordersData.pedidos) {
            // 1. Mapeo Seguro
            const clienteSupabase = sbClients.find((c: any) => String(c.legacy_id).trim() === String(pedido.legacy_cliente_id).trim());
            const empleadoSupabase = sbEmps.find((e: any) => String(e.legacy_id).trim() === String(pedido.legacy_empleado_id).trim());

            // 2. Cálculo de Total con 2 decimales
            let totalCalculado = 0;
            if (pedido.detalle_pedido?.length > 0) {
              totalCalculado = pedido.detalle_pedido.reduce((suma: number, det: any) => {
                const cant = Number(det.cantidad) || 0;
                const prec = Number(det.precio_unitario) || 0;
                return suma + (cant * prec);
              }, 0);
            }
            totalCalculado = parseFloat(totalCalculado.toFixed(2));

            // 🟢 3. LIMPIEZA DE FECHA: Evita que se cambie de día por culpa de la Zona Horaria
            const fechaLimpia = pedido.fecha_venta 
              ? pedido.fecha_venta.split('T')[0] 
              : new Date().toISOString().split('T')[0];

            // 4. Inserción de Cabecera
            const { data: cabeceraGuardada, error: cabeceraError } = await supabase
              .from('pedidos')
              .upsert({
                legacy_id: pedido.legacy_id_venta,
                numero_documento: pedido.numero_documento || `V-OLD-${pedido.legacy_id_venta}`,
                tipo_documento: pedido.tipo_documento || 'Nota', // 🟢 TIPO DE DOCUMENTO AGREGADO
                fecha_pedido: fechaLimpia, // 🟢 FECHA CORRECTA
                clients_id: clienteSupabase ? clienteSupabase.id : null,
                empleado_id: empleadoSupabase ? empleadoSupabase.id : null, 
                total_venta: totalCalculado, 
                estado: 'Completado' 
              }, { onConflict: 'legacy_id' })
              .select('id')
              .single();

            if (cabeceraError) {
              pedidosErrores++;
              continue; 
            }

            // 5. Inserción de Detalles
            if (cabeceraGuardada && pedido.detalle_pedido?.length > 0) {
              const detallesParaGuardar = pedido.detalle_pedido.map((det: any) => {
                const productoSupabase = sbProducts.find((p: any) => String(p.codigo_producto).trim() === String(det.codigo_producto).trim());
                
                const cant = Number(det.cantidad) || 0;
                const prec = Number(det.precio_unitario) || 0;
                const subtotal_calc = parseFloat((cant * prec).toFixed(2));

                return {
                  pedido_id: cabeceraGuardada.id,
                  producto_id: productoSupabase ? productoSupabase.id : null,
                  cantidad: cant,
                  precio_unitario: prec,
                  subtotal: subtotal_calc,
                  // 🟢 Guardamos la unidad de medida del ERP para que no quede vacía
                  unidad_seleccionada: (det.unidad || det.unidadmedida || det.unidad_seleccionada || 'UND').toString().trim(),
                };
              }).filter((det: any) => det.producto_id !== null); 

              if (detallesParaGuardar.length > 0) {
                await supabase.from('detalle_pedido').delete().eq('pedido_id', cabeceraGuardada.id);
                await supabase.from('detalle_pedido').insert(detallesParaGuardar);
              }
            }
            pedidosActualizados++;
          }
          
          results.push({ tabla: 'historial_ventas', procesados: pedidosActualizados, errores: pedidosErrores });
        }
      }
    } catch (err: any) {
      results.push({ tabla: 'historial_ventas', error: err.message });
    }

    return NextResponse.json({ success: true, resultados: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}