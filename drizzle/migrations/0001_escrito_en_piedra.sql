-- Defensa en profundidad: rechaza UPDATE/DELETE en items de presupuestos firmados.
-- La UI y la Server Action ya validan, este es la última línea de defensa.

CREATE OR REPLACE FUNCTION rechazar_edicion_firmado()
RETURNS TRIGGER AS $$
DECLARE
  estado_pres text;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    SELECT estado INTO estado_pres FROM presupuesto WHERE id = OLD.presupuesto_id;
  ELSIF (TG_OP = 'DELETE') THEN
    SELECT estado INTO estado_pres FROM presupuesto WHERE id = OLD.presupuesto_id;
  END IF;

  IF estado_pres = 'firmado' THEN
    RAISE EXCEPTION 'No se puede modificar items de un presupuesto firmado (presupuesto_id=%)', OLD.presupuesto_id
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS escrito_en_piedra_item ON item_presupuesto;
CREATE TRIGGER escrito_en_piedra_item
  BEFORE UPDATE OR DELETE ON item_presupuesto
  FOR EACH ROW EXECUTE FUNCTION rechazar_edicion_firmado();

-- También bloquear UPDATE sobre el presupuesto firmado mismo (excepto cambio de estado a 'cancelado').
CREATE OR REPLACE FUNCTION rechazar_edicion_presupuesto_firmado()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado = 'firmado' AND NEW.estado = 'firmado' THEN
    RAISE EXCEPTION 'No se puede editar un presupuesto firmado (id=%); cancelarlo y reemitir.', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS escrito_en_piedra_presupuesto ON presupuesto;
CREATE TRIGGER escrito_en_piedra_presupuesto
  BEFORE UPDATE ON presupuesto
  FOR EACH ROW EXECUTE FUNCTION rechazar_edicion_presupuesto_firmado();
