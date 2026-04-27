export function StaleVersionBanner() {
  return (
    <div className="border-l-4 border-red-500 bg-red-50 p-4 mb-4">
      <p className="font-semibold">Otro Admin editó este presupuesto.</p>
      <p className="text-sm">Recargá la página para ver los cambios. Hasta entonces, no se puede guardar.</p>
    </div>
  );
}
