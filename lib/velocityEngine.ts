// lib/services/velocityEngine.ts
// Deterministic growth velocity engine — Feature 1
// Based on WHO MGRS (Multicentre Growth Reference Study) velocity thresholds
// and IMAM (Integrated Management of Acute Malnutrition) guidelines.
//
// ZERO AI cost. Works fully offline.
// Called from childTracker.ts after every growth visit.
// Identical logic used in sahaibat-kader PWA.

// ─── Types ────────────────────────────────────────────────────────────────────

export type VelocityFlag =
  | 'first_visit'       // no previous data to compare
  | 'stable'            // no significant change
  | 'recovering'        // z-score improving after SAM/MAM
  | 'declining'         // 1 visit decline, moderate
  | 'rapid_decline'     // single-visit drop ≥ 0.5 SD
  | 'trend_declining'   // 2 consecutive declining visits
  | 'trend_severe'      // 3+ consecutive declining visits OR declining while in SAM zone
  | 'critical';         // declining while already SAM — immediate action

export interface VelocityResult {
  flag: VelocityFlag;
  deltaWaz: number | null;        // z-score change (current - previous)
  deltaWeightKg: number | null;   // weight change in kg
  consecutiveDeclines: number;    // how many visits in a row declining
  message: string;                // plain Bahasa Indonesia for Kader
  coordinatorAlert: boolean;      // should coordinator be notified?
  actionRequired: 'none' | 'monitor' | 'urgent' | 'immediate';
}

export interface PreviousVisitData {
  weight_kg: number;
  waz_numeric?: number | null;    // numeric z-score if available
  severity: string;               // 'sam' | 'mam' | 'at_risk' | 'normal'
  visit_date: string;
}

export interface CurrentVisitData {
  weight_kg: number;
  waz_numeric?: number | null;
  severity: string;
  age_months: number;
}

// ─── WHO Velocity Thresholds ──────────────────────────────────────────────────
// Source: WHO MGRS Cohort Study — velocity standards for weight-for-age z-score
// These are conservative thresholds validated for Indonesian context

const THRESHOLDS = {
  RAPID_DECLINE_WAZ:    -0.5,   // single visit: >0.5 SD drop = immediate concern
  MODERATE_DECLINE_WAZ: -0.25,  // single visit: 0.25–0.5 SD drop = watch closely
  RECOVERY_WAZ:         +0.3,   // single visit: >0.3 SD gain after SAM/MAM = recovering
  MIN_WEIGHT_GAIN_GRAMS: 0,     // any weight loss between visits = flag
} as const;

// ─── WAZ string to approximate numeric mapping ───────────────────────────────
// Used when exact z-score not stored (converts WHO category to midpoint estimate)
// This is conservative — actual z-score always preferred when available

const WAZ_MIDPOINT: Record<string, number> = {
  severely_underweight: -3.5,
  underweight:          -2.5,
  normal:                0.0,
  overweight:           +2.5,
};

function wazNumeric(
  wazCategory: string,
  exactZScore?: number | null
): number | null {
  if (exactZScore != null && !isNaN(exactZScore)) return exactZScore;
  return WAZ_MIDPOINT[wazCategory] ?? null;
}

// ─── Severity rank (for comparing improvement/decline) ───────────────────────
const SEVERITY_RANK: Record<string, number> = {
  normal:   0,
  at_risk:  1,
  mam:      2,
  sam:      3,
};

function severityRank(s: string): number {
  return SEVERITY_RANK[s] ?? 0;
}

// ─── Core Velocity Computation ────────────────────────────────────────────────

export function computeVelocity(
  current: CurrentVisitData,
  previous: PreviousVisitData | null,
  consecutiveDeclinesBefore: number = 0
): VelocityResult {

  // No previous visit — first time we've seen this child
  if (!previous) {
    return {
      flag: 'first_visit',
      deltaWaz: null,
      deltaWeightKg: null,
      consecutiveDeclines: 0,
      message: 'Kunjungan pertama — data awal tercatat.',
      coordinatorAlert: false,
      actionRequired: 'none',
    };
  }

  const prevWaz = wazNumeric(previous.severity, previous.waz_numeric);
  const currWaz = wazNumeric(current.severity, current.waz_numeric);
  const deltaWaz = (prevWaz != null && currWaz != null) ? currWaz - prevWaz : null;
  const deltaWeight = current.weight_kg - previous.weight_kg;
  const prevSeverityRank = severityRank(previous.severity);
  const currSeverityRank = severityRank(current.severity);

  // ── CRITICAL: declining while already SAM ────────────────────
  if (current.severity === 'sam' && deltaWeight < 0) {
    return {
      flag: 'critical',
      deltaWaz,
      deltaWeightKg: deltaWeight,
      consecutiveDeclines: consecutiveDeclinesBefore + 1,
      message: `⚠️ KRITIS: Berat badan anak turun saat kondisi sudah gizi buruk (SAM). Rujuk ke Puskesmas HARI INI.`,
      coordinatorAlert: true,
      actionRequired: 'immediate',
    };
  }

  // ── RECOVERING: improving after SAM/MAM ──────────────────────
  if (
    prevSeverityRank >= 2 &&                    // was SAM or MAM
    currSeverityRank < prevSeverityRank &&       // improved category
    deltaWeight > 0
  ) {
    return {
      flag: 'recovering',
      deltaWaz,
      deltaWeightKg: deltaWeight,
      consecutiveDeclines: 0,                   // reset counter on recovery
      message: `✅ Tren membaik — berat badan anak naik dari ${previous.weight_kg}kg menjadi ${current.weight_kg}kg. Pantau terus.`,
      coordinatorAlert: false,
      actionRequired: 'monitor',
    };
  }

  // ── RAPID DECLINE: single visit >0.5 SD drop ─────────────────
  if (deltaWaz != null && deltaWaz <= THRESHOLDS.RAPID_DECLINE_WAZ) {
    const newConsecutive = consecutiveDeclinesBefore + 1;
    return {
      flag: 'rapid_decline',
      deltaWaz,
      deltaWeightKg: deltaWeight,
      consecutiveDeclines: newConsecutive,
      message: `⚠️ Penurunan berat badan signifikan dalam 1 kunjungan. Perlu perhatian segera.`,
      coordinatorAlert: true,
      actionRequired: 'urgent',
    };
  }

  // ── TREND SEVERE: 3+ consecutive declines ────────────────────
  if (deltaWeight < 0 && consecutiveDeclinesBefore >= 2) {
    const newConsecutive = consecutiveDeclinesBefore + 1;
    return {
      flag: 'trend_severe',
      deltaWaz,
      deltaWeightKg: deltaWeight,
      consecutiveDeclines: newConsecutive,
      message: `⚠️ Berat badan anak terus turun ${newConsecutive} kunjungan berturut-turut. Koordinator diberitahu.`,
      coordinatorAlert: true,
      actionRequired: 'urgent',
    };
  }

  // ── TREND DECLINING: 2 consecutive declines ──────────────────
  if (deltaWeight < 0 && consecutiveDeclinesBefore >= 1) {
    const newConsecutive = consecutiveDeclinesBefore + 1;
    return {
      flag: 'trend_declining',
      deltaWaz,
      deltaWeightKg: deltaWeight,
      consecutiveDeclines: newConsecutive,
      message: `🟡 Berat badan anak turun 2 kunjungan berturut-turut. Pantau lebih sering.`,
      coordinatorAlert: false,
      actionRequired: 'monitor',
    };
  }

  // ── DECLINING: single visit weight loss ──────────────────────
  if (deltaWeight < THRESHOLDS.MIN_WEIGHT_GAIN_GRAMS) {
    return {
      flag: 'declining',
      deltaWaz,
      deltaWeightKg: deltaWeight,
      consecutiveDeclines: consecutiveDeclinesBefore + 1,
      message: `🟡 Berat badan sedikit turun dari ${previous.weight_kg}kg menjadi ${current.weight_kg}kg. Perhatikan pola makan.`,
      coordinatorAlert: false,
      actionRequired: 'monitor',
    };
  }

  // ── STABLE: no significant change ────────────────────────────
  return {
    flag: 'stable',
    deltaWaz,
    deltaWeightKg: deltaWeight,
    consecutiveDeclines: 0,
    message: `✅ Pertumbuhan stabil — tidak ada penurunan berat badan.`,
    coordinatorAlert: false,
    actionRequired: 'none',
  };
}

// ─── Velocity Badge for UI ────────────────────────────────────────────────────
// Returns display properties for AnakTab.tsx and PWA result screen

export interface VelocityBadge {
  label: string;
  emoji: string;
  colorClass: string;        // Tailwind classes
  bgClass: string;
  borderClass: string;
  showInList: boolean;       // show on child list card
  showInResult: boolean;     // show on triage result screen
}

export function getVelocityBadge(flag: VelocityFlag | null): VelocityBadge | null {
  if (!flag || flag === 'first_visit' || flag === 'stable') return null;

  const badges: Record<VelocityFlag, VelocityBadge> = {
    first_visit: {
      label: 'Kunjungan pertama', emoji: '📝',
      colorClass: 'text-gray-600', bgClass: 'bg-gray-50',
      borderClass: 'border-gray-200', showInList: false, showInResult: false,
    },
    stable: {
      label: 'Stabil', emoji: '✅',
      colorClass: 'text-green-700', bgClass: 'bg-green-50',
      borderClass: 'border-green-200', showInList: false, showInResult: false,
    },
    recovering: {
      label: 'Membaik', emoji: '📈',
      colorClass: 'text-green-700', bgClass: 'bg-green-50',
      borderClass: 'border-green-200', showInList: true, showInResult: true,
    },
    declining: {
      label: 'Berat turun', emoji: '📉',
      colorClass: 'text-yellow-700', bgClass: 'bg-yellow-50',
      borderClass: 'border-yellow-200', showInList: true, showInResult: true,
    },
    rapid_decline: {
      label: 'Turun signifikan', emoji: '⚠️',
      colorClass: 'text-orange-700', bgClass: 'bg-orange-50',
      borderClass: 'border-orange-200', showInList: true, showInResult: true,
    },
    trend_declining: {
      label: 'Tren turun', emoji: '⬇️',
      colorClass: 'text-orange-700', bgClass: 'bg-orange-50',
      borderClass: 'border-orange-200', showInList: true, showInResult: true,
    },
    trend_severe: {
      label: 'Tren turun parah', emoji: '🔻',
      colorClass: 'text-red-700', bgClass: 'bg-red-50',
      borderClass: 'border-red-200', showInList: true, showInResult: true,
    },
    critical: {
      label: 'KRITIS', emoji: '🚨',
      colorClass: 'text-red-800', bgClass: 'bg-red-100',
      borderClass: 'border-red-400', showInList: true, showInResult: true,
    },
  };

  return badges[flag] ?? null;
}

// ─── Velocity message for WhatsApp triage output ──────────────────────────────
// Appended to buildGrowthOutput() in growth.ts

export function buildVelocitySection(result: VelocityResult): string {
  if (result.flag === 'first_visit' || result.flag === 'stable') return '';

  const lines: string[] = ['', '📊 TREN PERTUMBUHAN'];

  lines.push(result.message);

  if (result.deltaWeightKg != null) {
    const sign = result.deltaWeightKg >= 0 ? '+' : '';
    lines.push(`Perubahan berat: ${sign}${result.deltaWeightKg.toFixed(2)} kg dari kunjungan terakhir`);
  }

  if (result.consecutiveDeclines >= 2) {
    lines.push(`Penurunan berturut-turut: ${result.consecutiveDeclines} kunjungan`);
  }

  if (result.actionRequired === 'immediate') {
    lines.push('🚨 TINDAKAN: Bawa ke Puskesmas HARI INI.');
  } else if (result.actionRequired === 'urgent') {
    lines.push('⚠️ TINDAKAN: Jadwalkan kunjungan Puskesmas minggu ini.');
  } else if (result.actionRequired === 'monitor') {
    lines.push('📋 TINDAKAN: Pantau berat badan lebih sering (2 minggu sekali).');
  }

  return lines.join('\n');
}
