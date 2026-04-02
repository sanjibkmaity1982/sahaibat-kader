// lib/neonatalEngine.ts
// Offline neonatal triage engine for PWA — KMS Permenkes 2/2020.
// Covers: Bayi Baru Lahir (0–28 days).
// Deterministic, zero AI, zero network.

export interface NeonatalInput {
  age_days: number | null;          // age in days (0-28)
  tidak_menyusu: boolean;           // tidak mau menyusu / lemah saat menyusu
  demam: boolean;                   // suhu >37.5°C
  hipotermi: boolean;               // badan terasa dingin / suhu <36.5°C
  kejang: boolean;                  // kejang
  sesak_napas: boolean;             // sesak napas / napas cepat (>60x/menit)
  kuning: boolean;                  // kuning (ikterus) — terutama >2 minggu atau kuning di telapak tangan/kaki
  tali_pusat_infeksi: boolean;      // tali pusat merah/berbau/bernanah
  diare_muntah: boolean;            // diare atau muntah berulang
  bblr: boolean;                    // bayi berat badan lahir rendah / sangat kecil/prematur
  tidak_bab_bak: boolean;           // tidak BAB dalam 24 jam pertama / tidak BAK dalam 12 jam
}

export type NeonatalRisk = 'darurat' | 'tinggi' | 'sedang' | 'rendah';

export interface NeonatalResult {
  risk: NeonatalRisk;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  referNow: boolean;
  followUpDays: number;
  dangersFound: string[];
  reportText: string;
  ageGroup: 'very_early' | 'early' | 'mid' | 'late'; // 0-3d, 4-7d, 8-14d, 15-28d
}

export function computeNeonatalRisk(input: NeonatalInput): NeonatalRisk {
  // DARURAT — immediate life threat
  if (
    input.kejang ||
    input.sesak_napas ||
    input.tidak_menyusu ||  // in neonate, not feeding = emergency
    input.hipotermi ||
    (input.kuning && (input.age_days ?? 0) < 2) || // jaundice day 1-2 = pathological
    input.tidak_bab_bak
  ) return 'darurat';

  // TINGGI — refer today
  if (
    input.demam ||
    input.bblr ||
    (input.kuning && (input.age_days ?? 0) > 14) // prolonged jaundice
  ) return 'tinggi';

  // SEDANG — needs attention
  if (
    input.tali_pusat_infeksi ||
    input.diare_muntah ||
    (input.kuning && (input.age_days ?? 0) >= 2) // physiological but monitor
  ) return 'sedang';

  return 'rendah';
}

export function runNeonatalTriage(
  input: NeonatalInput,
  babyName: string,
  chwName?: string
): NeonatalResult {
  const risk = computeNeonatalRisk(input);
  const days = input.age_days ?? 0;

  const ageGroup: 'very_early' | 'early' | 'mid' | 'late' =
    days <= 3 ? 'very_early'
    : days <= 7 ? 'early'
    : days <= 14 ? 'mid'
    : 'late';

  const riskLevel = risk === 'darurat' || risk === 'tinggi' ? 'HIGH'
    : risk === 'sedang' ? 'MEDIUM' : 'LOW';

  const referNow = risk === 'darurat' || risk === 'tinggi';
  const followUpDays = risk === 'darurat' ? 0
    : risk === 'tinggi' ? 0
    : risk === 'sedang' ? 1 : 7;

  const dangersFound: string[] = [];
  if (input.tidak_menyusu) dangersFound.push('Tidak mau menyusu / lemah saat menyusu');
  if (input.kejang) dangersFound.push('Kejang');
  if (input.sesak_napas) dangersFound.push('Sesak napas / napas cepat');
  if (input.demam) dangersFound.push('Demam (suhu >37.5°C)');
  if (input.hipotermi) dangersFound.push('Badan dingin (suhu <36.5°C)');
  if (input.kuning) dangersFound.push(`Kuning (ikterus) — usia ${days} hari`);
  if (input.tali_pusat_infeksi) dangersFound.push('Tali pusat merah/berbau/bernanah');
  if (input.diare_muntah) dangersFound.push('Diare atau muntah berulang');
  if (input.bblr) dangersFound.push('Bayi berat badan lahir rendah / prematur');
  if (input.tidak_bab_bak) dangersFound.push('Belum BAB >24 jam atau belum BAK >12 jam');

  const riskBanner = risk === 'darurat' ? '🔴 DARURAT — Bawa ke RS/Puskesmas SEGERA'
    : risk === 'tinggi' ? '🟠 RISIKO TINGGI — Ke Puskesmas hari ini'
    : risk === 'sedang' ? '🟡 PERLU PERHATIAN — Pantau ketat, ke Puskesmas besok'
    : '🟢 BAYI SEHAT — Lanjutkan perawatan rutin';

  const ageLabel = days === 0 ? 'Hari pertama kelahiran'
    : days === 1 ? 'Usia 1 hari'
    : `Usia ${days} hari`;

  const lines: string[] = [
    '📋 LAPORAN TRIASE — BAYI BARU LAHIR',
    '',
    `Bayi: ${babyName}`,
    ageLabel,
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
    lines.push('1. Bawa ke RS/Puskesmas SEKARANG — jangan tunda');
    lines.push('2. Jaga bayi tetap hangat selama perjalanan');
    lines.push('3. Hubungi 119 jika butuh transportasi darurat');
  } else if (risk === 'tinggi') {
    lines.push('1. Bawa ke Puskesmas hari ini');
    lines.push('2. Jaga kehangatan bayi');
    lines.push('3. Lanjutkan ASI jika bayi masih bisa menyusu');
  } else if (risk === 'sedang') {
    lines.push('1. Pantau ketat kondisi bayi');
    lines.push('2. Kunjungi Puskesmas besok');
    if (input.tali_pusat_infeksi) {
      lines.push('3. Bersihkan tali pusat dengan kassa kering — jangan alkohol');
      lines.push('4. Jangan tutup dengan plester atau kain kotor');
    }
    if (input.diare_muntah) {
      lines.push('3. Tetap berikan ASI sesering mungkin');
      lines.push('4. Pantau tanda dehidrasi (mulut kering, fontanel cekung)');
    }
  } else {
    lines.push('1. ASI eksklusif — susui 8-12 kali/hari atau setiap 2-3 jam');
    lines.push('2. Jaga kehangatan bayi (bedong, skin-to-skin dengan ibu)');
    lines.push('3. Rawat tali pusat: bersih dan kering, jangan diperban');
    lines.push('4. Imunisasi HB0 dalam 24 jam pertama');
    lines.push('5. Kunjungan neonatal: hari ke-3, 7, dan 28');
  }

  // Age-specific notes
  if (ageGroup === 'very_early' && risk === 'rendah') {
    lines.push('');
    lines.push('📌 Usia 0-3 hari: Pastikan IMD (Inisiasi Menyusu Dini) sudah dilakukan. Kolostrum sangat penting untuk imunitas bayi.');
  }
  if (input.bblr) {
    lines.push('');
    lines.push('⚠️ Bayi BBLR: Perlu Perawatan Metode Kanguru (PMK) — skin-to-skin dengan ibu minimal 1-2 jam per hari untuk menjaga suhu tubuh bayi.');
  }

  lines.push('');
  if (chwName) lines.push(`Kader: ${chwName}`);
  lines.push('Bukan diagnosis. SahAIbat Kader v1.');

  return {
    risk, riskLevel, referNow, followUpDays,
    dangersFound, ageGroup,
    reportText: lines.join('\n'),
  };
}
