// lib/businessTime.js
// Business-calendar timezone helpers.
//
// The shop operates in Yaoundé, Cameroon: IANA zone `Africa/Douala`
// (UTC+1, no daylight saving). A "business day" for date YYYY-MM-DD is the
// local calendar day in that zone, expressed as a half-open UTC interval:
//   [ start of local midnight, start of next local midnight )
//
// Implemented with Intl.DateTimeFormat only (Node 24 full-ICU) — no date
// library added. Offsets are derived from the IANA zone database, not
// hard-coded, so this stays correct if the zone rules ever change.

const BUSINESS_TZ = 'Africa/Douala';

// Offset (ms east of UTC) of BUSINESS_TZ at the given instant.
function timeZoneOffsetMs(dateMs) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = {};
  for (const { type, value } of dtf.formatToParts(new Date(dateMs))) {
    parts[type] = value;
  }
  // hour can be "24" for midnight under hour12:false in some ICU versions
  const hour = Number(parts.hour) % 24;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - dateMs;
}

// UTC instant of local midnight (00:00) in BUSINESS_TZ for the given
// business-calendar date (year, month[1-12], day). Two-pass offset
// correction handles DST transitions (Douala currently has none).
function businessMidnightUtc(year, month, day) {
  const wallAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const offset1 = timeZoneOffsetMs(wallAsUtc);
  let instant = wallAsUtc - offset1;
  const offset2 = timeZoneOffsetMs(instant);
  if (offset2 !== offset1) {
    instant = wallAsUtc - offset2;
  }
  return new Date(instant);
}

// Accepts 'YYYY-MM-DD' strings or Date objects (a Date's UTC calendar date
// is used). Returns { year, month, day } or null when unparseable.
function toBusinessDateParts(input) {
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return {
      year: input.getUTCFullYear(),
      month: input.getUTCMonth() + 1,
      day: input.getUTCDate(),
    };
  }
  if (typeof input === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
    if (!m) {
      // Also accept full ISO strings from Date-like inputs
      const d = new Date(input);
      if (!isNaN(d.getTime())) {
        return {
          year: d.getUTCFullYear(),
          month: d.getUTCMonth() + 1,
          day: d.getUTCDate(),
        };
      }
      return null;
    }
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    // Reject impossible calendar dates (e.g. 2026-02-30)
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (
      probe.getUTCFullYear() !== year ||
      probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day
    ) {
      return null;
    }
    return { year, month, day };
  }
  return null;
}

// Half-open UTC interval [start, end) covering the given business day,
// plus the storage instant for DailyReport.reportDate (UTC midnight of the
// calendar date — unchanged from the pre-timezone-fix convention, so the
// unique constraint and existing rows remain valid).
function businessDayBounds(input) {
  const parts = toBusinessDateParts(input);
  if (!parts) return null;
  const { year, month, day } = parts;
  const start = businessMidnightUtc(year, month, day);
  // Next calendar day (UTC date arithmetic on the wall date is safe)
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const end = businessMidnightUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  const storageDate = new Date(Date.UTC(year, month - 1, day));
  return { start, end, storageDate, year, month, day };
}

// 'YYYY-MM-DD' of "now" in the business timezone. Constructed explicitly
// from formatToParts with zero-padding — never relies on a locale's default
// string shape (e.g. en-CA) producing ISO format.
function todayBusinessDate() {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = {};
  for (const { type, value } of dtf.formatToParts(new Date())) {
    parts[type] = value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

module.exports = {
  BUSINESS_TZ,
  timeZoneOffsetMs,
  businessMidnightUtc,
  toBusinessDateParts,
  businessDayBounds,
  todayBusinessDate,
};
