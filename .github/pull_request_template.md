## What and why

<!-- One surface or one fix per PR. For adapter work, name the screen and states checked. -->

## Checked in

- [ ] Dark
- [ ] Original

## Checklist

- [ ] `node --test "tests/*.test.cjs"` passes
- [ ] `node tests/browser/run-headless.cjs` passes (after `node tests/browser/build.cjs`)
- [ ] No new permissions, network calls, observers or timers
- [ ] Original mode restores the page exactly
- [ ] Images, avatars and editor content are untouched
- [ ] No captures, screenshots or diagnostics committed (captures contain real account data)
