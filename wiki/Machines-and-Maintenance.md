# Machines and Maintenance

The **Machines** page (sidebar) is where you define the machines in your shop. Machines drive the machine-group sidebar in the Tool Library, RPM warnings in the Speeds & Feeds panel, dialect defaults in the CAM snippet generator, and — since v1.2 — service interval tracking and maintenance reminders.

---

## Machine fields

| Section | Fields |
|---|---|
| **Identity** | Name (required), Type, Manufacturer, Model, Serial #, Year, Unit (mm/inch) |
| **Control** | Control type (Fanuc, HAAS, Siemens, Mach3, LinuxCNC, etc.) |
| **Axes & Travel** | Number of axes, X/Y/Z travel |
| **Spindle** | Max RPM, spindle taper |
| **Feeds** | Max feed rate, rapid rate |
| **Tooling** | ATC pocket count |
| **Coolant** | Flood / mist / through-spindle availability |
| **Maintenance** | Service interval, last-serviced date, notes, maintenance log (see below) |

---

## Maintenance tracking

Each machine can have a **maintenance interval** (in days). The app tracks how long it's been since the machine was last serviced and flags it as due once the interval elapses.

| Field | Description |
|---|---|
| **Interval (days)** | How often the machine should be serviced. Leave blank/0 to disable reminders for this machine. |
| **Last serviced** | Date the machine was last serviced — read-only, set via "Log maintenance now" |
| **Maintenance notes** | Free-text notes for the next service entry (e.g. "spindle service, ballscrew lube") |

### Logging a service

1. Open the machine's edit form.
2. Enter any notes about the work done in **Maintenance notes**.
3. Click **Log maintenance now** — this sets *Last serviced* to today and adds an entry (date + notes) to the maintenance log.
4. The 5 most recent log entries are shown below the button.

---

## Reminders

A machine becomes **due** once the time since its last service (or since it was created, if never serviced) reaches its maintenance interval.

- The **Dashboard**'s "Maintenance Due" card lists all due machines.
- On **desktop builds**, a native notification is shown for each newly-due machine (checked hourly, at most once per day per machine).

### Lead time

Go to **Settings → Notifications → Maintenance lead time (days)** to be notified *before* the interval actually elapses — e.g. a lead time of 5 days flags a 30-day-interval machine as due once 25 days have passed.

### Turning notifications off

Settings → Notifications has independent toggles for maintenance, low-stock, and backup-reminder notifications. Turning off **Maintenance reminders** only disables the desktop notification — the Dashboard's "Maintenance Due" card always reflects the current due machines regardless of this setting.
