import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pending-orders
 *
 * Ya NO se conecta directamente a SQL Server.
 * Solo lee pedidos pendientes de Supabase y los reenvía a la Mini-API
 * de la oficina (via Cloudflare Tunnel) para que ella los escriba en SQL Server.
 *
 * En condiciones normales esto NO es necesario porque el WebSocket del
 * server de la oficina detecta INSERT en Supabase automáticamente.
 * Este endpoint sirve como "botón de reintento manual" para pedidos
 * que por algún motivo quedaron atascados (legacy_id = null).
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const API_OFICINA = process.env.NEXT_PUBLIC_API_OFICINA || 'https://db-sql.tiendasmovil.com';

    // 1. Buscar pedidos atascados (Pendiente + sin legacy_id)
    const { data: pendingOrders, error } = await supabase
      .from('pedidos')
      .select('*')
      .is('legacy_id', null)
      .eq('estado', 'Pendiente')
      .limit(10);

    if (error) throw new Error(error.message);

    if (!pendingOrders || pendingOrders.length === 0) {
      return NextResponse.json({ message: 'No hay pedidos pendientes de sincronizar.' });
    }

    // 1b. Obtener legacy_id de los clientes relacionados
    const orderClientIds = [...new Set(pendingOrders.map((o: any) => o.clients_id).filter(Boolean))]
    let clientLegacyMap: Record<string, number | null> = {}
    if (orderClientIds.length > 0) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, legacy_id')
        .in('id', orderClientIds)
      if (clients) clients.forEach((c: any) => { clientLegacyMap[c.id] = c.legacy_id })
    }

    // 1c. Obtener detalle_pedido para cada pedido
    const orderIds = pendingOrders.map((o: any) => o.id)
    const { data: detalles } = await supabase
      .from('detalle_pedido')
      .select('pedido_id, producto_id, cantidad, precio_unitario, unidad_seleccionada, factor_aplicado')
      .in('pedido_id', orderIds)
      .order('created_at')

    const detailByOrder: Record<string, any[]> = {}
    if (detalles) {
      detalles.forEach((d: any) => {
        if (!detailByOrder[d.pedido_id]) detailByOrder[d.pedido_id] = []
        detailByOrder[d.pedido_id].push(d)
      })
    }

    // 2. Enriquecer detalles con datos de productos (sin depender de FK)
    const allProductoIds = [...new Set(
      (detalles || []).map((d: any) => d.producto_id).filter(Boolean)
    )];

    let productoMap: Record<string, { codigo_producto: string; legacy_id: number | null }> = {};
    if (allProductoIds.length > 0) {
      const { data: prods } = await supabase
        .from('productos')
        .select('id, codigo_producto, legacy_id')
        .in('id', allProductoIds);
      if (prods) {
        prods.forEach((p: any) => { productoMap[p.id] = { codigo_producto: p.codigo_producto, legacy_id: p.legacy_id } });
      }
    }

    // 3. Combinar todo manualmente
    const enrichedOrders = pendingOrders.map((order: any) => ({
      ...order,
      clients_id: order.clients_id ? { legacy_id: clientLegacyMap[order.clients_id] || null } : null,
      detalle_pedido: (detailByOrder[order.id] || []).map((d: any) => ({
        ...d,
        productos: productoMap[d.producto_id] || null,
      })),
    }));


    // 4. Enviar a la Mini-API de la oficina para que los grabe en SQL Server
    const pushResp = await fetch(`${API_OFICINA}/api/push-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: enrichedOrders }),
      cache: 'no-store'
    });

    if (!pushResp.ok) {
      const errText = await pushResp.text();
      throw new Error(`Mini-API de la oficina respondió con error: ${errText}`);
    }

    const pushJson = await pushResp.json();

    // 3. Marcar en Supabase los que fueron exitosos
    let syncedCount = 0;
    if (pushJson.results && Array.isArray(pushJson.results)) {
      for (const res of pushJson.results) {
        if (res.success && res.legacy_id) {
          await supabase
            .from('pedidos')
            .update({ legacy_id: res.legacy_id })
            .eq('id', res.id);
          syncedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reintentados ${pendingOrders.length} pedidos. ${syncedCount} sincronizados exitosamente con SQL Server.`,
      results: pushJson.results || []
    });

  } catch (error: any) {
    console.error('[pending-orders] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}