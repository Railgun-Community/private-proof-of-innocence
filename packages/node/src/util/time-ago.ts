import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';
import { currentTimestampSec, validateTimestamp } from './timestamp';

TimeAgo.addDefaultLocale(en);

const timeAgo = new TimeAgo('en-US');

export const getFormattedTimeAgo = (date: Date): string => {
  return timeAgo.format(date);
};

export const daysAgo = (days: number) => {
  return hoursAgo(24 * days);
};

export const hoursAgo = (hours: number) => {
  return minutesAgo(60 * hours);
};

export const minutesAgo = (minutes: number) => {
  return validateTimestamp(currentTimestampSec() - minutes * 60);
};
