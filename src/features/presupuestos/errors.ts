export class StaleVersionError extends Error {
  readonly code = 'STALE_VERSION' as const;
  constructor(public readonly currentVersion: number) {
    super('El presupuesto fue editado por otro usuario. Recargá para ver los cambios.');
  }
}

export class ImmutableError extends Error {
  readonly code = 'IMMUTABLE' as const;
  constructor() {
    super('Este presupuesto está firmado y no puede modificarse.');
  }
}

export class ItemValidationError extends Error {
  readonly code = 'ITEM_VALIDATION' as const;
  constructor(public readonly issues: { item: number; field: string; message: string }[]) {
    super('Hay errores en los items.');
  }
}
