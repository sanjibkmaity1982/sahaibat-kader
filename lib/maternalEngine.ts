// lib/maternalEngine.ts
// Offline maternal triage engine for PWA — KMS Permenkes 2/2020.
// UPDATED: LILA/KEK — Kemenkes 3d.
// UPDATED: Isi Piringku — Kemenkes 3b.
// UPDATED: TTD adherence — Kemenkes 3e.
// Deterministic, zero AI, zero network.

import { generateIsiPiringku } from './counselling/isiPiringku';
import { runIspaScreen } from './ispaScreen';

export interface MaternalInput {
  gestasi_weeks: number | null;
  lila_cm: number | null;
  perdarahan: boolean;
  nyeri_perut: boolean;
  sakit_kepala_kabur: boolean;
  demam: boolean;
  muntah_hebat: boolean;
  gerak_bayi_kurang: boolean | null;
  sesak_jantung: boolean;
  bengkak_mendadak: boolean;
  keputihan_abnormal: boolean;
  ttd_adherence: '1' | '2' | '3' | null;  // 1=rutin, 2=kadang, 3=tidak — Kemenkes 3e
  ttd_side_effects: '1' | '2' | '3' | null; // 1=mual, 2=konstipasi, 3=tidak ada
  td_sys: number | null;
  td_dia: number | null;
  // ISPA screening
  ispa_batuk: 'kering' | 'berdahak' | 'tidak';
  ispa_sesak: boolean;
  ispa_mata: boolean;
  ispa_paparan: boolean;
  ispa_durasi: number | null;
}

export type MaternalRisk = 'darurat' | 'tinggi' | 'sedang' | 'rendah';

export interface MaternalResult {
  risk: MaternalRisk;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  referNow: boolean;
  followUpDays: number;
  dangersFound: string[];
  kekStatus: 'kek' | 'normal' | 'not_measured';
  reportText: string;
  trimester: 1 | 2 | 3 | null;
  ispaRisk: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

function classifyKEK(lilaCm: number | null): 'kek' | 'normal' | 'not_measured' {
  if (lilaCm == null) return 'not_measured';
  return lilaCm < 23.5 ? 'kek' : 'normal';
}

export function computeMaternalRisk(input: MaternalInput): MaternalRisk {
  const gestasi = input.gestasi_weeks ?? 0;
  const sys = input.td_sys ?? 0;
  const dia = input.td_dia ?? 0;

  if (
    input.perdarahan ||
    (input.gerak_bayi_kurang === true && gestasi >= 28) ||
    sys >= 160 || dia >= 110 ||
    (input.sakit_kepala_kabur && input.bengkak_mendadak)
  ) return 'darurat';

  if (
    input.nyeri_perut ||
    input.sesak_jantung ||
    input.demam ||
    sys >= 140 || dia >= 90 ||
    (input.gerak_bayi_kurang === true && gestasi >= 20)
  ) return 'tinggi';

  if (
    input.sakit_kepala_kabur ||
    input.bengkak_mendadak ||
    input.muntah_hebat ||
    input.keputihan_abnormal
  ) return 'sedang';

  return 'rendah';
}

export function runMaternalTriage(
  input: MaternalInput,
  patientName: string,
  chwName?: string
): MaternalResult {
  const risk = computeMaternalRisk(input);
  const gestasi = input.gestasi_weeks;
  const sys = input.td_sys;
  const dia = input.td_dia;

  const kekStatus = classifyKEK(input.lila_cm);

  const trimester: 1 | 2 | 3 | null = gestasi == null ? null
    : gestasi <= 12 ? 1
    : gestasi <= 27 ? 2
    : 3;

// ISPA screening — sesak napas in pregnancy is always HIGH
  const ispaResult = runIspaScreen(
    { batuk: input.ispa_batuk, sesakNapas: input.ispa_sesak, mataPerih: input.ispa_mata, paparanAsap: input.ispa_paparan, durasiHari: input.ispa_durasi },
    { isChild: false, isPregnant: true, isElderly: false }
  );

  const riskLevel = (risk === 'darurat' || risk === 'tinggi' || ispaResult.referNow) ? 'HIGH'
    : (risk === 'sedang' || ispaResult.ispaRisk === 'MEDIUM') ? 'MEDIUM' : 'LOW';

  const referNow = risk === 'darurat' || risk === 'tinggi' || ispaResult.referNow;
  const followUpDays = risk === 'darurat' ? 0
    : risk === 'tinggi' ? 0
    : risk === 'sedang' ? 2 : 30;

  const dangersFound: string[] = [];
  if (input.perdarahan) dangersFound.push('Perdarahan dari jalan lahir');
  if (input.nyeri_perut) dangersFound.push('Nyeri perut hebat');
  if (input.sakit_kepala_kabur) dangersFound.push('Sakit kepala berat / pandangan kabur');
  if (input.demam) dangersFound.push('Demam tinggi');
  if (input.muntah_hebat) dangersFound.push('Mual/muntah hebat');
  if (input.gerak_bayi_kurang) dangersFound.push('Gerakan bayi berkurang / tidak terasa');
  if (input.sesak_jantung) dangersFound.push('Sesak napas / jantung berdebar');
  if (input.bengkak_mendadak) dangersFound.push('Bengkak mendadak tangan/wajah/kaki');
  if (input.keputihan_abnormal) dangersFound.push('Keputihan abnormal/berbau');
  if (sys && dia) dangersFound.push(`Tekanan darah: ${sys}/${dia} mmHg`);

  const riskBanner = risk === 'darurat' ? '🔴 DARURAT — Rujuk ke RS/Puskesmas SEGERA'
    : risk === 'tinggi' ? '🟠 RISIKO TINGGI — Rujuk ke Puskesmas hari ini'
    : risk === 'sedang' ? '🟡 PERLU DIPANTAU — Kunjungi Puskesmas 1-2 hari'
    : '🟢 KONDISI STABIL — Lanjutkan ANC rutin';

  const lines: string[] = [
    '📋 LAPORAN TRIASE — IBU HAMIL',
    '',
    `Ibu: ${patientName}`,
  ];

  if (gestasi != null && gestasi > 0) {
    lines.push(`Usia kehamilan: ${gestasi} minggu (Trimester ${trimester})`);
  }

  lines.push('');
  lines.push('📏 HASIL PENGUKURAN');
  if (input.lila_cm != null) {
    lines.push(`LILA: ${input.lila_cm} cm`);
    if (kekStatus === 'kek') {
      lines.push('🔴 Status gizi: KEK (Kurang Energi Kronik) — LILA < 23,5 cm');
    } else {
      lines.push('🟢 Status gizi: Normal — LILA ≥ 23,5 cm');
    }
  } else {
    lines.push('LILA: (tidak diukur)');
  }
  if (sys && dia) {
    lines.push(`Tekanan darah: ${sys}/${dia} mmHg`);
  }

  lines.push('');
  lines.push(riskBanner);
  lines.push('');

  if (dangersFound.length > 0) {
    lines.push('⚠️ Tanda yang ditemukan:');
    dangersFound.forEach(d => lines.push(`• ${d}`));
    lines.push('');
  } else {
    lines.push('✅ Tidak ada tanda bahaya saat ini.');
    lines.push('');
  }

  lines.push('📋 TINDAKAN:');
  if (risk === 'darurat') {
    lines.push('1. Bawa ke Puskesmas/RS SEGERA — jangan tunda');
    lines.push('2. Hubungi 119 atau minta bantuan transportasi');
    lines.push('3. Dampingi ibu — jangan tinggalkan sendirian');
  } else if (risk === 'tinggi') {
    lines.push('1. Kunjungi Puskesmas hari ini');
    lines.push('2. Pantau tanda bahaya setiap 4-6 jam');
    lines.push('3. Jika memburuk, langsung ke RS/IGD');
  } else if (risk === 'sedang') {
    lines.push('1. Kunjungi Puskesmas dalam 1-2 hari');
    lines.push('2. Tetap minum TTD setiap hari');
    lines.push('3. Pantau gejala — jika memburuk, segera ke Puskesmas');
  } else {
    lines.push('1. Lanjutkan kunjungan ANC sesuai jadwal');
    lines.push('2. Minum TTD setiap hari');
    lines.push('3. Makan bergizi dan cukup minum air');
    lines.push('4. Kenali tanda bahaya — segera ke Puskesmas jika muncul');
  }

  if ((gestasi ?? 0) >= 20 && risk !== 'darurat') {
    lines.push('');
    lines.push('👶 Pantau gerakan bayi: minimal 10 kali dalam 12 jam.');
  }

  // ── TTD adherence section ───────────────────────────────────
  if (input.ttd_adherence) {
    lines.push('');
    lines.push('💊 TABLET TAMBAH DARAH (TTD)');
    if (input.ttd_adherence === '1') {
      lines.push('✅ Ibu rutin minum TTD — pertahankan!');
    } else if (input.ttd_adherence === '2') {
      lines.push('⚠️ Ibu kadang-kadang minum TTD — perlu ditingkatkan');
      lines.push('• TTD WAJIB diminum setiap hari selama hamil');
      lines.push('• Jika lupa, minum segera saat ingat');
    } else {
      lines.push('🔴 Ibu TIDAK minum TTD — risiko anemia tinggi!');
      lines.push('• TTD WAJIB diminum setiap hari selama hamil');
      lines.push('• Minta TTD GRATIS di Puskesmas/Posyandu');
      lines.push('• Anemia saat hamil berbahaya bagi ibu dan bayi');
    }

    // Side effect counselling
    if (input.ttd_side_effects === '1') {
      lines.push('');
      lines.push('💡 Tips mengatasi mual setelah minum TTD:');
      lines.push('• Minum TTD sebelum tidur malam (bukan pagi)');
      lines.push('• Minum bersama air jeruk (vitamin C)');
      lines.push('• Jangan minum TTD bersamaan teh, kopi, atau susu');
    } else if (input.ttd_side_effects === '2') {
      lines.push('');
      lines.push('💡 Tips mengatasi sembelit setelah minum TTD:');
      lines.push('• Minum air putih lebih banyak (8-10 gelas/hari)');
      lines.push('• Makan sayur dan buah setiap hari (pepaya sangat membantu)');
      lines.push('• Tetap aktif bergerak — jalan kaki ringan');
    }
  }

  // ── Isi Piringku maternal nutrition counselling ──────────────
  const nutritionSection = generateIsiPiringku({
    sasaranType: 'maternal',
    kekStatus,
  });
  if (nutritionSection) {
    lines.push('');
    lines.push(nutritionSection);
  }

  lines.push('');
  if (chwName) lines.push(`Kader: ${chwName}`);
  if (ispaResult.reportSection) {
    lines.push('');
    lines.push(ispaResult.reportSection);
  }

  lines.push('Bukan diagnosis. SahAIbat Kader v1.');

  return {
    risk, riskLevel, referNow, followUpDays,
    dangersFound, kekStatus, trimester,
    reportText: lines.join('\n'),
    ispaRisk: ispaResult.ispaRisk,
  };
}
