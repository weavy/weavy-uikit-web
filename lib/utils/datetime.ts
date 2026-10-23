const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function relativeDays(locale: string | undefined, date: Date, compareDate?: Date, dayRange: number = 7) {
  compareDate ??= new Date();
  const compareDay = new Date(compareDate.getFullYear(), compareDate.getMonth(), compareDate.getDate());
  const msDiff = date.valueOf() - compareDate.valueOf();

  const isToday = date.toDateString() === compareDate.toDateString();
  const isWithinDays =
    date.valueOf() > (compareDay.valueOf() - DAY * dayRange) && date.valueOf() < (compareDay.valueOf() + DAY * dayRange);

  if (!isToday && isWithinDays) {
    const dayDiff = Math.round(msDiff / DAY);
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(dayDiff, "days");
  } else if (isToday) {
    return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
  } else {
    return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(date);
  }
}

export function passedTime(locale: string | undefined, date: Date, compareDate?: Date, style: Intl.RelativeTimeFormatStyle | undefined = undefined, minMS: number = 1 * MINUTE, maxMS: number = Infinity) {
  compareDate ??= new Date();

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style });
  const msDiff = date.valueOf() - compareDate.valueOf();
  const unit = determineUnit(msDiff);

  const unitDiff = toUnit(msDiff, unit)
  const isToday = date.toDateString() === compareDate.toDateString();

  if (Math.abs(msDiff) < minMS) {
    // a moment ago: "0 second" -> "now"
    return rtf.format(0, unit);
  } else if(Math.abs(msDiff) < maxMS) {
    return rtf.format(unitDiff, unit);
  } else if (isToday) {
    return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
  } else {
    return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(date);
  }
}

function determineUnit(ms: number): Intl.RelativeTimeFormatUnit {
	ms = Math.abs(ms);
	if(ms < MINUTE) return 'second';
	if(ms < HOUR) return 'minute';
	if(ms < DAY) return 'hour';
	if(ms < WEEK) return 'day';
	if(ms < MONTH) return 'week';
	if(ms < YEAR) return 'month';
	return 'year';
}

function toUnit(ms: number, unit: Intl.RelativeTimeFormatUnit): number {
	if(unit === 'second') return Math.round(ms / SECOND);
	if(unit === 'minute') return Math.round(ms / MINUTE);
	if(unit === 'hour') return Math.round(ms / HOUR);
	if(unit === 'day') return Math.round(ms / DAY);
	if(unit === 'week') return Math.round(ms / WEEK);
	if(unit === 'month') return Math.round(ms / MONTH);
	if(unit === 'year') return Math.round(ms / YEAR);
  throw new Error("No valid unit provided.");
}