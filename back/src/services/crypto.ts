export function maskSecret(secret: string): string {
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 7)}••••••••${secret.slice(-4)}`;
}
