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

async function reqBinary(path) {
  const res = await fetch(API + path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(err.error || res.statusText);
    error.status = res.status;
    throw error;
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function uploadReq(method, path, body, headers = {}) {
  const res = await fetch(API + path, { method, headers, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(err.error || res.statusText);
    error.status = res.status;
    error.received = err.received;
    throw error;
  }
  return res.json();
}

function archiveCreds(session) {
  return session
    ? `?username=${encodeURIComponent(session.username)}&keyId=${encodeURIComponent(session.keyId || "")}`
    : "";
}

export const IDB = {
  // Archives
  add: (data) => req("POST", "/archives", data),
  getAll: () => req("GET", "/archives"),
  get: (id, session) => req("GET", `/archives/${id}${archiveCreds(session)}`),
  del: (id, username) => req("DELETE", `/archives/${id}`, { username }),
  restore: (id, username) => req("POST", `/archives/${id}/restore`, { username }),
  purge: (id, username) => req("DELETE", `/archives/${id}/permanent`, { username }),
  count: async () => {
    const all = await req("GET", "/archives?meta=1&includeTrash=1");
    return all.length;
  },
  listMeta: (params = {}) => {
    const qs = new URLSearchParams({ meta: "1" });
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    return req("GET", "/archives?" + qs.toString());
  },
  pageMeta: (params = {}) => {
    const qs = new URLSearchParams({ meta: "1", page: "1", limit: "25" });
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    return req("GET", "/archives?" + qs.toString());
  },
  trashMeta: (username) => req(
    "GET",
    `/archives?meta=1&trash=1&scope=owner&username=${encodeURIComponent(username)}`
  ),
  getMeta: (id) => req("GET", `/archives/${id}?meta=1`),
  fileData: async (id, idx, session) =>
    reqBinary(`/archives/${id}/files/${idx}${archiveCreds(session)}`),
  update: (id, patch, session) => req(
    "PATCH",
    `/archives/${id}`,
    { ...patch, actor: session?.username, actorKeyId: session?.keyId }
  ),

  byOwner: async (owner) => {
    const all = await req("GET", "/archives?meta=1&username=" + encodeURIComponent(owner) + "&scope=accessible");
    return all;
  },

  getAllMeta: async () => IDB.metaOf(await req("GET", "/archives?meta=1")),

  metaOf: (all) =>
    all.map(a => ({
      id: a.id,
      archiveId: a.archiveId,
      title: a.title,
      date: a.date,
      category: a.category,
      status: a.status,
      tags: a.tags,
      author: a.author,
      location: a.location,
      description: a.description,
      owner: a.owner,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      deletedAt: a.deletedAt || null,
      sharedWith: a.sharedWith || [],
      fileCount: (a.files || []).length,
      totalSize: (a.files || []).reduce((s, f) => s + (f.size || 0), 0),
    })),

  // Users
  getUser: (username) => req("GET", `/users/${encodeURIComponent(username)}`).catch(() => null),
  addUser: (data) => req("POST", "/users", data),
  getAllUsers: () => req("GET", "/users"),
  updateUser: (username, patch) => req("POST", "/profile", { username, ...patch }),

  // Resumable encrypted uploads
  startUpload: (meta) => req("POST", "/uploads", meta),
  uploadStatus: (uploadId) => req("GET", `/uploads/${uploadId}`),
  uploadChunk: (uploadId, offset, chunk) =>
    uploadReq("PUT", `/uploads/${uploadId}`, chunk, {
      "Content-Type": "application/octet-stream",
      "X-Upload-Offset": String(offset),
    }),
  cancelUpload: (uploadId) => req("DELETE", `/uploads/${uploadId}`),

  // Storage
  storage: () => req("GET", "/storage"),

  // Inbox
  addInbox: (data) => req("POST", "/inbox", data),
  getInbox: (recipient) => req("GET", `/inbox?recipient=${encodeURIComponent(recipient)}`),
  delInbox: (id) => req("DELETE", `/inbox/${id}`),
  markRead: (id) => req("PATCH", `/inbox/${id}/read`),

  // Audit log
  addAudit: (data) => req("POST", "/audit", data),
  getAudit: (username, limit = 200) =>
    req("GET", `/audit?username=${encodeURIComponent(username)}&limit=${limit}`),
};
