import TimeAgo from 'javascript-time-ago';

import en from 'javascript-time-ago/locale/en';
TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo('en-US');

export const getFormattedTimeAgo = (date: Date): string => {
  return timeAgo.format(date);
};
