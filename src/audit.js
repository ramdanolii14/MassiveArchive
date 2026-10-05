import { IDB } from "./database.js";

export function logAudit(session, action, details = {}) {
  if (!session?.username) return;
  IDB.addAudit({
    username: session.username,
    action,
    details,
    at: new Date().toISOString(),
  }).catch(() => {});
}
