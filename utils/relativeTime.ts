// Native Date math. No date library — too heavy for two helpers.

export function formatRelativeTime(isoString: string): string {
  try {
    const then = new Date(isoString).getTime();
    const now = Date.now();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMs < 60000) return 'just now';
    if (diffMin < 60) return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
    if (diffHr < 24) return diffHr === 1 ? '1 hour ago' : `${diffHr} hours ago`;
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    if (diffDay < 14) return 'last week';
    if (diffDay < 30) return `${Math.floor(diffDay / 7)} weeks ago`;
    if (diffDay < 60) return 'last month';
    return `${Math.floor(diffDay / 30)} months ago`;
  } catch {
    return 'recently';
  }
}

export function isWithinLastMinutes(isoString: string, minutes: number): boolean {
  try {
    const then = new Date(isoString).getTime();
    const now = Date.now();
    return now - then <= minutes * 60000;
  } catch {
    return false;
  }
}
