import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';

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
  return Date.now() - minutes * 60 * 1000;
};
