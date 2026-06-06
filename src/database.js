// ════════════════════════════════════════════════════════════════
// DATABASE LAYER — fetch ke Express backend
// ════════════════════════════════════════════════════════════════

const API = "/api";

async function req(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const IDB = {
  // ── Archives ──────────────────────────────────────────────
  add:    (data)      => req("POST",   "/archives",       data),
  getAll: ()          => req("GET",    "/archives"),
  get:    (id)        => req("GET",    `/archives/${id}`),
  del:    (id)        => req("DELETE", `/archives/${id}`),
  count:  async ()    => { const all = await req("GET", "/archives"); return all.length; },
  update: (id, patch) => req("PATCH",  `/archives/${id}`, patch),

  byOwner: async (owner) => {
    const all = await req("GET", "/archives");
    return all.filter(a => a.owner === owner || (a.sharedWith || []).includes(owner));
  },

  getAllMeta: async () => {
    const all = await req("GET", "/archives");
    return all.map(a => ({
      id:          a.id,
      archiveId:   a.archiveId,
      title:       a.title,
      date:        a.date,
      category:    a.category,
      status:      a.status,
      tags:        a.tags,
      author:      a.author,
      location:    a.location,
      description: a.description,
      owner:       a.owner,
      createdAt:   a.createdAt,
      updatedAt:   a.updatedAt,
      sharedWith:  a.sharedWith || [],
      fileCount:   (a.files || []).length,
      totalSize:   (a.files || []).reduce((s, f) => s + f.size, 0),
    }));
  },

  // ── Users ─────────────────────────────────────────────────
  getUser:    (username) => req("GET",  `/users/${username}`).catch(() => null),
  addUser:    (data)     => req("POST", "/users", data),
  getAllUsers: ()        => req("GET",  "/users"),

  // ── Inbox ─────────────────────────────────────────────────
  addInbox:   (data)      => req("POST",   "/inbox",           data),
  getInbox:   (recipient) => req("GET",    `/inbox?recipient=${recipient}`),
  delInbox:   (id)        => req("DELETE", `/inbox/${id}`),
  markRead:   (id)        => req("PATCH",  `/inbox/${id}/read`),
};