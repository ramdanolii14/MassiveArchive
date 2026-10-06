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

export const IDB = {
  // Archives
  add: (data) => req("POST", "/archives", data),
  getAll: () => req("GET", "/archives"),
  get: (id) => req("GET", `/archives/${id}`),
  del: (id) => req("DELETE", `/archives/${id}`),
  restore: (id) => req("POST", `/archives/${id}/restore`),
  purge: (id) => req("DELETE", `/archives/${id}/permanent`),
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
  fileData: async (id, idx, _session, purpose = "view") =>
    reqBinary(`/archives/${id}/files/${idx}?purpose=${encodeURIComponent(purpose)}`),
  update: (id, patch) => req("PATCH", `/archives/${id}`, patch),

  byOwner: async () => {
    return req("GET", "/archives?meta=1&scope=owner");
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

  // Authentication
  login: (username, passHash) => req("POST", "/auth/login", { username, passHash }),
  register: (data) => req("POST", "/auth/register", data),
  recover: (username, recoveryHash) => req("POST", "/auth/recover", { username, recoveryHash }),
  bootstrapSecurity: (data) => req("POST", "/auth/bootstrap-security", data),
  me: () => req("GET", "/auth/me"),
  logout: () => req("POST", "/auth/logout"),

  // Users
  getUser: (username) => req("GET", `/users/${encodeURIComponent(username)}`).catch(() => null),
  addUser: (data) => req("POST", "/auth/register", data),
  getAllUsers: () => req("GET", "/users"),
  updateUser: (_username, patch) => req("POST", "/profile", patch),

  // Resumable encrypted uploads
  startUpload: (meta) => req("POST", "/uploads", meta),
  uploadStatus: (uploadId) => req("GET", `/uploads/${uploadId}`),
  uploadChunk: (uploadId, offset, chunk) =>
    uploadReq("PUT", `/uploads/${uploadId}`, chunk, {
      "Content-Type": "application/octet-stream",
      "X-Upload-Offset": String(offset),
    }),
  videoChunk: (id, idx, chunkIndex) =>
    reqBinary(`/archives/${id}/files/${idx}/chunks/${chunkIndex}`),
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
