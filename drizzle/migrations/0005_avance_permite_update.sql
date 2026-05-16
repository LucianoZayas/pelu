-- Permite UPDATE de porcentaje_avance en items de presupuestos firmados.
-- El trigger escrito_en_piedra_item bloqueaba TODO UPDATE post-firma, pero el
-- avance de obra justamente necesita modificar esa columna después de firmar.
-- Estrategia: comparar NEW vs OLD ignorando porcentaje_avance — si lo único que
-- cambió es esa columna, dejar pasar.

CREATE OR REPLACE FUNCTION rechazar_edicion_firmado()
RETURNS TRIGGER AS $$
DECLARE
  estado_pres text;
  campos_excluidos text[] := ARRAY['porcentaje_avance'];
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    SELECT estado INTO estado_pres FROM presupuesto WHERE id = OLD.presupuesto_id;

    IF estado_pres = 'firmado' THEN
      -- Si lo único que cambió es porcentaje_avance, permitirlo.
      IF (to_jsonb(NEW) - campos_excluidos) = (to_jsonb(OLD) - campos_excluidos) THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'No se puede modificar items de un presupuesto firmado (presupuesto_id=%)', OLD.presupuesto_id
        USING ERRCODE = '23514';
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    SELECT estado INTO estado_pres FROM presupuesto WHERE id = OLD.presupuesto_id;
    IF estado_pres = 'firmado' THEN
      RAISE EXCEPTION 'No se puede modificar items de un presupuesto firmado (presupuesto_id=%)', OLD.presupuesto_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;
