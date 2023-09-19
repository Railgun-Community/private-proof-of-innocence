export const shortenWalletAddress = (address: string): string => {
  if (address.length < 13) {
    return address;
  }
  // 12 chars separated by '...'
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
};

//TODO: this is shared
