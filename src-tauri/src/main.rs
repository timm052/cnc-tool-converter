// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cli;

fn main() {
    // Check for CLI subcommands before launching the GUI.
    let args: Vec<String> = std::env::args().skip(1).collect();
    let first = args.first().map(|s| s.as_str()).unwrap_or("");

    let is_cli = matches!(
        first,
        "convert" | "formats" | "inspect" | "--help" | "-h" | "--version" | "-v"
    );

    if is_cli {
        std::process::exit(cli::run(args));
    }

    cnc_tool_converter_lib::run();
}
