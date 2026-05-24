// lib/malariaEngine.ts
// Offline malaria screening engine for SahAIbat Kader PWA.
// WHO malaria danger signs + Kemenkes P2 Malaria guidelines.
// Relevant for NTT, Papua, Maluku, parts of Sulawesi and Kalimantan.
// Deterministic, zero AI, fully offline.

export interface MalariaInput {
  patientName: string;
  age_years: number;
  gender: 'male' | 'female';
  endemic_area: '1' | '2' | '3';      // 1=tinggal endemis, 2=baru kembali <4wk, 3=tidak
  fever_days: number;
  fever_pattern: '1' | '2' | '3';     // 1=terus-menerus, 2=naik turun teratur, 3=tidak teratur
  symptoms: string[];                   // array of: 'menggigil', 'sakit_kepala', 'mual', 'nyeri_otot'
  danger_signs: string[];               // array of: 'kesadaran', 'kejang', 'lemas', 'kuning', 'kencing_sedikit', 'sesak'
  rdt_result: '1' | '2' | '3';        // 1=positif, 2=negatif, 3=belum
  is_pregnant: boolean;
 is_under5: boolean;
  paparan_asap: boolean;             // tinggal dekat gunung berapi / kebakaran hutan
}

export interface MalariaResult {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  referNow: boolean;
  followUpDays: number;
  reportText: string;
}

export function runMalariaTriage(input: MalariaInput, chwName?: string): MalariaResult {
  const hasDangerSign = input.danger_signs.length > 0;
  const rdtPositive = input.rdt_result === '1';
  const rdtNegative = input.rdt_result === '2';
  const noRdt = input.rdt_result === '3';
  const isEndemic = input.endemic_area === '1' || input.endemic_area === '2';
  const hasSymptoms = input.symptoms.length > 0;
  const feverPatternSuspect = input.fever_pattern === '2'; // naik turun teratur = klasik malaria

  // Risk classification
  const isHigh =
    hasDangerSign ||
    (rdtPositive && input.is_pregnant) ||
    (rdtPositive && input.is_under5 && hasSymptoms);

  const isMedium = !isHigh && (
    rdtPositive ||
    (isEndemic && input.fever_days >= 2 && hasSymptoms && noRdt)
  );

  const riskLevel = isHigh ? 'HIGH' : isMedium ? 'MEDIUM' : 'LOW';
  const referNow = isHigh;
  const followUpDays = isHigh ? 0 : isMedium ? 1 : 7;

  // Build report
  const lines: string[] = [
    '📋 LAPORAN SKRINING MALARIA — SahAIbat Kader',
    '',
    '👤 DATA PASIEN',
    `Nama: ${input.patientName}`,
    `Usia: ${input.age_years} tahun`,
    `Jenis kelamin: ${input.gender === 'male' ? 'Laki-laki' : 'Perempuan'}`,
    input.is_pregnant ? '🤰 Ibu hamil' : '',
    input.is_under5 ? '👶 Anak di bawah 5 tahun' : '',
    '',
    '📍 STATUS WILAYAH',
    input.endemic_area === '1' ? '🔴 Tinggal di daerah endemis malaria'
      : input.endemic_area === '2' ? '🟡 Baru kembali dari daerah endemis (<4 minggu)'
      : '🟢 Bukan daerah endemis',
    '',
    '🌡️ GEJALA',
    `Demam: ${input.fever_days} hari`,
    `Pola demam: ${input.fever_pattern === '1' ? 'Terus-menerus' : input.fever_pattern === '2' ? 'Naik turun teratur (khas malaria)' : 'Tidak teratur'}`,
  ].filter(Boolean);

  if (input.symptoms.length > 0) {
    lines.push('Gejala lain:');
    const symptomLabels: Record<string, string> = {
      'menggigil': 'Menggigil / keringat dingin',
      'sakit_kepala': 'Sakit kepala hebat',
      'mual': 'Mual / muntah',
      'nyeri_otot': 'Nyeri otot / sendi',
    };
    input.symptoms.forEach(sym => lines.push(`• ${symptomLabels[sym] ?? sym}`));
  } else {
    lines.push('Gejala lain: Tidak ada');
  }

  // Danger signs
  if (hasDangerSign) {
    lines.push('');
    lines.push('🚨 TANDA BAHAYA:');
    const dangerLabels: Record<string, string> = {
      'kesadaran': 'Kesadaran menurun / bingung',
      'kejang': 'Kejang',
      'lemas': 'Sangat lemas, tidak bisa duduk',
      'kuning': 'Kuning pada mata / kulit',
      'kencing_sedikit': 'Kencing sangat sedikit / gelap',
      'sesak': 'Sesak napas',
    };
    input.danger_signs.forEach(d => lines.push(`• ${dangerLabels[d] ?? d}`));
  }

  // RDT result
  lines.push('');
  lines.push('🔬 HASIL TES');
  if (rdtPositive) {
    lines.push('🔴 RDT: POSITIF MALARIA');
  } else if (rdtNegative) {
    lines.push('🟢 RDT: Negatif');
  } else {
    lines.push('⚪ RDT: Belum dilakukan');
  }

  // Risk banner
  lines.push('');
  if (riskLevel === 'HIGH') {
    lines.push('🔴 MALARIA BERAT / DARURAT — Rujuk ke RS/Puskesmas SEGERA');
  } else if (riskLevel === 'MEDIUM') {
    lines.push('🟡 SUSPEK MALARIA — Rujuk ke Puskesmas untuk pengobatan');
  } else {
    lines.push('🟢 RISIKO RENDAH — Pantau gejala');
  }

  // Tindak lanjut
  lines.push('');
  lines.push('✅ TINDAK LANJUT');
  if (riskLevel === 'HIGH') {
    lines.push('1. Bawa ke Puskesmas/RS SEGERA — jangan tunda');
    lines.push('2. Jika kejang: miringkan badan, jangan masukkan apapun ke mulut');
    lines.push('3. Berikan minum jika sadar');
    if (input.is_pregnant) {
      lines.push('4. ⚠️ HAMIL + MALARIA = sangat berbahaya — perlu penanganan khusus');
    }
  } else if (riskLevel === 'MEDIUM') {
    lines.push('1. Kunjungi Puskesmas hari ini atau besok pagi');
    if (noRdt) {
      lines.push('2. Lakukan tes RDT atau pemeriksaan darah di Puskesmas');
    }
    lines.push('3. Minum air putih banyak — jaga cairan tubuh');
    lines.push('4. Kompres hangat jika demam tinggi');
    lines.push('5. Jika memburuk (tanda bahaya muncul) → langsung ke IGD');
  } else {
    if (noRdt && isEndemic) {
      lines.push('1. Lakukan tes RDT jika demam berlanjut >3 hari');
    }
    lines.push('2. Pantau suhu badan setiap 6 jam');
    lines.push('3. Minum air putih cukup');
    lines.push('4. Jika gejala memburuk → ke Puskesmas');
  }
  
// Paparan asap
  if (input.paparan_asap) {
    lines.push('');
    lines.push('🌋 PAPARAN ASAP GUNUNG BERAPI / KEBAKARAN');
    lines.push('• Asap memperburuk gejala pernapasan bersamaan malaria');
    lines.push('• Gunakan masker saat keluar rumah');
    lines.push('• Hindari aktivitas luar saat asap tebal');
    lines.push('• Cuci muka & hidung setelah dari luar');
  }
  
  // Prevention
  lines.push('');
  lines.push('🛡️ PENCEGAHAN MALARIA');
  lines.push('• Tidur pakai kelambu berinsektisida (LLIN) setiap malam');
  lines.push('• Gunakan obat nyamuk / repellent');
  lines.push('• Pakai baju lengan panjang sore-malam hari');
  lines.push('• Bersihkan genangan air di sekitar rumah');
  lines.push('• Pasang kawat kasa di jendela dan ventilasi');

  // Danger sign watchlist
  lines.push('');
  lines.push('⚠️ TANDA BAHAYA — segera ke IGD jika:');
  lines.push('• Kesadaran menurun atau bingung');
  lines.push('• Kejang');
  lines.push('• Tidak bisa minum / muntah terus');
  lines.push('• Sesak napas');
  lines.push('• Kencing sangat sedikit atau gelap');

  lines.push('');
  if (chwName) lines.push(`Kader: ${chwName}`);
  lines.push('Bukan diagnosis. SahAIbat Kader v1.');

  return { riskLevel, referNow, followUpDays, reportText: lines.join('\n') };
}
