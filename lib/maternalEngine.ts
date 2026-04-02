// lib/maternalEngine.ts
// Offline maternal triage engine for PWA — KMS Permenkes 2/2020.
// Deterministic, zero AI, zero network. Mirrors maternalModule.ts logic.

export interface MaternalInput {
  gestasi_weeks: number | null;
  perdarahan: boolean;
  nyeri_perut: boolean;
  sakit_kepala_kabur: boolean;
  demam: boolean;
  muntah_hebat: boolean;
  gerak_bayi_kurang: boolean | null; // null = not asked (< 20 weeks)
  sesak_jantung: boolean;
  bengkak_mendadak: boolean;
  keputihan_abnormal: boolean;
  td_sys: number | null;
  td_dia: number | null;
}

export type MaternalRisk = 'darurat' | 'tinggi' | 'sedang' | 'rendah';

export interface MaternalResult {
  risk: MaternalRisk;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  referNow: boolean;
  followUpDays: number;
  dangersFound: string[];
  reportText: string;
  trimester: 1 | 2 | 3 | null;
}

export function computeMaternalRisk(input: MaternalInput): MaternalRisk {
  const gestasi = input.gestasi_weeks ?? 0;
  const sys = input.td_sys ?? 0;
  const dia = input.td_dia ?? 0;

  // DARURAT
  if (
    input.perdarahan ||
    (input.gerak_bayi_kurang === true && gestasi >= 28) ||
    sys >= 160 || dia >= 110 ||
    (input.sakit_kepala_kabur && input.bengkak_mendadak)
  ) return 'darurat';

  // TINGGI
  if (
    input.nyeri_perut ||
    input.sesak_jantung ||
    input.demam ||
    sys >= 140 || dia >= 90 ||
    (input.gerak_bayi_kurang === true && gestasi >= 20)
  ) return 'tinggi';

  // SEDANG
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

  const trimester: 1 | 2 | 3 | null = gestasi == null ? null
    : gestasi <= 12 ? 1
    : gestasi <= 27 ? 2
    : 3;

  const riskLevel = risk === 'darurat' || risk === 'tinggi' ? 'HIGH'
    : risk === 'sedang' ? 'MEDIUM' : 'LOW';

  const referNow = risk === 'darurat' || risk === 'tinggi';
  const followUpDays = risk === 'darurat' ? 0
    : risk === 'tinggi' ? 0
    : risk === 'sedang' ? 2 : 30;

  // Collect danger signs
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

  lines.push('');
  if (chwName) lines.push(`Kader: ${chwName}`);
  lines.push('Bukan diagnosis. SahAIbat Kader v1.');

  return {
    risk, riskLevel, referNow, followUpDays,
    dangersFound, trimester,
    reportText: lines.join('\n'),
  };
}
