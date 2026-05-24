// lib/produktifLansiaEngine.ts
// Offline usia produktif (18–59) & lansia (60+) triage engine.
// Covers Kemenkes Group 5: deteksi dini PTM, TB, PPOK, kesehatan jiwa, geriatri, KB.
// Deterministic, zero AI, fully offline.

import { generateIsiPiringku } from './counselling/isiPiringku';
import { runIspaScreen, type IspaInput } from './ispaScreen';

export interface ProduktifLansiaInput {
  patientName: string;
  nik: string;
  age_years: number;
  gender: 'male' | 'female';
  weight_kg: number;
  height_cm: number;
  waist_cm: number | null;
  bp_sys: number | null;
  bp_dia: number | null;
  gds: number | null;               // gula darah sewaktu mg/dL
  smoking: '1' | '2' | '3';         // 1=ya, 2=pernah, 3=tidak
  activity: '1' | '2' | '3';        // 1=150min/wk, 2=kadang, 3=jarang
  eating: '1' | '2' | '3';          // 1=isi piringku, 2=kadang, 3=tidak
  // KB — WUS only (women 15–49)
  kb_status: '1' | '2' | '3' | null; // 1=ya, 2=tidak tapi ingin, 3=tidak perlu; null=not asked
  // TB screening
  tb_cough_2wk: boolean;
  tb_night_sweats: boolean;
  tb_weight_loss: boolean;
  // PPOK
  ppok_chronic_cough: boolean;       // batuk berdahak ≥3 bulan dalam 2 tahun berturut
  // Mental health (simplified SRQ)
  mh_sleep_difficulty: boolean;      // sulit tidur
  mh_sad_hopeless: boolean;          // sedih/putus asa
  mh_lost_interest: boolean;         // hilang minat
  // Geriatri (lansia ≥60 only)
  geriatri_adl: '1' | '2' | '3' | null;  // 1=mandiri, 2=perlu bantuan sebagian, 3=sangat tergantung
  geriatri_memory: '1' | '2' | '3' | null; // 1=baik, 2=kadang lupa, 3=sering lupa/bingung
  // ISPA / respiratory screening
  ispa_batuk: 'kering' | 'berdahak' | 'tidak';
  ispa_sesak: boolean;
  ispa_mata: boolean;
  ispa_paparan: boolean;
  ispa_durasi: number | null;
}

export interface ProduktifLansiaResult {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  bmi: number;
  bmiCategory: 'underweight' | 'normal' | 'overweight' | 'obese';
  bpCategory: 'crisis' | 'hypertension_2' | 'hypertension_1' | 'elevated' | 'normal' | 'not_measured';
  gdsCategory: 'diabetes' | 'prediabetes' | 'normal' | 'not_measured';
  waistFlag: 'obesitas_sentral' | 'normal' | 'not_measured';
  tbSuspect: boolean;
  ppokSuspect: boolean;
  mhFlag: boolean;
  geriatriFlag: boolean;
  referNow: boolean;
  followUpDays: number;
  reportText: string;
  isLansia: boolean;
  ispaRisk: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

function classifyBMI(bmi: number): 'underweight' | 'normal' | 'overweight' | 'obese' {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

function classifyBP(sys: number | null, dia: number | null): 'crisis' | 'hypertension_2' | 'hypertension_1' | 'elevated' | 'normal' | 'not_measured' {
  if (sys == null || dia == null) return 'not_measured';
  if (sys >= 180 || dia >= 120) return 'crisis';
  if (sys >= 160 || dia >= 100) return 'hypertension_2';
  if (sys >= 140 || dia >= 90) return 'hypertension_1';
  if (sys >= 120 || dia >= 80) return 'elevated';
  return 'normal';
}

function classifyGDS(gds: number | null): 'diabetes' | 'prediabetes' | 'normal' | 'not_measured' {
  if (gds == null) return 'not_measured';
  if (gds >= 200) return 'diabetes';
  if (gds >= 140) return 'prediabetes';
  return 'normal';
}

function classifyWaist(waistCm: number | null, gender: 'male' | 'female'): 'obesitas_sentral' | 'normal' | 'not_measured' {
  if (waistCm == null) return 'not_measured';
  return waistCm > (gender === 'male' ? 90 : 80) ? 'obesitas_sentral' : 'normal';
}

export function runProduktifLansiaTriage(input: ProduktifLansiaInput, chwName?: string): ProduktifLansiaResult {
  const isLansia = input.age_years >= 60;
  const bmi = input.weight_kg / ((input.height_cm / 100) ** 2);
  const bmiCat = classifyBMI(bmi);
  const bpCat = classifyBP(input.bp_sys, input.bp_dia);
  const gdsCat = classifyGDS(input.gds);
  const waistFlag = classifyWaist(input.waist_cm, input.gender);

  const tbSuspect = input.tb_cough_2wk && (input.tb_night_sweats || input.tb_weight_loss);
  const ppokSuspect = input.ppok_chronic_cough;
  const mhPositiveCount = [input.mh_sleep_difficulty, input.mh_sad_hopeless, input.mh_lost_interest].filter(Boolean).length;
  const mhFlag = mhPositiveCount >= 2;

  const geriatriFlag = isLansia && (
    input.geriatri_adl === '3' ||
    input.geriatri_memory === '3'
  );

  // Risk
  const isHigh =
    bpCat === 'crisis' ||
    gdsCat === 'diabetes' && (input.gds ?? 0) >= 300 ||
    tbSuspect ||
    geriatriFlag;

  const isMedium = !isHigh && (
    bpCat === 'hypertension_2' || bpCat === 'hypertension_1' ||
    gdsCat === 'diabetes' || gdsCat === 'prediabetes' ||
    bmiCat === 'obese' ||
    waistFlag === 'obesitas_sentral' ||
    ppokSuspect ||
    mhFlag ||
    (isLansia && input.geriatri_adl === '2')
  );

// ISPA screening
  const ispaResult = runIspaScreen(
    { batuk: input.ispa_batuk, sesakNapas: input.ispa_sesak, mataPerih: input.ispa_mata, paparanAsap: input.ispa_paparan, durasiHari: input.ispa_durasi },
    { isChild: false, isPregnant: false, isElderly: isLansia }
  );

  const riskLevel = (isHigh || ispaResult.referNow) ? 'HIGH' : (isMedium || ispaResult.ispaRisk === 'MEDIUM') ? 'MEDIUM' : 'LOW';
  const referNow = isHigh || ispaResult.referNow;
  const followUpDays = isHigh ? 0 : isMedium ? 14 : 90;

  // Report
  const sasaranLabel = isLansia ? 'LANJUT USIA' : 'USIA PRODUKTIF';
  const lines: string[] = [
    `📋 LAPORAN SKRINING — ${sasaranLabel}`,
    '',
    '👤 DATA',
    `Nama: ${input.patientName}`,
    `Usia: ${input.age_years} tahun${isLansia ? ' (Lansia)' : ''}`,
    `Jenis kelamin: ${input.gender === 'male' ? 'Laki-laki' : 'Perempuan'}`,
    '',
    '📏 HASIL PENGUKURAN',
    `Berat badan: ${input.weight_kg} kg`,
    `Tinggi badan: ${input.height_cm} cm`,
    `IMT (BMI): ${bmi.toFixed(1)} kg/m²`,
  ];

  // BMI classification
  const bmiEmoji = bmiCat === 'underweight' ? '🟡' : bmiCat === 'normal' ? '🟢' : bmiCat === 'overweight' ? '🟡' : '🔴';
  const bmiText = bmiCat === 'underweight' ? 'Kurang' : bmiCat === 'normal' ? 'Normal' : bmiCat === 'overweight' ? 'Gemuk' : 'Obesitas';
  lines.push(`${bmiEmoji} Status gizi: ${bmiText}`);

  if (input.waist_cm != null) {
    lines.push(`Lingkar perut: ${input.waist_cm} cm${waistFlag === 'obesitas_sentral' ? ' — ⚠️ Obesitas sentral' : ' — Normal'}`);
  }
  if (input.bp_sys != null && input.bp_dia != null) {
    const bpEmoji = bpCat === 'crisis' || bpCat === 'hypertension_2' ? '🔴' : bpCat === 'hypertension_1' ? '🟠' : bpCat === 'elevated' ? '🟡' : '🟢';
    const bpText = bpCat === 'crisis' ? 'KRISIS HIPERTENSI' : bpCat === 'hypertension_2' ? 'Hipertensi derajat 2' : bpCat === 'hypertension_1' ? 'Hipertensi derajat 1' : bpCat === 'elevated' ? 'Meningkat' : 'Normal';
    lines.push(`Tekanan darah: ${input.bp_sys}/${input.bp_dia} mmHg ${bpEmoji} ${bpText}`);
  }
  if (input.gds != null) {
    const gdsEmoji = gdsCat === 'diabetes' ? '🔴' : gdsCat === 'prediabetes' ? '🟡' : '🟢';
    const gdsText = gdsCat === 'diabetes' ? 'Diabetes' : gdsCat === 'prediabetes' ? 'Prediabetes' : 'Normal';
    lines.push(`Gula darah sewaktu: ${input.gds} mg/dL ${gdsEmoji} ${gdsText}`);
  }

  // Risk banner
  lines.push('');
  if (riskLevel === 'HIGH') {
    lines.push('🔴 RISIKO TINGGI — Rujuk ke Puskesmas SEGERA');
  } else if (riskLevel === 'MEDIUM') {
    lines.push('🟡 PERLU PERHATIAN — Kunjungi Puskesmas untuk pemeriksaan lanjut');
  } else {
    lines.push('🟢 SEHAT — Lanjutkan pola hidup sehat');
  }

  // Deteksi dini PTM
  lines.push('');
  lines.push('🔍 DETEKSI DINI');
  if (bpCat !== 'normal' && bpCat !== 'not_measured') {
    lines.push(`• Hipertensi: ${bpCat === 'crisis' ? 'KRISIS — segera ke IGD' : 'Perlu pengobatan rutin'}`);
  }
  if (gdsCat === 'diabetes') {
    lines.push('• Diabetes: Gula darah tinggi — perlu pengobatan');
  } else if (gdsCat === 'prediabetes') {
    lines.push('• Prediabetes: Gula darah mulai tinggi — ubah pola makan & aktivitas');
  }
  if (bmiCat === 'obese' || waistFlag === 'obesitas_sentral') {
    lines.push('• Obesitas: Risiko penyakit jantung, stroke, diabetes meningkat');
  }

  // TB
  if (tbSuspect) {
    lines.push('');
    lines.push('🫁 SUSPEK TBC');
    lines.push('• Batuk >2 minggu + keringat malam/berat turun');
    lines.push('• WAJIB rujuk ke Puskesmas untuk pemeriksaan dahak');
    lines.push('• Jangan tunda — TBC bisa disembuhkan jika diobati tuntas');
  }

  // PPOK
  if (ppokSuspect) {
    lines.push('');
    lines.push('🫁 SUSPEK PPOK');
    lines.push('• Batuk berdahak kronik — kemungkinan PPOK');
    lines.push('• Rujuk ke Puskesmas untuk pemeriksaan spirometri');
  }

  // Mental health
  if (mhFlag) {
    lines.push('');
    lines.push('🧠 KESEHATAN JIWA');
    lines.push('• Ditemukan tanda gangguan kesehatan jiwa');
    lines.push('• Rujuk ke Puskesmas untuk konseling');
    lines.push('• Dukungan keluarga sangat penting');
  }

  // Geriatri (lansia only)
  if (isLansia) {
    lines.push('');
    lines.push('👴 SKRINING GERIATRI');
    if (input.geriatri_adl === '1') {
      lines.push('✅ Kemandirian: Mandiri penuh');
    } else if (input.geriatri_adl === '2') {
      lines.push('⚠️ Kemandirian: Perlu bantuan sebagian — pantau rutin');
    } else if (input.geriatri_adl === '3') {
      lines.push('🔴 Kemandirian: Sangat tergantung — perlu pendampingan intensif');
    }
    if (input.geriatri_memory === '1') {
      lines.push('✅ Daya ingat: Baik');
    } else if (input.geriatri_memory === '2') {
      lines.push('⚠️ Daya ingat: Kadang lupa — pantau perkembangan');
    } else if (input.geriatri_memory === '3') {
      lines.push('🔴 Daya ingat: Sering lupa/bingung — rujuk untuk evaluasi demensia');
    }
  }

  // KB (WUS only)
  if (input.kb_status) {
    lines.push('');
    lines.push('💑 KELUARGA BERENCANA');
    if (input.kb_status === '1') {
      lines.push('✅ Menggunakan kontrasepsi — lanjutkan sesuai anjuran');
    } else if (input.kb_status === '2') {
      lines.push('⚠️ Belum menggunakan KB tapi ingin — rujuk ke Puskesmas/bidan');
      lines.push('• Konsultasi jenis KB yang sesuai (pil, suntik, IUD, implan)');
    } else {
      lines.push('ℹ️ Tidak memerlukan KB saat ini');
    }
  }

  // Smoking
  if (input.smoking === '1') {
    lines.push('');
    lines.push('🚬 MEROKOK — BERBAHAYA');
    lines.push('• Risiko kanker paru, jantung, stroke sangat tinggi');
    lines.push('• Asap rokok juga membahayakan keluarga (perokok pasif)');
    lines.push('• Berhenti merokok sekarang — minta bantuan di Puskesmas');
  }

  // Tindak lanjut
  lines.push('');
  lines.push('✅ TINDAK LANJUT');
  if (riskLevel === 'HIGH') {
    lines.push('• Rujuk ke Puskesmas SEGERA');
    if (bpCat === 'crisis') lines.push('• Krisis hipertensi — perlu penanganan darurat');
    if (tbSuspect) lines.push('• Pemeriksaan dahak untuk TBC');
    if (geriatriFlag) lines.push('• Evaluasi geriatri komprehensif');
  } else if (riskLevel === 'MEDIUM') {
    lines.push('• Kunjungi Puskesmas dalam 2 minggu');
    lines.push('• Perbaiki pola makan dan tingkatkan aktivitas fisik');
    if (bpCat === 'hypertension_1' || bpCat === 'hypertension_2') lines.push('• Kurangi garam, cek tekanan darah rutin');
    if (gdsCat !== 'normal' && gdsCat !== 'not_measured') lines.push('• Kurangi gula, cek gula darah rutin');
  } else {
    lines.push('• Pertahankan gaya hidup sehat');
    lines.push('• Cek kesehatan rutin setiap 3 bulan di Posyandu');
  }

  // Isi Piringku
  const nutritionSection = generateIsiPiringku({
    sasaranType: isLansia ? 'lansia' : 'produktif',
  });
  if (nutritionSection) {
    lines.push('');
    lines.push(nutritionSection);
  }

  lines.push('');
  if (chwName) lines.push(`Kader: ${chwName}`);
  // ISPA report
  if (ispaResult.reportSection) {
    lines.push('');
    lines.push(ispaResult.reportSection);
  }

  lines.push('Bukan diagnosis. SahAIbat Kader v1.');

  return {
    riskLevel, bmi, bmiCategory: bmiCat, bpCategory: bpCat,
    gdsCategory: gdsCat, waistFlag, tbSuspect, ppokSuspect,
    mhFlag, geriatriFlag, referNow, followUpDays, isLansia,
   reportText: lines.join('\n'),
    ispaRisk: ispaResult.ispaRisk,
  };
}
