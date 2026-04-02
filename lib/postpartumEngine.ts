// lib/postpartumEngine.ts
// Offline postpartum triage engine for PWA — KMS Permenkes 2/2020.
// Covers: Setelah Melahirkan (Nifas) — 0 to 42 days post-delivery.
// Deterministic, zero AI, zero network.

export interface PostpartumInput {
  days_postpartum: number | null;    // days since delivery
  perdarahan: boolean;               // perdarahan lewat jalan lahir
  demam: boolean;                    // demam lebih dari 2 hari
  cairan_berbau: boolean;            // keluar cairan berbau dari jalan lahir
  nyeri_ulu_hati: boolean;           // nyeri ulu hati/mual/sakit kepala berat/pandangan kabur/kejang/bengkak
  payudara_bengkak: boolean;         // payudara bengkak merah sakit (mastitis)
  depresi: boolean;                  // sedih/murung/menangis tanpa sebab >2 minggu
  asi_masalah: boolean;              // kesulitan menyusui / bayi tidak mau menyusu
  tali_pusat?: boolean;              // kondisi tali pusat (opsional, relevan jika merawat bayi)
}

export type PostpartumRisk = 'darurat' | 'tinggi' | 'sedang' | 'rendah';

export interface PostpartumResult {
  risk: PostpartumRisk;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  referNow: boolean;
  followUpDays: number;
  dangersFound: string[];
  reportText: string;
  phase: 'early' | 'mid' | 'late'; // early=0-7d, mid=8-28d, late=29-42d
}

export function computePostpartumRisk(input: PostpartumInput): PostpartumRisk {
  // DARURAT — life-threatening
  if (
    input.perdarahan ||
    input.nyeri_ulu_hati  // preeklampsia/eklampsia signs post-delivery
  ) return 'darurat';

  // TINGGI — refer today
  if (
    input.demam ||
    input.cairan_berbau   // infection/endometritis
  ) return 'tinggi';

  // SEDANG — needs attention within 1-2 days
  if (
    input.payudara_bengkak ||
    input.depresi
  ) return 'sedang';

  // RENDAH — normal, education only
  return 'rendah';
}

export function runPostpartumTriage(
  input: PostpartumInput,
  patientName: string,
  chwName?: string
): PostpartumResult {
  const risk = computePostpartumRisk(input);
  const days = input.days_postpartum ?? 0;

  const phase: 'early' | 'mid' | 'late' = days <= 7 ? 'early'
    : days <= 28 ? 'mid' : 'late';

  const riskLevel = risk === 'darurat' || risk === 'tinggi' ? 'HIGH'
    : risk === 'sedang' ? 'MEDIUM' : 'LOW';

  const referNow = risk === 'darurat' || risk === 'tinggi';
  const followUpDays = risk === 'darurat' ? 0
    : risk === 'tinggi' ? 0
    : risk === 'sedang' ? 2 : 7;

  const dangersFound: string[] = [];
  if (input.perdarahan) dangersFound.push('Perdarahan lewat jalan lahir');
  if (input.demam) dangersFound.push('Demam lebih dari 2 hari');
  if (input.cairan_berbau) dangersFound.push('Keluar cairan berbau dari jalan lahir');
  if (input.nyeri_ulu_hati) dangersFound.push('Nyeri ulu hati/sakit kepala berat/pandangan kabur/bengkak');
  if (input.payudara_bengkak) dangersFound.push('Payudara bengkak, merah, dan sakit');
  if (input.depresi) dangersFound.push('Ibu tampak sedih/murung/menangis tanpa sebab');
  if (input.asi_masalah) dangersFound.push('Kesulitan menyusui');

  const riskBanner = risk === 'darurat' ? '🔴 DARURAT — Rujuk ke RS/Puskesmas SEGERA'
    : risk === 'tinggi' ? '🟠 RISIKO TINGGI — Rujuk ke Puskesmas hari ini'
    : risk === 'sedang' ? '🟡 PERLU PERHATIAN — Kunjungi Puskesmas 1-2 hari'
    : '🟢 KONDISI STABIL — Pantau rutin';

  const phaseLabel = phase === 'early' ? 'Nifas awal (0-7 hari)'
    : phase === 'mid' ? 'Nifas tengah (8-28 hari)'
    : 'Nifas akhir (29-42 hari)';

  const lines: string[] = [
    '📋 LAPORAN TRIASE — IBU NIFAS',
    '',
    `Ibu: ${patientName}`,
    days > 0 ? `Hari ke-${days} pasca melahirkan (${phaseLabel})` : phaseLabel,
    '',
    riskBanner,
    '',
  ];

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
    lines.push('1. Bawa ke Puskesmas/RS SEGERA');
    lines.push('2. Hubungi 119 jika perlu transportasi darurat');
    lines.push('3. Jangan tinggalkan ibu sendirian');
  } else if (risk === 'tinggi') {
    lines.push('1. Kunjungi Puskesmas hari ini');
    lines.push('2. Kompres hangat jika ada infeksi');
    lines.push('3. Pastikan ibu minum cukup air');
  } else if (risk === 'sedang') {
    lines.push('1. Kunjungi Puskesmas dalam 1-2 hari');
    if (input.payudara_bengkak) {
      lines.push('2. Kompres hangat payudara sebelum menyusui');
      lines.push('3. Tetap menyusui — hentikan bisa memperburuk');
    }
    if (input.depresi) {
      lines.push('2. Berikan dukungan emosional dari keluarga');
      lines.push('3. Jika berlanjut >2 minggu, rujuk konseling');
    }
  } else {
    lines.push('1. Konsumsi TTD setiap hari');
    lines.push('2. Makan bergizi — sayur, protein, buah');
    lines.push('3. Menyusui bayi sesering mungkin (8-12x/hari)');
    lines.push('4. Istirahat cukup — minta bantuan keluarga');
    lines.push('5. Kunjungan nifas berikutnya sesuai jadwal');
  }

  // Phase-specific advice
  if (phase === 'early' && risk === 'rendah') {
    lines.push('');
    lines.push('📅 Jadwal kunjungan nifas:');
    lines.push('• Hari ke 3, 7, 14, dan 40 pasca melahirkan');
  }

  // ASI advice
  if (input.asi_masalah) {
    lines.push('');
    lines.push('🤱 Tips menyusui: Posisi dan pelekatan yang benar — mulut bayi menutup areola, bukan hanya puting. Hubungi konselor menyusui di Puskesmas.');
  }

  lines.push('');
  if (chwName) lines.push(`Kader: ${chwName}`);
  lines.push('Bukan diagnosis. SahAIbat Kader v1.');

  return {
    risk, riskLevel, referNow, followUpDays,
    dangersFound, phase,
    reportText: lines.join('\n'),
  };
}
