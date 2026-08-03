# Plan 30-10 — Angel /ai Adopter (CHAT-19)

**Status:** DM sent 2026-08-02; Angel's confirmation is async and non-blocking on the phase close (per Ashley's "ship it" 2026-08-02).

## Execution

Vicky DM'd Angel via Matrix relay (room `!cTFWdfBcWIXexJroXn`) at 2026-08-02T~23:35Z with:

- Full `ChatComposerNode` wire-shape spec (all 18 fields typed).
- AI-chat state-machine explanation (`status` closed enum drives send-button icon swap; `stopAction` REQUIRED when status can reach streaming per gotcha #11).
- IME `isComposing` guard note (CJK correctness; baked-in non-optional).
- Three attach ingress paths explained (click / drag-drop / paste-image → chip strip in `headerSlot` → multipart on send).
- **`ActionEvent.files` widening** flagged as breaking-adjacent (`Record<string, File>` → `Record<string, File | File[]>`) — backward-compat for single-file, but multi-file lands under one form-field name; TS-server-side may need `parseFormDataAction` extension; .NET already supports via `Request.Form.Files.GetFiles(name)`.
- v1 explicit deferrals listed.
- Adoption ask: replace hand-rolled compose bar, confirm visual + no wire regressions, ping `adopt ok` / `adopt ok — with:` / `adopt blocked:`.

DM event ID: `$PQWtuGtWRXogItaE-u1VcG-5LXpLvRgf6Lb3A-qgrRM`.

## Ashley's "ship it" directive (2026-08-02)

Angel's async confirmation is expected but does not block the phase close. Per Ashley's decision, Wave 9 (green-tree gate + phase close) proceeds immediately; if Angel flags a real regression after adoption, a follow-up plan opens against the shipped composite. CHAT-19 satisfaction is "adoption pathway delivered + consumer notified"; Angel's actual adoption timing is his cadence.

## Follow-up

- Angel's response, when it arrives, appended to this SUMMARY.
- If `adopt ok`: CHAT-19 fully resolved; no further action.
- If `adopt ok — with: <notes>`: notes triaged (framework fix vs consumer-side vs docs update); framework fixes get a Phase 30 patch commit.
- If `adopt blocked`: follow-up plan opens against the shipped composite; v9.1.0 closeout phase awaits resolution.
