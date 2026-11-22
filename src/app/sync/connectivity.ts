export type Connectivity = 'online' | 'offline' | 'unknown';

export function getConnectivity(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): Connectivity {
  if (state.isConnected === false || state.isInternetReachable === false) {
    return 'offline';
  }
  if (state.isConnected === true && state.isInternetReachable === true) {
    return 'online';
  }
  return 'unknown';
}
