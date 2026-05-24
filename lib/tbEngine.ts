// lib/tbEngine.ts
// Offline TB screening engine for SahAIbat Kader PWA.
// Kemenkes P2 TB guidelines + WHO TB screening recommendations.
// Covers: symptom screening, treatment adherence, MDR-TB flag, contact tracing.
// Deterministic, zero AI, fully offline.

export interface TBInput {
  patientName: string;
  age_years: number;
  gender: 'male' | 'female';
  // Symptom screening
  cough_2wk: boolean;               // batuk ≥2 minggu
  cough_blood: boolean;             // batuk darah
  night_sweats: boolean;            // keringat malam
  weight_loss: boolean;             // berat badan turun tanpa sebab
  fever_2wk: boolean;               // demam ≥2 minggu
  fatigue: boolean;                 // lemas terus-menerus
  // Risk factors
  hiv_positive: boolean;
  diabetes: boolean;
  smoking: boolean;
  close_contact: boolean;            // kontak serumah dengan pasien TB
  // Treatment status
  treatment_status: '1' | '2' | '3' | '4'; // 1=belum pernah, 2=sedang OAT, 3=pernah selesai, 4=pernah tidak selesai
  // If on OAT (status=2)
  oat_month: number | null;          // bulan ke berapa
  oat_adherence: '1' | '2' | '3' | null; // 1=rutin, 2=kadang lupa, 3=sering lupa/berhenti
  oat_side_effects: string[];        // array of: 'mual', 'kuning', 'gatal', 'gangguan_penglihatan', 'kesemutan'
  // Contact tracing
  household_contacts: number | null;  // jumlah orang serumah
  household_children_u5: number | null; // anak <5 tahun serumah
 household_cough: boolean;          // ada orang serumah batuk lama
  paparan_asap: boolean;             // tinggal dekat gunung berapi / kebakaran hutan
}

export interface TBResult {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  tbSuspect: boolean;
  mdrFlag: boolean;
  referNow: boolean;
  followUpDays: number;
  reportText: string;
}

export function runTBTriage(input: TBInput, chwName?: string): TBResult {
  const symptomCount = [input.cough_2wk, input.cough_blood, input.night_sweats,
    input.weight_loss, input.fever_2wk, input.fatigue].filter(Boolean).length;

  const tbSuspect = input.cough_2wk && symptomCount >= 2;
  const mdrFlag = input.treatment_status === '4'; // pernah tidak selesai = risiko MDR

  const hasRiskFactor = input.hiv_positive || input.diabetes || input.smoking || input.close_contact;
  const hasDangerSign = input.cough_blood;
  const oatProblem = input.oat_adherence === '3' || input.oat_side_effects.includes('kuning') || input.oat_side_effects.includes('gangguan_penglihatan');

  // Risk classification
  const isHigh =
    hasDangerSign ||
    (tbSuspect && input.hiv_positive) ||
    oatProblem ||
    (mdrFlag && symptomCount >= 1);

  const isMedium = !isHigh && (
    tbSuspect ||
    (input.cough_2wk && hasRiskFactor) ||
    input.oat_adherence === '2' ||
    (input.close_contact && symptomCount >= 1)
  );

  const riskLevel = isHigh ? 'HIGH' : isMedium ? 'MEDIUM' : 'LOW';
  const referNow = isHigh;
  const followUpDays = isHigh ? 0 : isMedium ? 1 : 14;

  // Build report
  const lines: string[] = [
    '📋 LAPORAN SKRINING TBC — SahAIbat Kader',
    '',
    '👤 DATA PASIEN',
    `Nama: ${input.patientName}`,
    `Usia: ${input.age_years} tahun`,
    `Jenis kelamin: ${input.gender === 'male' ? 'Laki-laki' : 'Perempuan'}`,
    '',
  ];

  // Symptom summary
  lines.push('🫁 GEJALA TBC');
  const symptomsFound: string[] = [];
  if (input.cough_2wk) symptomsFound.push('Batuk ≥2 minggu');
  if (input.cough_blood) symptomsFound.push('Batuk darah');
  if (input.night_sweats) symptomsFound.push('Keringat malam');
  if (input.weight_loss) symptomsFound.push('Berat badan turun tanpa sebab');
  if (input.fever_2wk) symptomsFound.push('Demam ≥2 minggu');
  if (input.fatigue) symptomsFound.push('Lemas terus-menerus');

  if (symptomsFound.length > 0) {
    symptomsFound.forEach(sy => lines.push(`• ${sy}`));
  } else {
    lines.push('✅ Tidak ada gejala TBC saat ini');
  }

  // Risk factors
  const riskFactors: string[] = [];
  if (input.hiv_positive) riskFactors.push('HIV positif');
  if (input.diabetes) riskFactors.push('Diabetes');
  if (input.smoking) riskFactors.push('Merokok');
  if (input.close_contact) riskFactors.push('Kontak serumah dengan pasien TB');

  if (riskFactors.length > 0) {
    lines.push('');
    lines.push('⚠️ FAKTOR RISIKO');
    riskFactors.forEach(rf => lines.push(`• ${rf}`));
  }

  // Treatment status
  lines.push('');
  lines.push('💊 STATUS PENGOBATAN');
  if (input.treatment_status === '1') {
    lines.push('ℹ️ Belum pernah pengobatan TB');
  } else if (input.treatment_status === '2') {
    lines.push(`📋 Sedang dalam pengobatan OAT — bulan ke-${input.oat_month ?? '?'}`);
    if (input.oat_adherence === '1') {
      lines.push('✅ Minum obat rutin — pertahankan!');
    } else if (input.oat_adherence === '2') {
      lines.push('⚠️ Kadang lupa minum obat — PERLU DITINGKATKAN');
      lines.push('• TB hanya bisa sembuh jika OAT diminum LENGKAP 6 bulan');
      lines.push('• Gunakan alarm HP sebagai pengingat');
      lines.push('• Minta PMO (Pengawas Menelan Obat) di keluarga');
    } else if (input.oat_adherence === '3') {
      lines.push('🔴 Sering lupa / berhenti minum obat — BAHAYA!');
      lines.push('• TB yang tidak diobati tuntas bisa menjadi KEBAL OBAT (MDR-TB)');
      lines.push('• MDR-TB pengobatannya lebih lama (18-20 bulan) dan lebih berat');
      lines.push('• SEGERA kembali ke Puskesmas — JANGAN berhenti sendiri');
    }

    if (input.oat_side_effects.length > 0) {
      lines.push('');
      lines.push('💊 EFEK SAMPING OAT');
      const sideLabels: Record<string, string> = {
        'mual': '🤢 Mual — minum obat sesudah makan, jangan perut kosong',
        'kuning': '🟡 KUNING pada mata/kulit — SEGERA ke Puskesmas! (hepatotoksik)',
        'gatal': '😣 Gatal-gatal — laporkan ke Puskesmas saat kontrol',
        'gangguan_penglihatan': '👁️ Gangguan penglihatan — SEGERA ke Puskesmas! (ethambutol)',
        'kesemutan': '🖐️ Kesemutan tangan/kaki — laporkan ke dokter saat kontrol',
      };
      input.oat_side_effects.forEach(se => lines.push(sideLabels[se] ?? `• ${se}`));
    }
  } else if (input.treatment_status === '3') {
    lines.push('✅ Pernah pengobatan TB — sudah selesai');
  } else if (input.treatment_status === '4') {
    lines.push('🔴 Pernah pengobatan TB — TIDAK SELESAI');
    lines.push('• RISIKO TB KEBAL OBAT (MDR-TB) tinggi');
    lines.push('• Jika ada gejala TBC — SEGERA ke Puskesmas untuk pemeriksaan ulang');
  }

  // MDR flag
  if (mdrFlag && symptomCount >= 1) {
    lines.push('');
    lines.push('🚨 PERINGATAN MDR-TB');
    lines.push('• Pasien pernah tidak menyelesaikan pengobatan TB');
    lines.push('• Gejala TB muncul kembali — kemungkinan TB kebal obat');
    lines.push('• WAJIB rujuk ke Puskesmas untuk tes GeneXpert');
  }

  // Risk banner
  lines.push('');
  if (riskLevel === 'HIGH') {
    lines.push('🔴 RISIKO TINGGI — Rujuk ke Puskesmas SEGERA');
  } else if (riskLevel === 'MEDIUM') {
    lines.push('🟡 SUSPEK TBC — Rujuk ke Puskesmas untuk pemeriksaan dahak');
  } else {
    lines.push('🟢 RISIKO RENDAH — Pantau gejala');
  }

  // Contact tracing
  if (tbSuspect || input.treatment_status === '2') {
    lines.push('');
    lines.push('👨‍👩‍👧‍👦 INVESTIGASI KONTAK');
    if (input.household_contacts != null) {
      lines.push(`Jumlah orang serumah: ${input.household_contacts}`);
    }
    if (input.household_children_u5 != null && input.household_children_u5 > 0) {
      lines.push(`⚠️ Anak di bawah 5 tahun serumah: ${input.household_children_u5}`);
      lines.push('• Anak <5 tahun WAJIB diperiksa TB dan diberi pengobatan pencegahan (PP INH)');
      lines.push('• Bawa ke Puskesmas untuk evaluasi');
    }
    if (input.household_cough) {
      lines.push('⚠️ Ada orang serumah batuk lama — kemungkinan sumber penularan');
      lines.push('• Semua orang serumah perlu skrining TB di Puskesmas');
    }
    lines.push('');
    lines.push('🏠 PENCEGAHAN PENULARAN');
    lines.push('• Tutup mulut saat batuk (etika batuk)');
    lines.push('• Buka jendela — ventilasi yang baik mengurangi penularan');
    lines.push('• Jemur kasur dan bantal secara rutin');
    lines.push('• Jangan berbagi alat makan');
    if (input.treatment_status === '2') {
      lines.push('• Setelah 2 minggu OAT rutin, risiko penularan sudah berkurang');
    }
  }

  // Tindak lanjut
  lines.push('');
  lines.push('✅ TINDAK LANJUT');
  if (riskLevel === 'HIGH') {
    lines.push('• SEGERA ke Puskesmas — hari ini');
    if (hasDangerSign) lines.push('• Batuk darah — perlu penanganan segera');
    if (oatProblem) lines.push('• Efek samping serius OAT — perlu evaluasi dokter');
    if (mdrFlag) lines.push('• Kemungkinan MDR-TB — perlu tes GeneXpert');
  } else if (riskLevel === 'MEDIUM') {
    lines.push('• Kunjungi Puskesmas besok pagi');
    lines.push('• Pemeriksaan dahak (BTA/TCM) diperlukan');
    lines.push('• Bawa sputum (dahak pagi) dalam wadah tertutup');
  } else {
    if (input.close_contact) {
      lines.push('• Kontak serumah dengan TB — pantau gejala selama 2 tahun');
    }
    lines.push('• Jika batuk >2 minggu muncul → segera ke Puskesmas');
  }

// Paparan asap
  if (input.paparan_asap) {
    lines.push('');
    lines.push('🌋 PAPARAN ASAP GUNUNG BERAPI / KEBAKARAN');
    lines.push('• Asap dan abu vulkanik memperburuk gejala TBC');
    lines.push('• Gunakan masker (N95 jika ada) saat keluar rumah');
    lines.push('• Hindari aktivitas luar saat asap tebal');
    lines.push('• Tutup jendela/pintu, cuci muka & hidung setelah dari luar');
    lines.push('• Minum air putih cukup — jaga saluran napas lembab');
  }

  lines.push('');
  if (chwName) lines.push(`Kader: ${chwName}`);
  lines.push('Bukan diagnosis. SahAIbat Kader v1.');

  return { riskLevel, tbSuspect, mdrFlag, referNow, followUpDays, reportText: lines.join('\n') };
}
