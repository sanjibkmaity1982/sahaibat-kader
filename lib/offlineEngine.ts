// lib/offlineEngine.ts
// Browser-safe offline WHO growth engine for SahAIbat Kader PWA.
// Now uses @sahaibat/growth-engine as single source of truth.
// UPDATED: Feature 1 (velocity engine) + Feature 2 (CMAM flag) added.
// All WHO classification logic unchanged — zero AI cost, fully offline.

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

export interface OfflineTriageInput {
  weightKg: number;
  heightCm: number;
  muacCm: number | null;
  ageMonths: number;
  gender: 'male' | 'female';
  feedingFreq: '1' | '2' | '3';
  milestoneScore: '1' | '2' | '3';
  childName?: string;
  chwName?: string;

  // ── Feature 1: previous visit data for velocity (optional) ──
  // Populated from offlineStore when child has prior visits
  previousVisit?: {
    weight_kg: number;
    severity: string;
    visit_date: string;
  } | null;

  // Consecutive declining visits count from child record
  consecutiveDeclines?: number;
}

export interface OfflineTriageResult {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  waz: WHOCategory;
  laz: WHOCategory;
  wlz: WHOCategory;
  muacCat: 'sam' | 'mam' | 'normal';
  isSevere: boolean;
  isModerate: boolean;
  reportText: string;
  followUpDays: number;
  referNow: boolean;

  // ── Feature 1: velocity ──────────────────────────────────────
  velocityFlag: VelocityFlag;
  velocityMessage: string;

  // ── Feature 2: CMAM ─────────────────────────────────────────
  // true = show CMAM confirmation question after result screen
  // One extra tap — only for SAM cases
  cmamConfirmNeeded: boolean;
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

  const riskLevel = isSevere ? 'HIGH' : isModerate ? 'MEDIUM' : 'LOW';
  const referNow = isSevere;

  const followUpDays = isSevere ? 0
    : muacCat === 'mam' ? 7
    : input.ageMonths <= 24 ? 30 : 90;

  // ── Feature 1: Velocity calculation (deterministic, offline) ─
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

  // ── Feature 2: CMAM flag (deterministic, no extra Kader work) ─
  // Only triggers the confirmation question for SAM cases
  const cmamConfirmNeeded = shouldStartCmam(
    input.muacCm,
    wlz,
    waz
  );

  // ── Build report text (identical structure to WhatsApp output) ─
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
    '',
    '🔍 PENILAIAN WHO',
    `${whoEmoji(waz)} Berat/Usia (BB/U): ${whoLabel(waz, 'id')}`,
    `${whoEmoji(laz)} Tinggi/Usia (TB/U): ${whoLabel(laz, 'id')}`,
    `${whoEmoji(wlz)} Berat/Tinggi (BB/TB): ${whoLabel(wlz, 'id')}`,
    muacCat === 'sam' ? '🔴 LILA: Gizi buruk (SAM) — RUJUK SEGERA'
      : muacCat === 'mam' ? '🟡 LILA: Gizi kurang (MAM) — pantau ketat'
      : input.muacCm ? '🟢 LILA: Normal' : '⚪ LILA: Tidak diukur',
    '',
    '✅ TINDAK LANJUT',
  ];

  if (referNow) {
    lines.push('• RUJUK ke Puskesmas hari ini');
  } else if (isModerate) {
    lines.push('• Pantau berat badan setiap 2 minggu');
    lines.push('• Berikan makanan tambahan (PMT)');
  } else {
    lines.push('• Tumbuh kembang baik — lanjutkan pola makan saat ini');
  }

  if (input.milestoneScore === '3' || input.milestoneScore === '2') {
    lines.push('• Rujuk ke Puskesmas untuk evaluasi tumbuh kembang');
  }
  if (input.feedingFreq === '1') {
    lines.push('• Tingkatkan frekuensi makan/menyusu');
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

  // ── Feature 1: Velocity section appended to report ───────────
  // Only shows when there is something meaningful (not first_visit or stable)
  if (velocityMessage && velocityMessage.trim().length > 0) {
    lines.push('');
    lines.push(velocityMessage);
  }

  lines.push('Bukan diagnosis. SahAIbat Kader v1.');

  return {
    riskLevel,
    waz, laz, wlz,
    muacCat,
    isSevere,
    isModerate,
    referNow,
    followUpDays,
    reportText: lines.join('\n'),
    // Feature 1
    velocityFlag: velocityResult.flag,
    velocityMessage,
    // Feature 2
    cmamConfirmNeeded,
  };
}
