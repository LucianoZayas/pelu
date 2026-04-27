import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { ensureFontsRegistered } from './fonts';
import { LOGO_PNG_BASE64 } from './assets';

const styles = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 10, padding: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '1 solid #ccc',
  },
  title: { fontSize: 18, fontWeight: 700 },
  subtitle: { fontSize: 9, color: '#666' },
  logo: { width: 60, height: 60 },
  rubroHeader: {
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#f4f4f5',
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #eee',
    paddingVertical: 3,
  },
  cellDesc: { flex: 4 },
  cellNum: { flex: 1, textAlign: 'right' },
  total: {
    marginTop: 16,
    paddingTop: 8,
    borderTop: '2 solid #000',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    fontSize: 14,
    fontWeight: 700,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
});

export interface PdfData {
  obra: {
    codigo: string;
    nombre: string;
    clienteNombre: string;
    monedaBase: string;
    ubicacion: string | null;
  };
  presupuesto: {
    numero: number;
    tipo: string;
    descripcion: string | null;
    fechaFirma: Date | null;
    totalClienteCalculado: string;
  };
  grupos: {
    nombre: string;
    items: {
      descripcion: string;
      cantidad: string;
      unidad: string;
      precioUnitario: string;
      subtotal: string;
    }[];
    subtotal: string;
  }[];
}

export function PresupuestoPdfV1({ data }: { data: PdfData }) {
  ensureFontsRegistered();
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>
              Macna · Presupuesto #{data.presupuesto.numero} ({data.presupuesto.tipo})
            </Text>
            <Text style={styles.subtitle}>
              {data.obra.codigo} · {data.obra.nombre} · Cliente: {data.obra.clienteNombre}
            </Text>
            {data.obra.ubicacion && (
              <Text style={styles.subtitle}>{data.obra.ubicacion}</Text>
            )}
            {data.presupuesto.fechaFirma && (
              <Text style={styles.subtitle}>
                Firmado el {data.presupuesto.fechaFirma.toLocaleDateString('es-AR')}
              </Text>
            )}
          </View>
          <Image src={`data:image/png;base64,${LOGO_PNG_BASE64}`} style={styles.logo} />
        </View>

        {data.presupuesto.descripcion && (
          <Text style={{ marginBottom: 12 }}>{data.presupuesto.descripcion}</Text>
        )}

        <View style={styles.row}>
          <Text style={[styles.cellDesc, { fontWeight: 700 }]}>Descripción</Text>
          <Text style={[styles.cellNum, { fontWeight: 700 }]}>Cant.</Text>
          <Text style={[styles.cellNum, { fontWeight: 700 }]}>Un.</Text>
          <Text style={[styles.cellNum, { fontWeight: 700 }]}>P. Unit.</Text>
          <Text style={[styles.cellNum, { fontWeight: 700 }]}>Subtotal</Text>
        </View>

        {data.grupos.map((g) => (
          <View key={g.nombre} wrap={false}>
            <Text style={styles.rubroHeader}>{g.nombre}</Text>
            {g.items.map((it, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.cellDesc}>{it.descripcion}</Text>
                <Text style={styles.cellNum}>{it.cantidad}</Text>
                <Text style={styles.cellNum}>{it.unidad}</Text>
                <Text style={styles.cellNum}>{it.precioUnitario}</Text>
                <Text style={styles.cellNum}>{it.subtotal}</Text>
              </View>
            ))}
            <View style={[styles.row, { fontWeight: 700 }]}>
              <Text style={styles.cellDesc}>Subtotal {g.nombre}</Text>
              <Text style={styles.cellNum}></Text>
              <Text style={styles.cellNum}></Text>
              <Text style={styles.cellNum}></Text>
              <Text style={styles.cellNum}>{g.subtotal}</Text>
            </View>
          </View>
        ))}

        <View style={styles.total}>
          <Text>
            Total: {data.presupuesto.totalClienteCalculado} {data.obra.monedaBase}
          </Text>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages} · Macna Construcciones`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
