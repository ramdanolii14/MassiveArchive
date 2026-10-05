// DATABASE LAYER - fetch ke Express backend

const API = "/api";

async function req(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(err.error || res.statusText);
    error.status = res.status;
    throw error;
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
  count:  async ()    => { const all = await req("GET", "/archives?meta=1"); return all.length; },
  listMeta: ()        => req("GET",    "/archives?meta=1"),
  getMeta:  (id)      => req("GET",    `/archives/${id}?meta=1`),
  fileData: async (id, idx) => (await req("GET", `/archives/${id}/files/${idx}`)).encData,
  update: (id, patch) => req("PATCH",  `/archives/${id}`, patch),

  byOwner: async (owner) => {
    const all = await req("GET", "/archives?meta=1");
    return all.filter(a => a.owner === owner || (a.sharedWith || []).includes(owner));
  },

  getAllMeta: async () => IDB.metaOf(await req("GET", "/archives?meta=1")),

  metaOf: (all) =>
    all.map(a => ({
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
    })),

  // ── Users ─────────────────────────────────────────────────
  getUser:    (username) => req("GET",  `/users/${encodeURIComponent(username)}`).catch(() => null),
  addUser:    (data)     => req("POST", "/users", data),
  getAllUsers: ()        => req("GET",  "/users"),
  updateUser: async (username, patch) => {
    const encoded = encodeURIComponent(username);
    try {
      return await req("PATCH", `/users/${encoded}`, patch);
    } catch (e) {
      if (e.status === 404 || e.status === 405) {
        return req("POST", `/users/${encoded}/update`, patch);
      }
      throw e;
    }
  },

  // ── Storage ───────────────────────────────────────────────
  storage:    ()          => req("GET", "/storage"),

  // ── Inbox ─────────────────────────────────────────────────
  addInbox:   (data)      => req("POST",   "/inbox",           data),
  getInbox:   (recipient) => req("GET",    `/inbox?recipient=${encodeURIComponent(recipient)}`),
  delInbox:   (id)        => req("DELETE", `/inbox/${id}`),
  markRead:   (id)        => req("PATCH",  `/inbox/${id}/read`),
};