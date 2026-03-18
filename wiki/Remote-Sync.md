# Remote Sync

The Remote Sync feature lets you push and pull your tool library to/from an external HTTP endpoint. This enables:

- **Cloud backup** — keep an off-browser copy of your library
- **Multi-machine sharing** — use the same library on different computers
- **Team collaboration** — multiple operators working from a shared library

---

## Supported backends

Any HTTP endpoint that accepts `GET` and `PUT` requests with a JSON body works, including:

| Backend | Auth type | Notes |
|---------|-----------|-------|
| Custom REST API | Bearer token | Most flexible; build your own endpoint |
| Nextcloud / WebDAV | Basic auth | Upload to a `.json` file on any WebDAV server |
| ownCloud | Basic auth | Same as Nextcloud |
| Any static file host with write access | Bearer or Basic | GitHub Gist API, etc. |

---

## Setup

### 1. Configure the endpoint

Go to **Settings → Remote Database**.

| Field | Description |
|-------|-------------|
| **Endpoint URL** | Full URL of the JSON file or API endpoint |
| **Auth type** | Bearer token or Basic auth (WebDAV) |
| **Username** | Required for Basic auth; also used as operator attribution in sync payloads |
| **Password / API token** | Secret credential |

**Nextcloud example URL:**
```
https://cloud.example.com/remote.php/dav/files/username/cnc-tools/library.json
```

### 2. Set your operator name

Go to **Settings → Library Defaults → Operator name** and enter your name. This is embedded in every sync payload so collaborators can see who made the last push.

The sync toolbar shows an amber warning if the operator name is not set.

---

## Syncing

The **☁ sync** icon appears in the Tool Library toolbar when a remote URL is configured.

Click it to open the sync dropdown:

| Button | What it does |
|--------|-------------|
| **Push** | Merges your local library with the remote, then uploads the result |
| **Pull** | Downloads the remote library, merges it into your local library |
| **Test connection** | Fetches the remote endpoint and validates the payload format |

The dropdown also shows: last push time, last pull time, last pushed by (operator name), and sync version counter.

---

## Merge behaviour

Remote Sync uses a **merge-on-push** strategy. Neither push nor pull blindly overwrites — they both merge:

1. The remote library is downloaded.
2. Each tool/material/holder is compared by `id` and `updatedAt` timestamp.
3. The version with the **newer `updatedAt`** wins.
4. If both the local and remote copy were modified since the last pull, the conflict is counted in the merge summary toast.

After merging, the merged result is:
- Written to your local IndexedDB.
- Uploaded to the remote endpoint (Push only).

### Merge summary toast

After every sync operation, a toast notification shows:

```
Sync complete — +3 from remote · 1 updated · 2 conflicts
```

- **+N from remote** — tools added to your library from the remote
- **N updated** — tools where the remote had a newer version
- **N conflicts** — tools where both sides changed since the last pull (remote version was kept)

---

## Multi-user / concurrent editing

The app uses **ETag optimistic locking** to handle simultaneous pushes from multiple users:

1. Before pushing, the app records the ETag returned by the last GET.
2. The PUT is sent with `If-Match: <etag>`.
3. If another user pushed between your GET and PUT, the server returns `412 Precondition Failed`.
4. The app automatically retries up to **3 times**: re-fetch → re-merge → re-push.
5. If all retries fail, an error is shown and no data is lost.

This works natively with WebDAV servers (Nextcloud, ownCloud) and any REST API that supports ETags.

---

## Auto-sync

Enable **Auto-sync on library change** in Settings → Remote Database to automatically push whenever the local library changes. This keeps the remote always up to date without manual intervention.

> **Note:** Auto-sync sends a push on every tool save. In a team environment, leave this off to avoid push conflicts — use manual Push/Pull instead.

---

## Security notes

- Credentials are stored in `localStorage` in your browser and never sent anywhere other than the configured endpoint.
- Use HTTPS endpoints only.
- For WebDAV/Nextcloud, create a dedicated app password rather than using your account password.
- The sync payload is plain JSON — if your endpoint is public, anyone with the URL and token can read your tool library.
