/// Headless CLI mode for the CNC Tool Converter desktop binary.
///
/// When the packaged `.exe` is invoked with CLI subcommands it runs this
/// module instead of opening a window.  Converter logic lives in TypeScript,
/// so we delegate to the Node.js CLI script when available, or print clear
/// instructions when Node.js is not on PATH.
///
/// In a future step the TypeScript converters will be compiled to a
/// self-contained bundle that is embedded in the binary via `include_bytes!`,
/// so no external Node.js installation will be required.

use std::process::{Command, Stdio};

/// Entry point for CLI mode.  Returns the desired process exit code.
pub fn run(args: Vec<String>) -> i32 {
    // ── Try to run via Node.js (dev workflow / Node installed) ────────────────
    // Look for the CLI script relative to the executable.  In dev mode it is
    // at `<repo>/cli/cnc-convert.ts`; in a packaged build it would be
    // `<install-dir>/resources/cli/cnc-convert.ts`.

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()));

    let script_candidates: Vec<std::path::PathBuf> = exe_dir
        .as_ref()
        .map(|d| {
            vec![
                // Development: running from target/debug/
                d.join("../../../cli/cnc-convert.ts"),
                // Packaged: resources bundled alongside the binary
                d.join("resources/cli/cnc-convert.ts"),
            ]
        })
        .unwrap_or_default();

    let script_path = script_candidates
        .iter()
        .find(|p| p.exists())
        .and_then(|p| p.canonicalize().ok());

    if let Some(script) = script_path {
        // Find tsx / node on PATH
        let tsx_result = run_with_tsx(&script, &args);
        match tsx_result {
            Ok(code) => return code,
            Err(e)   => eprintln!("cnc-convert: failed to run tsx: {e}"),
        }
    }

    // ── Fallback: print instructions ──────────────────────────────────────────
    eprintln!();
    eprintln!("CNC Tool Converter — CLI mode");
    eprintln!();
    eprintln!("The packaged CLI runner requires Node.js (for the current release).");
    eprintln!("Install Node.js from https://nodejs.org/ then run:");
    eprintln!();
    eprintln!("  npm run cli -- {}", args.join(" "));
    eprintln!();
    eprintln!("Or, from the project directory:");
    eprintln!();
    eprintln!("  npx tsx cli/cnc-convert.ts {}", args.join(" "));
    eprintln!();
    1
}

fn run_with_tsx(script: &std::path::Path, args: &[String]) -> Result<i32, String> {
    // Try `tsx` first, then `npx tsx`, then fall back to plain `node`
    let candidates = [
        vec!["tsx".to_string()],
        vec!["npx".to_string(), "tsx".to_string()],
    ];

    for mut cmd_args in candidates {
        let program = cmd_args.remove(0);
        let mut cmd = Command::new(&program);
        cmd.args(&cmd_args);
        cmd.arg(script);
        cmd.args(args);
        cmd.stdin(Stdio::inherit());
        cmd.stdout(Stdio::inherit());
        cmd.stderr(Stdio::inherit());

        match cmd.status() {
            Ok(status) => return Ok(status.code().unwrap_or(1)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(e) => return Err(e.to_string()),
        }
    }

    Err("tsx not found on PATH".to_string())
}
