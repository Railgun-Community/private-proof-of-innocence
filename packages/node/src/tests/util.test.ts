export const daysAgo = (days: number) => {
  return Date.now() - days * 24 * 60 * 60 * 1000;
};
