// Server-rendered timestamps would otherwise come out in the server's
// timezone (UTC on Azure). APP_TIME_ZONE pins them to the campus's zone.
const TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Kolkata";

export function formatDateTime(d: Date): string {
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
}
