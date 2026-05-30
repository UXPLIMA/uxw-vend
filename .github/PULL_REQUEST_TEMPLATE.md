<!-- Thanks for contributing to uxwVend! -->

## Summary

<!-- What does this PR do and why? -->

## Type of change

- [ ] Bug fix
- [ ] New feature (new module / theme preferred over core changes)
- [ ] Refactor / chore
- [ ] Documentation

## Core motto checklist

uxwVend's central invariant: **core knows nothing about any module or theme.**

- [ ] No module names, module paths, or module-specific code added to `src/core/` or core app files
- [ ] No hardcoded theme names in core
- [ ] New module/theme behavior is declared in `module.json` / `theme.json` and wired through the registry
- [ ] Module source changes under `module-sources/` are mirrored to the marketplace (`npm run build:marketplace`) if relevant

## Verification

- [ ] `npm run lint` passes (`--max-warnings=0`)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes (if applicable)

## Notes

<!-- Anything reviewers should know: trade-offs, follow-ups, screenshots. -->
