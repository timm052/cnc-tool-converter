use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ── Native file dialogs ─────────────────────────────────────────────
        .plugin(tauri_plugin_dialog::init())
        // ── Filesystem access ───────────────────────────────────────────────
        .plugin(tauri_plugin_fs::init())
        // ── Shell (for reveal-in-explorer) ──────────────────────────────────
        .plugin(tauri_plugin_shell::init())
        // ── OS notifications ────────────────────────────────────────────────
        .plugin(tauri_plugin_notification::init())
        // ── Auto-updater ────────────────────────────────────────────────────
        .plugin(tauri_plugin_updater::Builder::new().build())
        // ── SQLite database with schema migrations ──────────────────────────
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:cnc-tool-converter.db",
                    vec![
                        Migration {
                            version: 1,
                            description: "initial_schema",
                            sql: include_str!("../migrations/001_initial.sql"),
                            kind: MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running CNC Tool Converter");
}
