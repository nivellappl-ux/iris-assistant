---
name: IRIS integration boundary
description: Product scope for preserving local IRIS data while enabling explicitly authorized AI.
---

IRIS was built specifically for Duvion as its intelligent operational interface, not as a generic assistant. The user confirms Duvion was also built on Replit and is in the same Repl. Preserve IRIS's conversational identity, Mochi character, and Dynamic Island. Never present fictional information as live Duvion data.

Use Gemini through Replit AI Integrations for general conversation; the user chose Replit-credit billing and requested removal of the mock/demo provider. Keep OpenAI unchanged and selectable only explicitly with `AI_PROVIDER=openai`. Gemini is not connected to Duvion and must not receive local records.

Task, inbox/capture, project, and focus actions are no longer available in the app. Requests to use or inspect them must be answered locally; never send stored records or their contents to AI. Duvion facts and real actions remain unavailable until a real, authorized integration is supplied.

Mochi is intentionally mouthless; audio speech must not depend on or trigger a visible mouth animation.

Wake-word standby should auto-start on app open by default when microphone permission and platform support are available. First-time permission may require a user action; keep a setting to disable auto-start, disclose that browser/WebView speech recognition may process audio under its own rules, and do not promise background listening.

**Why:** The user specified that IRIS should become Duvion's operational intelligence while preserving its appearance, using real authorized Duvion data, and never inventing live facts or actions. The user confirms Duvion is also in this Repl. The user later requested removing local productivity features from the app while preserving their records, then chose Replit AI Integrations for Gemini and kept OpenAI unchanged. The current workspace still has no Duvion integration.

**How to apply:** Treat Duvion as the active product direction, but describe it as disconnected until a real API/auth source is available. Keep Replit-managed Gemini calls on the server, disclose that usage is billed to Replit credits, and keep OpenAI unchanged behind explicit selection. Never persist simulated writes. Preserve removed-feature records without exposing or sending them. Keep Mochi's voice independent from her face. Auto-arm only with platform support and permission, keep opt-out and privacy disclosure, and never promise background listening.

**Why:** The user asked to remove demonstration-mode replies; only a real general-purpose provider should handle free-form conversation, and the app has no verified Duvion data or actions.

## LiveKit voice access

The user requests LiveKit voice on the published IRIS site. Keep written chat public and require a real signed-in session only for voice. LiveKit credentials stay server-side, and room tokens stay short-lived and room-scoped. Voice should be feminine and in European Portuguese (Portugal). Keep Duvion disconnected and OpenAI configuration untouched.

**Why:** The user changed the earlier development-only voice decision by requesting authentication so published voice can be used safely.

**How to apply:** Protect LiveKit token issuance with Clerk identity; do not gate text chat. Use a feminine pt-PT voice for audio and verify production voice-worker availability separately from API token issuance.

**Why:** An already-running API process continued signing tokens with its previous credentials after environment values changed, while fresh shell checks used the new values; LiveKit rejected those stale signatures.

**How to apply:** After changing LiveKit credentials, restart both API and agent workflows so neither keeps using stale process values.