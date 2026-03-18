# Snapshots and Backup

The app provides two complementary ways to protect your library data: **snapshots** (in-browser point-in-time saves) and **backup exports** (portable files).

---

## Snapshots

Snapshots are point-in-time copies of your entire library stored inside the browser's IndexedDB. They are fast, require no file download, and can be restored with one click.

### Creating a snapshot

**Maintain ▾ → Snapshots → Create snapshot**

Enter an optional label (e.g. "Before big import" or "v3 machine group setup") and click **Save**. The snapshot captures all tools, materials, and holders at that instant.

Up to **20 snapshots** are retained. When the limit is reached, the oldest snapshot is automatically removed.

### Viewing snapshots

**Maintain ▾ → Snapshots**

The Snapshots panel lists all saved snapshots, newest first:

| Column | Description |
|--------|-------------|
| Label | Your label, or "Auto" for automatic snapshots |
| Date | When the snapshot was taken |
| Tools | Number of tools captured |

### Restoring a snapshot

Click **Restore** on any snapshot row. A confirmation prompt appears — confirm to replace the current library with the snapshot contents.

> **Warning:** Restoring a snapshot replaces your current library. Make a fresh snapshot first if you have unsaved work you want to keep.

### Deleting a snapshot

Click the trash icon on any snapshot row to delete it permanently.

### Automatic snapshots

The app takes an automatic snapshot before any destructive operation:

- Before a bulk import (with "Overwrite all duplicates" enabled)
- Before a Restore from backup
- Before a Remote Sync pull that replaces data

Automatic snapshots are labelled "Auto — [operation]".

---

## Backup export

A **Backup (JSON v2)** file is a portable copy of your entire library — tools, materials, and holders — in a single `.json` file.

### Creating a backup

In the toolbar: **Export** → select format **Backup (JSON v2)** → click **Download**.

Or use the dedicated **Backup** button in the toolbar (always visible).

### Restoring from a backup

In the toolbar: click **Restore** → drop your `.json` backup file onto the panel → click **Restore library**.

This replaces the current library (an automatic snapshot is taken first).

### Importing a backup into the Import panel

A backup `.json` file can also be dropped into the **Import** panel like any other file. This gives you duplicate detection and per-field merge controls rather than a full replacement — useful for merging two libraries.

---

## Choosing between snapshots and backups

| | Snapshots | Backup files |
|---|-----------|-------------|
| Storage location | Browser IndexedDB | Your file system |
| Survives browser data clear | No | Yes |
| Portable to another machine | No | Yes |
| Speed | Instant | Requires download/upload |
| Granularity | Full library | Full library |
| Limit | 20 | Unlimited |

**Best practice:** take a snapshot before any major change, and download a backup file weekly or before anything irreversible (clearing site data, switching machines).
