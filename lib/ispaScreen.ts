// lib/ispaScreen.ts
// ISPA (Infeksi Saluran Pernapasan Akut) cross-cutting screening.
// Added to ALL lifecycle triage flows — relevant for volcano eruption zones,
// forest fire smoke, and general respiratory health at Posyandu.
// Deterministic, zero AI, fully offline.

export interface IspaInput {
  batuk: 'kering' | 'berdahak' | 'tidak';
  sesakNapas: boolean;
  mataPerih: boolean;
  paparanAsap: boolean;  // tinggal/bekerja dekat gunung berapi aktif, kebakaran hutan, asap tebal
  durasiHari: number | null;  // berapa hari gejala berlangsung (null = tidak ditanya / tidak relevan)
}

export interface IspaResult {
  hasSymptoms: boolean;
  ispaRisk: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  referNow: boolean;
  counselling: string[];
  reportSection: string;
  payload: Record<string, any>;
}

/**
 * Run ISPA screening. Called from inside each lifecycle engine.
 * @param input - ISPA screening answers
 * @param context - optional context for risk escalation
 */
export function runIspaScreen(
  input: IspaInput,
  context?: {
    isChild: boolean;      // anak <5 tahun
    isPregnant: boolean;   // ibu hamil
    isElderly: boolean;    // lansia ≥60
  }
): IspaResult {
  const ctx = context ?? { isChild: false, isPregnant: false, isElderly: false };

  // No symptoms at all
  if (input.batuk === 'tidak' && !input.sesakNapas && !input.mataPerih) {
    // If exposed to smoke but no symptoms, still give prevention advice
    if (input.paparanAsap) {
      return {
        hasSymptoms: false,
        ispaRisk: 'LOW',
        referNow: false,
        counselling: [],
        reportSection: buildReport('LOW', input, ctx, false),
        payload: { ...input, ispaRisk: 'LOW' },
      };
    }
    return {
      hasSymptoms: false,
      ispaRisk: 'NONE',
      referNow: false,
      counselling: [],
      reportSection: '',
      payload: { ...input, ispaRisk: 'NONE' },
    };
  }

  // Has at least one symptom
  const symptomCount = [
    input.batuk !== 'tidak',
    input.sesakNapas,
    input.mataPerih,
  ].filter(Boolean).length;

  const longDuration = (input.durasiHari ?? 0) >= 7;

  // ── Risk classification ──
  // HIGH: sesak napas in vulnerable groups OR sesak + berdahak + long duration
  const isHigh =
    (input.sesakNapas && (ctx.isChild || ctx.isPregnant || ctx.isElderly)) ||
    (input.sesakNapas && input.batuk === 'berdahak' && longDuration) ||
    (input.sesakNapas && input.batuk === 'berdahak' && input.paparanAsap);

  // MEDIUM: sesak napas alone, or berdahak + paparan, or many symptoms
  const isMedium = !isHigh && (
    input.sesakNapas ||
    (input.batuk === 'berdahak' && longDuration) ||
    (symptomCount >= 2 && input.paparanAsap)
  );

  const risk = isHigh ? 'HIGH' : isMedium ? 'MEDIUM' : 'LOW';
  const referNow = isHigh;

  return {
    hasSymptoms: true,
    ispaRisk: risk,
    referNow,
    counselling: getCounselling(input, ctx),
    reportSection: buildReport(risk, input, ctx, true),
    payload: { ...input, ispaRisk: risk },
  };
}

function getCounselling(input: IspaInput, ctx: { isChild: boolean; isPregnant: boolean; isElderly: boolean }): string[] {
  const tips: string[] = [];

  if (input.paparanAsap) {
    tips.push('Gunakan masker (N95 jika tersedia, minimal masker kain) saat keluar rumah');
    tips.push('Hindari aktivitas berat di luar rumah saat asap tebal');
    tips.push('Tutup jendela dan pintu saat asap masuk');
    tips.push('Cuci muka dan hidung dengan air bersih setelah dari luar');
    tips.push('Minum air putih yang cukup untuk menjaga saluran napas tetap lembab');
  }

  if (input.mataPerih) {
    tips.push('Jangan mengucek mata — cuci dengan air bersih');
    tips.push('Gunakan kacamata pelindung jika tersedia');
  }

  if (input.batuk === 'berdahak') {
    tips.push('Minum air hangat untuk mengencerkan dahak');
    tips.push('Jangan minum obat batuk tanpa resep — batuk berdahak perlu dahak keluar');
  }

  if (input.batuk === 'kering') {
    tips.push('Minum madu dengan air hangat (dewasa dan anak >1 tahun)');
    tips.push('Hindari debu dan asap rokok');
  }

  if (input.sesakNapas) {
    tips.push('Duduk tegak untuk membantu pernapasan');
    if (ctx.isChild) tips.push('SEGERA bawa anak ke Puskesmas — sesak napas pada anak bisa berbahaya');
    if (ctx.isPregnant) tips.push('SEGERA ke bidan/Puskesmas — sesak napas pada ibu hamil perlu diperiksa');
    if (ctx.isElderly) tips.push('Perlu pemeriksaan segera — sesak napas pada lansia bisa tanda penyakit serius');
  }

  return tips;
}

function buildReport(
  risk: string,
  input: IspaInput,
  ctx: { isChild: boolean; isPregnant: boolean; isElderly: boolean },
  hasSymptoms: boolean
): string {
  const lines: string[] = [];
  lines.push('🌫️ SKRINING PERNAPASAN (ISPA)');

  if (!hasSymptoms && input.paparanAsap) {
    lines.push('• Terpapar asap gunung berapi/kebakaran — belum ada gejala');
    lines.push('• PENCEGAHAN: Gunakan masker, hindari luar rumah, cuci muka & hidung');
    return lines.join('\n');
  }

  if (!hasSymptoms) return '';

  // Symptoms
  if (input.batuk === 'kering') lines.push('• Batuk kering');
  if (input.batuk === 'berdahak') lines.push('• Batuk berdahak');
  if (input.sesakNapas) lines.push('• ⚠️ Sesak napas');
  if (input.mataPerih) lines.push('• Mata perih / berair');
  if (input.paparanAsap) lines.push('• 🌋 Terpapar asap gunung berapi / kebakaran hutan');
  if (input.durasiHari != null && input.durasiHari > 0) {
    lines.push(`• Gejala berlangsung: ${input.durasiHari} hari`);
  }

  // Risk
  if (risk === 'HIGH') {
    lines.push('');
    lines.push('🔴 ISPA RISIKO TINGGI — Rujuk ke Puskesmas SEGERA');
    if (ctx.isChild) lines.push('• Sesak napas pada anak <5 tahun — bisa pneumonia');
    if (ctx.isPregnant) lines.push('• Sesak napas pada ibu hamil — perlu pemeriksaan segera');
    if (ctx.isElderly) lines.push('• Sesak napas pada lansia — risiko komplikasi tinggi');
  } else if (risk === 'MEDIUM') {
    lines.push('');
    lines.push('🟡 ISPA PERLU PERHATIAN — Kunjungi Puskesmas jika gejala memburuk');
  } else {
    lines.push('');
    lines.push('🟢 ISPA RINGAN — Pantau di rumah, periksa jika berlanjut >7 hari');
  }

  // Prevention (always show if paparan)
  if (input.paparanAsap) {
    lines.push('');
    lines.push('🛡️ PENCEGAHAN PAPARAN ASAP:');
    lines.push('• Gunakan masker (N95 jika ada) saat keluar rumah');
    lines.push('• Hindari aktivitas berat di luar saat asap tebal');
    lines.push('• Tutup jendela/pintu, cuci muka & hidung setelah dari luar');
    lines.push('• Minum air putih cukup');
  }

  return lines.join('\n');
}

/**
 * Default empty ISPA input (for when user hasn't answered yet)
 */
export const emptyIspaInput: IspaInput = {
  batuk: 'tidak',
  sesakNapas: false,
  mataPerih: false,
  paparanAsap: false,
  durasiHari: null,
};
