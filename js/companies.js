// Spanish company name generator and random-data utilities.

const PREFIXES = [
  'Grupo', 'Corporación', 'Industrias', 'Comercial', 'Distribuidora',
  'Importadora', 'Exportadora', 'Constructora', 'Consultora', 'Servicios',
  'Inversiones', 'Transportes', 'Manufacturas', 'Tecnologías', 'Soluciones',
  'Agropecuaria', 'Inmobiliaria', 'Financiera', 'Logística', 'Compañía',
];

const CORES = [
  'Andina', 'Atlántica', 'Pacífica', 'Tropical', 'Central',
  'Ibérica', 'Continental', 'Nacional', 'Universal', 'Global',
  'Meridional', 'Austral', 'Caribeña', 'del Norte', 'del Sur',
  'del Este', 'del Oeste', 'Unida', 'Moderna', 'Nueva',
  'Real', 'Imperial', 'Premium', 'Estrella', 'Horizonte',
  'Futuro', 'Progreso', 'Vanguardia', 'Siglo XXI', 'Milenio',
];

const FAMILY = [
  'García', 'Rodríguez', 'Martínez', 'Hernández', 'López',
  'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres',
  'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes',
  'Morales', 'Cruz', 'Ortiz', 'Jiménez', 'Vargas',
];

const SECTORS = [
  'Tecnología', 'Alimentos', 'Construcción', 'Textiles', 'Farmacéutica',
  'Automotriz', 'Energía', 'Telecomunicaciones', 'Editorial', 'Minería',
  'Agroindustria', 'Cosmética', 'Muebles', 'Plásticos', 'Metalurgia',
];

const SUFFIXES = ['S.A.', 'S.A. de C.V.', 'S.R.L.', 'Ltda.', 'S.L.', 'y Cía.', ''];

const ESTADOS = ['Pendiente', 'Asignado', 'Listo'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomCompanyName() {
  // Mix several patterns so names feel varied
  const pattern = Math.floor(Math.random() * 5);
  let name;
  switch (pattern) {
    case 0: // Grupo Andina S.A.
      name = `${pick(PREFIXES)} ${pick(CORES)}`;
      break;
    case 1: // Industrias García
      name = `${pick(PREFIXES)} ${pick(FAMILY)}`;
      break;
    case 2: // Tecnologías del Norte
      name = `${pick(PREFIXES)} ${pick(CORES)}`;
      break;
    case 3: // García y López Asociados
      name = `${pick(FAMILY)} y ${pick(FAMILY)}`;
      break;
    case 4: // Constructora Reyes
      name = `${pick(['Constructora', 'Consultora', 'Distribuidora', 'Transportes'])} ${pick(FAMILY)}`;
      break;
    default:
      name = `${pick(PREFIXES)} ${pick(SECTORS)}`;
  }
  const suf = pick(SUFFIXES);
  return suf ? `${name} ${suf}` : name;
}

function randomId(usedIds) {
  // 6-digit ids, unique per generation
  for (;;) {
    const id = 100000 + Math.floor(Math.random() * 900000);
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
  }
}

export const Companies = {
  ESTADOS,
  DEFAULT_ESTADO: 'Pendiente',

  /**
   * Generate `count` pseudo-random companies as 4-column rows:
   * [Id, Nombre, Estado, Ejecutivo]. Estado defaults to 'Pendiente'
   * and Ejecutivo starts empty — they are populated by the later buttons.
   */
  generate(count) {
    const usedIds = new Set();
    const rows = new Array(count);
    for (let i = 0; i < count; i++) {
      rows[i] = [randomId(usedIds), randomCompanyName(), 'Pendiente', ''];
    }
    return rows;
  },

  /**
   * Pick `k` distinct items from an existing array using a partial
   * Fisher–Yates shuffle. Non-destructive (copies input first).
   */
  sampleFromArray(source, k) {
    const a = source.slice();
    const take = Math.min(k, a.length);
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(Math.random() * (a.length - i));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, take);
  },

  /** Fisher–Yates shuffle (in place). */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  /**
   * Split `n` items into `k` chunks as evenly as possible.
   * Returns an array of `k` arrays containing the source indices.
   * Example: split(1000, 8) → eight arrays of 125 each.
   */
  balancedSplit(indices, k) {
    const chunks = Array.from({ length: k }, () => []);
    for (let i = 0; i < indices.length; i++) {
      chunks[i % k].push(indices[i]);
    }
    return chunks;
  },
};
