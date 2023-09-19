export const getLastRefreshedTimeText = (date: Date) => {
  const currentDate = new Date();
  const timeDifferenceInSeconds = Math.floor(
    (currentDate.getTime() - date.getTime()) / 1000,
  );

  const minutes = Math.floor(timeDifferenceInSeconds / 60);
  if (minutes < 60) {
    return `Last refreshed ${minutes} ${
      minutes === 1 ? 'minute' : 'minutes'
    } ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Last refreshed ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  const days = Math.floor(hours / 24);
  return `Last refreshed ${days} ${days === 1 ? 'day' : 'days'} ago`;
};
