export function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat('en-CM', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

// Business calendar: the shop operates in Yaoundé, Cameroon
// (IANA zone Africa/Douala, UTC+1). Report dates are business-calendar
// dates, so "today" and date validation must use this zone — not the
// browser's zone and not the UTC calendar.
export const BUSINESS_TZ = 'Africa/Douala';

// Build 'YYYY-MM-DD' explicitly from Intl formatToParts with zero-padding,
// so the string shape never depends on a locale's default output format.
function businessIsoDate(date: Date): string {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const { type, value } of dtf.formatToParts(date)) {
    parts[type] = value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function businessToday(): string {
  return businessIsoDate(new Date());
}

export function businessDaysAgo(days: number): string {
  const [y, m, d] = businessToday().split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d - days));
  return shifted.toISOString().slice(0, 10);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format a DailyReport.reportDate (stored as UTC midnight of the business
// calendar date). Format the ISO calendar-date portion directly — parsing
// it through the browser's timezone would shift the visible day for any
// user west of UTC.
export function formatReportDate(dateString: string): string {
  const isoDate = dateString.slice(0, 10);
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatSaleId(id: number): string {
  return `#${id.toString().padStart(5, '0')}`;
}

export function saleStatusBadge(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'badge-success';
    case 'cancelled':
      return 'badge-danger';
    default:
      return 'badge-gray';
  }
}
