---
name: Rustup on Replit's Nix shell
description: Running rustup-managed Rust compiler in the Replit Linux shell without loader conflicts.
---

Rustup-managed `rustc` can fail before compilation with a static-TLS loader error while Replit's `LD_AUDIT` audit loader is active. For one-off Rust commands in this workspace, invoke them with `env -u LD_AUDIT` (for example, `env -u LD_AUDIT cargo check ...`); do not change the workspace-wide audit setting.

**Why:** Replit's runtime audit shim conflicts with the Rust compiler's dynamically loaded driver; unsetting the variable resolved the failure without affecting normal app services.

**How to apply:** Use this wrapper only for Cargo or rustc commands in this managed Linux environment. CI and target-OS builds should use their standard Rust toolchain environment.