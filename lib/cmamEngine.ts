// lib/cmamEngine.ts
// Deterministic CMAM follow-up engine — Feature 2
// Based on WHO CMAM Protocol 2013 + Indonesia Permenkes No.29/2019
//
// ZERO AI cost. Works fully offline.
// Called from childTracker.ts when SAM is detected.
// Identical logic used in sahaibat-kader PWA.

// ─── Types ────────────────────────────────────────────────────────────────────

export type CmamStatus =
  | 'active'          // currently in CMAM treatment
  | 'recovered'       // MUAC ≥ 12.5 for 2 consecutive weeks + no oedema
  | 'defaulted'       // missed 2+ consecutive weekly checks
  | 'non_responder'   // no weight gain after 4 weeks
  | 'deteriorating';  // MUAC dropped during treatment → escalate to hospital

export interface CmamWeeklyCheck {
  week: number;
  date: string;          // ISO date
  muac_cm: number;
  weight_kg: number;
  kader_id: string;
  oedema: boolean;
  notes?: string;
}

export interface CmamAdmissionData {
  childId: string;
  ngoId: string;
  kaderId: string;
  admissionVisitId: string;
  admissionDate: string;
  admissionMuacCm: number | null;
  admissionSeverity: string;
}

export interface CmamEpisodeState {
  id: string;
  status: CmamStatus;
  admissionDate: string;
  admissionMuacCm: number | null;
  puskesmasConfirmed: boolean;
  rutfProvided: boolean | null;
  weeklyChecks: CmamWeeklyCheck[];
  consecutiveNormalWeeks: number;
}

export interface CmamAssessmentResult {
  newStatus: CmamStatus;
  message: string;          // plain Bahasa for Kader
  coordinatorAlert: boolean;
  actionRequired: string;
  dischargeable: boolean;
}

// ─── WHO CMAM Thresholds ─────────────────────────────────────────────────────
// Source: WHO 2013 CMAM guidelines + Permenkes No.29/2019

const CMAM = {
  DISCHARGE_MUAC_CM:        12.5,  // MUAC threshold for discharge
  DISCHARGE_WEEKS_NEEDED:   2,     // consecutive weeks above threshold
  MAX_TREATMENT_WEEKS:      8,     // flag non-responder after 8 weeks
  DEFAULTER_MISSED_WEEKS:   2,     // flag defaulter after 2 missed weekly checks
  DETERIORATION_THRESHOLD:  0.3,   // MUAC drop > 0.3cm = deteriorating
} as const;

// ─── Core Assessment ─────────────────────────────────────────────────────────

export function assessCmamProgress(
  episode: CmamEpisodeState,
  latestCheck: CmamWeeklyCheck
): CmamAssessmentResult {

  const checks = [...episode.weeklyChecks, latestCheck]
    .sort((a, b) => a.week - b.week);

  const weekNumber = latestCheck.week;
  const currentMuac = latestCheck.muac_cm;

  // ── DETERIORATING: MUAC dropped during treatment ─────────────
  if (checks.length >= 2) {
    const prevCheck = checks[checks.length - 2];
    const muacDrop = prevCheck.muac_cm - currentMuac;
    if (muacDrop >= CMAM.DETERIORATION_THRESHOLD) {
      return {
        newStatus: 'deteriorating',
        message: `🚨 MEMBURUK: LILA turun dari ${prevCheck.muac_cm}cm menjadi ${currentMuac}cm. Rujuk ke RUMAH SAKIT segera.`,
        coordinatorAlert: true,
        actionRequired: 'Rujuk ke Rumah Sakit segera — kondisi memburuk selama pengobatan.',
        dischargeable: false,
      };
    }
  }

  // ── RECOVERED: MUAC ≥ 12.5 for 2 consecutive weeks ──────────
  const aboveThreshold = checks
    .slice(-CMAM.DISCHARGE_WEEKS_NEEDED)
    .every(c => c.muac_cm >= CMAM.DISCHARGE_MUAC_CM && !c.oedema);

  if (aboveThreshold && checks.length >= CMAM.DISCHARGE_WEEKS_NEEDED) {
    return {
      newStatus: 'recovered',
      message: `✅ SEMBUH: LILA ${currentMuac}cm — di atas ${CMAM.DISCHARGE_MUAC_CM}cm selama 2 minggu berturut-turut. Anak bisa keluar dari program CMAM.`,
      coordinatorAlert: true,
      actionRequired: `Anak dapat di-discharge dari CMAM. Lanjutkan pemantauan bulanan rutin selama 6 bulan.`,
      dischargeable: true,
    };
  }

  // ── NON-RESPONDER: no improvement after 4+ weeks ─────────────
  if (weekNumber >= CMAM.MAX_TREATMENT_WEEKS / 2) {
    const allChecks = checks.slice(0, 4);
    const noProgress = allChecks.length >= 4 &&
      allChecks[allChecks.length - 1].muac_cm <= allChecks[0].muac_cm + 0.2;

    if (noProgress) {
      return {
        newStatus: 'non_responder',
        message: `⚠️ TIDAK ADA KEMAJUAN: LILA tidak naik setelah ${weekNumber} minggu pengobatan. Perlu evaluasi dokter.`,
        coordinatorAlert: true,
        actionRequired: 'Konsultasi ke dokter Puskesmas — kemungkinan ada penyakit penyerta (infeksi, TB).',
        dischargeable: false,
      };
    }
  }

  // ── ACTIVE: still in treatment, progressing ──────────────────
  const remaining = CMAM.MAX_TREATMENT_WEEKS - weekNumber;
  const muacNeeded = CMAM.DISCHARGE_MUAC_CM - currentMuac;

  return {
    newStatus: 'active',
    message: `🟡 Pengobatan minggu ${weekNumber}: LILA ${currentMuac}cm. Perlu ${muacNeeded > 0 ? `naik ${muacNeeded.toFixed(1)}cm lagi` : 'pertahankan'} untuk sembuh.`,
    coordinatorAlert: false,
    actionRequired: `Lanjutkan RUTF dan pantau minggu depan. ${remaining} minggu tersisa dalam program.`,
    dischargeable: false,
  };
}

// ─── CMAM Puskesmas Confirmation Question ────────────────────────────────────
// Added to WhatsApp + PWA flow after SAM detection
// One extra question only — for SAM cases

export function buildCmamConfirmationQuestion(
  childName: string,
  lang: 'id' | 'en' = 'id'
): string {
  if (lang === 'id') {
    return (
      `⚠️ *Tindak Lanjut Gizi Buruk (SAM)*\n\n` +
      `Anak *${childName}* terdeteksi gizi buruk akut (SAM).\n\n` +
      `Apakah anak sudah dibawa ke Puskesmas?\n\n` +
      `1️⃣ = Sudah ke Puskesmas\n` +
      `2️⃣ = Belum — akan segera dibawa\n` +
      `3️⃣ = Orang tua menolak\n\n` +
      `Ketik 1, 2, atau 3`
    );
  }
  return (
    `⚠️ *SAM Follow-up Required*\n\n` +
    `Child *${childName}* was detected with severe acute malnutrition (SAM).\n\n` +
    `Has the child been taken to the Puskesmas?\n\n` +
    `1 = Yes, already visited Puskesmas\n` +
    `2 = Not yet — will go soon\n` +
    `3 = Parent refused\n\n` +
    `Type 1, 2, or 3`
  );
}

// ─── CMAM Puskesmas Confirmation Response ────────────────────────────────────

export function buildCmamConfirmationResponse(
  answer: '1' | '2' | '3',
  childName: string,
  lang: 'id' | 'en' = 'id'
): { message: string; puskesmasConfirmed: boolean; coordinatorAlert: boolean } {
  if (answer === '1') {
    return {
      message: lang === 'id'
        ? `✅ Baik, terima kasih. Pantau berat badan dan LILA *${childName}* setiap minggu.\n\nKader akan menerima pengingat kunjungan mingguan.`
        : `✅ Thank you. Monitor *${childName}*'s weight and MUAC weekly.\n\nYou will receive weekly visit reminders.`,
      puskesmasConfirmed: true,
      coordinatorAlert: false,
    };
  }

  if (answer === '2') {
    return {
      message: lang === 'id'
        ? `⚠️ Mohon bawa *${childName}* ke Puskesmas secepatnya.\n\nGizi buruk memerlukan penanganan medis — jangan tunda lebih dari 24 jam.\n\nKoordinator sudah diberitahu.`
        : `⚠️ Please take *${childName}* to the Puskesmas as soon as possible.\n\nSAM requires medical treatment — do not delay more than 24 hours.\n\nYour coordinator has been notified.`,
      puskesmasConfirmed: false,
      coordinatorAlert: true,
    };
  }

  // answer === '3' — parent refused
  return {
    message: lang === 'id'
      ? `📋 Dicatat. Mohon jelaskan kepada orang tua bahwa gizi buruk *sangat berbahaya* dan memerlukan pengobatan segera.\n\nKoordinator akan menghubungi untuk membantu.\n\nCatat alasan penolakan di buku Posyandu.`
      : `📋 Noted. Please explain to the parents that SAM is *life-threatening* and requires immediate treatment.\n\nYour coordinator will follow up.\n\nRecord the refusal reason in your Posyandu book.`,
    puskesmasConfirmed: false,
    coordinatorAlert: true,
  };
}

// ─── CMAM Weekly Check Question ───────────────────────────────────────────────
// For follow-up visits of active CMAM cases

export function buildCmamWeeklyQuestion(
  childName: string,
  weekNumber: number,
  lastMuac: number | null,
  lang: 'id' | 'en' = 'id'
): string {
  const lastStr = lastMuac ? ` (minggu lalu: ${lastMuac}cm)` : '';
  if (lang === 'id') {
    return (
      `📋 *Pemantauan CMAM — Minggu ${weekNumber}*\n\n` +
      `Anak: *${childName}*\n\n` +
      `Masukkan ukuran LILA hari ini (cm)${lastStr}:\n` +
      `Contoh: 11.8\n\n` +
      `Ketik SKIP jika tidak diukur hari ini`
    );
  }
  return (
    `📋 *CMAM Follow-up — Week ${weekNumber}*\n\n` +
    `Child: *${childName}*\n\n` +
    `Enter today's MUAC measurement (cm)${lastStr}:\n` +
    `Example: 11.8\n\n` +
    `Type SKIP if not measured today`
  );
}

// ─── CMAM Status Badge for UI ─────────────────────────────────────────────────

export interface CmamBadge {
  label: string;
  emoji: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export function getCmamBadge(status: CmamStatus | null): CmamBadge | null {
  if (!status) return null;

  const badges: Record<CmamStatus, CmamBadge> = {
    active: {
      label: 'CMAM Aktif', emoji: '🏥',
      colorClass: 'text-blue-700', bgClass: 'bg-blue-50', borderClass: 'border-blue-200',
    },
    recovered: {
      label: 'Sembuh', emoji: '✅',
      colorClass: 'text-green-700', bgClass: 'bg-green-50', borderClass: 'border-green-200',
    },
    defaulted: {
      label: 'Mangkir', emoji: '⚠️',
      colorClass: 'text-orange-700', bgClass: 'bg-orange-50', borderClass: 'border-orange-200',
    },
    non_responder: {
      label: 'Tidak Respons', emoji: '🔴',
      colorClass: 'text-red-700', bgClass: 'bg-red-50', borderClass: 'border-red-200',
    },
    deteriorating: {
      label: 'Memburuk', emoji: '🚨',
      colorClass: 'text-red-800', bgClass: 'bg-red-100', borderClass: 'border-red-400',
    },
  };

  return badges[status] ?? null;
}

// ─── Check if child should be in CMAM ────────────────────────────────────────

export function shouldStartCmam(
  muacCm: number | null,
  wlzCategory: string | null,
  wazCategory: string | null
): boolean {
  // WHO SAM criteria: MUAC < 11.5cm OR WLZ < -3 SD OR bilateral oedema
  if (muacCm != null && muacCm < 11.5) return true;
  if (wlzCategory === 'severely_wasted') return true;
  if (wazCategory === 'severely_underweight') return true;
  return false;
}

// ─── Calculate weeks since admission ─────────────────────────────────────────

export function weeksSinceAdmission(admissionDate: string): number {
  const admission = new Date(admissionDate);
  const today = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((today.getTime() - admission.getTime()) / msPerWeek);
}
