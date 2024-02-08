const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;

export function relativeTime(locale: string | undefined, date: Date, compareDate?: Date, dayRange: number = 7) {
  compareDate ??= new Date();
  const compareDay = new Date(compareDate.getFullYear(), compareDate.getMonth(), compareDate.getDate());
  const msDiff = date.valueOf() - compareDate.valueOf();

  const isToday = date.toDateString() === compareDate.toDateString();
  const isWithinDays =
    date.valueOf() > (compareDay.valueOf() - DAY_MS * dayRange) && date.valueOf() < (compareDay.valueOf() + DAY_MS * dayRange);

  if (!isToday && isWithinDays) {
    const dayDiff = Math.round(msDiff / DAY_MS);
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(dayDiff, "days");
  } else if (isToday) {
    return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
  } else {
    return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(date);
  }
}
