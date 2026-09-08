# SFX assets

Drop the template SFX variants referenced in `src/templates/index.ts` here
(e.g. `whoosh-1.mp3`, `pop-1.mp3`, `impact-1.mp3`, `resolve-1.mp3`, and the
`professional`/`calm` variants). Files are resolved by name at mix time; a
missing file is skipped (logged, not a hard failure) so rendering still
works before assets are supplied.

These files are never served to end users -- they may only leave the system
baked into a rendered MP4 (licensing requirement, see CLAUDE.md).
