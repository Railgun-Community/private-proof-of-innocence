const latest = new Date('Jan 1, 2040').getTime() / 1000;

export const validateTimestamp = (timestamp: number) => {
  if (timestamp > latest) {
    throw new Error('Timestamp is not in seconds.');
  }
  return timestamp;
};

export const currentTimestampSec = () => {
  return Date.now() / 1000;
};
