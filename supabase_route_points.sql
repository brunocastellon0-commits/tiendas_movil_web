-- ============================================================
-- TABLA: route_points
-- Puntos de ruta pre-definidos (como el mapa en papel)
-- Pueden estar sin cliente asignado (libre) o asignados a un cliente
-- ============================================================

CREATE TABLE IF NOT EXISTS route_points (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Coordenadas geográficas (requeridas)
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  
  -- Etiqueta visual y color del punto
  label       TEXT NOT NULL DEFAULT 'Punto de Ruta',
  color       TEXT NOT NULL DEFAULT '#6366f1',
  
  -- Relaciones opcionales
  client_id   UUID REFERENCES clients(id) ON DELETE SET NULL,      -- Puede ser NULL (punto libre)
  vendor_id   UUID REFERENCES employees(id) ON DELETE SET NULL,     -- Preventista asignado
  zona_id     UUID REFERENCES zonas(id) ON DELETE SET NULL,         -- Zona asignada

  -- Control
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_route_points_vendor   ON route_points(vendor_id);
CREATE INDEX IF NOT EXISTS idx_route_points_client   ON route_points(client_id);
CREATE INDEX IF NOT EXISTS idx_route_points_zona     ON route_points(zona_id);
CREATE INDEX IF NOT EXISTS idx_route_points_location ON route_points(latitude, longitude);

-- RLS (Row Level Security) - todos los autenticados pueden leer y gestionar
ALTER TABLE route_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read route_points"
  ON route_points FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert route_points"
  ON route_points FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update route_points"
  ON route_points FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete route_points"
  ON route_points FOR DELETE TO authenticated USING (true);

-- NOTE: pedidos ya tiene la columna 'ubicacion_venta' de tipo geography
-- NO es necesario agregar nada a pedidos.

COMMENT ON TABLE route_points IS 'Puntos de ruta planificados. Pueden estar libres (sin cliente) o asignados a un cliente.';
COMMENT ON COLUMN route_points.client_id IS 'NULL = punto libre, pendiente de asignación de cliente';
COMMENT ON COLUMN route_points.vendor_id IS 'Preventista responsable de este punto';
