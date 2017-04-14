import moment from 'moment';

export default function isAfterDay(a, b) {
  if (!moment.isMoment(a) || !moment.isMoment(b)) return false;

  const isSameYear = a.year() === b.year();
  const isSameMonth = a.month() === b.month();

  if (isSameYear && isSameMonth) return a.date() > b.date();
  if (isSameYear) return a.month() > b.month();
  return a.year() > b.year();
}
