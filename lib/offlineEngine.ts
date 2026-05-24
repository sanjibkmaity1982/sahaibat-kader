// lib/offlineEngine.ts
// Browser-safe offline WHO growth engine for SahAIbat Kader PWA.
// UPDATED: IYCF/Isi Piringku counselling appended to report — Kemenkes 2b.
// UPDATED: Head circumference (lingkar kepala) — Kemenkes 2c.
// All WHO classification logic unchanged — zero AI cost, fully offline.

import { generateIsiPiringku } from './counselling/isiPiringku';
import { runIspaScreen } from './ispaScreen';
import {
  computeWHOClassification,
  interpretMUAC,
  whoLabel,
  whoEmoji,
  type WHOCategory,
} from '@sahaibat/growth-engine';

import {
  computeVelocity,
  buildVelocitySection,
  type VelocityFlag,
} from './velocityEngine';

import {
  shouldStartCmam,
} from './cmamEngine';

import { generateIsiPiringku } from './counselling/isiPiringku';

export interface OfflineTriageInput {
  weightKg: number;
  heightCm: number;
  muacCm: number | null;
  headCircCm: number | null;
  ageMonths: number;
  gender: 'male' | 'female';
  feedingFreq: '1' | '2' | '3';
  milestoneScore: '1' | '2' | '3';
  childName?: string;
  chwName?: string;

  previousVisit?: {
    weight_kg: number;
    severity: string;
    visit_date: string;
  } | null;

 consecutiveDeclines?: number;
  // ISPA screening
  ispa_batuk?: 'kering' | 'berdahak' | 'tidak';
  ispa_sesak?: boolean;
  ispa_mata?: boolean;
  ispa_paparan?: boolean;
  ispa_durasi?: number | null;
}

export interface OfflineTriageResult {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  waz: WHOCategory;
  laz: WHOCategory;
  wlz: WHOCategory;
  muacCat: 'sam' | 'mam' | 'normal';
  headCircFlag: 'micro' | 'macro' | 'normal' | 'not_measured';
  isSevere: boolean;
  isModerate: boolean;
  reportText: string;
  followUpDays: number;
  referNow: boolean;

  velocityFlag: VelocityFlag;
  velocityMessage: string;
  cmamConfirmNeeded: boolean;
  ispaRisk: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

// ── Head circumference classification (simplified WHO reference) ──────────
function classifyHeadCirc(
  hcCm: number,
  ageMonths: number,
  gender: 'male' | 'female'
): 'micro' | 'macro' | 'normal' {
  const refs: Record<string, { low: number; high: number }[]> = {
    male: [
      { low: 31.9, high: 37.0 },  // 0
      { low: 33.8, high: 38.8 },  // 1
      { low: 35.6, high: 40.6 },  // 2
      { low: 37.0, high: 42.0 },  // 3
      { low: 39.7, high: 44.5 },  // 6
      { low: 41.2, high: 46.3 },  // 9
      { low: 42.3, high: 47.5 },  // 12
      { low: 43.5, high: 49.0 },  // 18
      { low: 44.4, high: 49.9 },  // 24
      { low: 45.5, high: 51.3 },  // 36
      { low: 46.3, high: 52.0 },  // 48
      { low: 46.7, high: 52.5 },  // 60
    ],
    female: [
      { low: 31.5, high: 36.2 },  // 0
      { low: 33.0, high: 37.9 },  // 1
      { low: 34.6, high: 39.6 },  // 2
      { low: 35.9, high: 40.9 },  // 3
      { low: 38.3, high: 43.4 },  // 6
      { low: 39.8, high: 45.2 },  // 9
      { low: 40.8, high: 46.4 },  // 12
      { low: 42.1, high: 47.8 },  // 18
      { low: 43.0, high: 48.7 },  // 24
      { low: 44.2, high: 50.1 },  // 36
      { low: 45.0, high: 50.8 },  // 48
      { low: 45.4, high: 51.2 },  // 60
    ],
  };

  const agePoints = [0, 1, 2, 3, 6, 9, 12, 18, 24, 36, 48, 60];
  const genderRefs = refs[gender];

  let lowerIdx = 0;
  for (let i = 0; i < agePoints.length - 1; i++) {
    if (ageMonths >= agePoints[i]) lowerIdx = i;
  }
  const upperIdx = Math.min(lowerIdx + 1, agePoints.length - 1);

  const ageLow = agePoints[lowerIdx];
  const ageHigh = agePoints[upperIdx];
  const fraction = ageHigh === ageLow ? 0 : (ageMonths - ageLow) / (ageHigh - ageLow);

  const lowThreshold = genderRefs[lowerIdx].low + fraction * (genderRefs[upperIdx].low - genderRefs[lowerIdx].low);
  const highThreshold = genderRefs[lowerIdx].high + fraction * (genderRefs[upperIdx].high - genderRefs[lowerIdx].high);

  if (hcCm < lowThreshold) return 'micro';
  if (hcCm > highThreshold) return 'macro';
  return 'normal';
}

function headCircLabel(flag: 'micro' | 'macro' | 'normal' | 'not_measured'): string {
  switch (flag) {
    case 'micro': return '🔴 Lingkar kepala: Di bawah normal (mikrosefali) — RUJUK';
    case 'macro': return '🟡 Lingkar kepala: Di atas normal (makrosefali) — periksa lebih lanjut';
    case 'normal': return '🟢 Lingkar kepala: Normal';
    case 'not_measured': return '⚪ Lingkar kepala: Tidak diukur';
  }
}

export function runGrowthTriage(input: OfflineTriageInput): OfflineTriageResult {
  const male = input.gender === 'male';
  const result = computeWHOClassification(
    input.weightKg, input.heightCm, input.ageMonths,
    male ? 'male' : 'female'
  );

  const waz = result?.waz ?? 'normal';
  const laz = result?.laz ?? 'normal';
  const wlz = result?.wlz ?? 'normal';
  const muacCat = input.muacCm ? interpretMUAC(input.muacCm, input.ageMonths) : 'normal';

  const headCircFlag: 'micro' | 'macro' | 'normal' | 'not_measured' =
    input.headCircCm != null
      ? classifyHeadCirc(input.headCircCm, input.ageMonths, input.gender)
      : 'not_measured';

  const isSevere = muacCat === 'sam' ||
    waz === 'severely_underweight' ||
    laz === 'severely_stunted' ||
    wlz === 'severely_wasted';

  const isModerate = !isSevere && (
    muacCat === 'mam' ||
    waz === 'underweight' ||
    laz === 'stunted' ||
    wlz === 'wasted'
  );

// ISPA screening — sesak napas in child <5 = HIGH (pneumonia risk)
  const ispaResult = runIspaScreen(
    { batuk: input.ispa_batuk ?? 'tidak', sesakNapas: input.ispa_sesak ?? false, mataPerih: input.ispa_mata ?? false, paparanAsap: input.ispa_paparan ?? false, durasiHari: input.ispa_durasi ?? null },
    { isChild: true, isPregnant: false, isElderly: false }
  );

  const riskLevel = (isSevere || ispaResult.referNow) ? 'HIGH' : (isModerate || ispaResult.ispaRisk === 'MEDIUM') ? 'MEDIUM' : 'LOW';
  const referNow = isSevere || headCircFlag === 'micro' || ispaResult.referNow;

  const followUpDays = isSevere ? 0
    : muacCat === 'mam' ? 7
    : input.ageMonths <= 24 ? 30 : 90;

  const velocityResult = computeVelocity(
    {
      weight_kg: input.weightKg,
      severity: isSevere ? 'sam' : isModerate ? 'mam' : 'normal',
      age_months: input.ageMonths,
    },
    input.previousVisit ?? null,
    input.consecutiveDeclines ?? 0
  );
  const velocityMessage = buildVelocitySection(velocityResult);

  const cmamConfirmNeeded = shouldStartCmam(
    input.muacCm,
    wlz,
    waz
  );

  // ── Build report text ─
  const ageDisplay = input.ageMonths < 12
    ? `${input.ageMonths} bulan`
    : `${Math.floor(input.ageMonths / 12)} tahun ${input.ageMonths % 12 > 0 ? input.ageMonths % 12 + ' bulan' : ''}`.trim();

  const lines: string[] = [
    '📋 LAPORAN POSYANDU — SahAIbat Kader',
    '',
    '👤 DATA ANAK',
    ...(input.childName ? [`Nama: ${input.childName}`] : []),
    `Usia: ${ageDisplay}`,
    `Jenis kelamin: ${male ? 'Laki-laki' : 'Perempuan'}`,
    '',
    '📏 HASIL PENGUKURAN',
    `Berat badan: ${input.weightKg} kg`,
    `Tinggi/panjang: ${input.heightCm} cm`,
    `LILA: ${input.muacCm ? input.muacCm + ' cm' : '(tidak diukur)'}`,
    `Lingkar kepala: ${input.headCircCm ? input.headCircCm + ' cm' : '(tidak diukur)'}`,
    '',
    '🔍 PENILAIAN WHO',
    `${whoEmoji(waz)} Berat/Usia (BB/U): ${whoLabel(waz, 'id')}`,
    `${whoEmoji(laz)} Tinggi/Usia (TB/U): ${whoLabel(laz, 'id')}`,
    `${whoEmoji(wlz)} Berat/Tinggi (BB/TB): ${whoLabel(wlz, 'id')}`,
    muacCat === 'sam' ? '🔴 LILA: Gizi buruk (SAM) — RUJUK SEGERA'
      : muacCat === 'mam' ? '🟡 LILA: Gizi kurang (MAM) — pantau ketat'
      : input.muacCm ? '🟢 LILA: Normal' : '⚪ LILA: Tidak diukur',
    headCircLabel(headCircFlag),
    '',
    '✅ TINDAK LANJUT',
  ];

  if (referNow) {
    lines.push('• RUJUK ke Puskesmas hari ini');
    if (headCircFlag === 'micro') {
      lines.push('• Lingkar kepala di bawah normal — perlu pemeriksaan lanjutan');
    }
  } else if (isModerate) {
    lines.push('• Pantau berat badan setiap 2 minggu');
    lines.push('• Berikan makanan tambahan (PMT)');
  } else {
    lines.push('• Tumbuh kembang baik — lanjutkan pola makan saat ini');
  }

  if (headCircFlag === 'macro') {
    lines.push('• Lingkar kepala di atas normal — periksa di Puskesmas');
  }

  if (input.milestoneScore === '3' || input.milestoneScore === '2') {
    lines.push('• Rujuk ke Puskesmas untuk evaluasi tumbuh kembang');
  }
  if (input.feedingFreq === '1') {
    lines.push('• Tingkatkan frekuensi makan/menyusu');
  }

  // ── IYCF / Isi Piringku counselling section ──────────────────
  const iycfSection = generateIsiPiringku({
    sasaranType: 'child',
    ageMonths: input.ageMonths,
    feedingFreq: input.feedingFreq,
    muacCat,
    laz,
  });
  if (iycfSection) {
    lines.push('');
    lines.push(iycfSection);
  }

  lines.push('');
  if (input.chwName) lines.push(`Kader: ${input.chwName}`);

  if (referNow) {
    lines.push('⚠️ Kunjungan berikutnya: SEGERA ke Puskesmas');
    lines.push('Jangan tunda — kondisi ini membutuhkan penanganan hari ini.');
  } else if (muacCat === 'mam') {
    lines.push('📅 Kunjungan berikutnya: 1 minggu lagi');
  } else {
    lines.push(`📅 Kunjungan berikutnya: ${input.ageMonths <= 24 ? '1 bulan' : '3 bulan'} lagi`);
  }

  if (velocityMessage && velocityMessage.trim().length > 0) {
    lines.push('');
    lines.push(velocityMessage);
  }

 if (ispaResult.reportSection) {
    lines.push('');
    lines.push(ispaResult.reportSection);
  }

  lines.push('Bukan diagnosis. SahAIbat Kader v1.');

  return {
    riskLevel,
    waz, laz, wlz,
    muacCat,
    headCircFlag,
    isSevere,
    isModerate,
    referNow,
    followUpDays,
    reportText: lines.join('\n'),
    velocityFlag: velocityResult.flag,
    velocityMessage,
   cmamConfirmNeeded,
    ispaRisk: ispaResult.ispaRisk,
  };
}
