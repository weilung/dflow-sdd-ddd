# npm Publish Checklist

This checklist is for maintainers preparing a manual Dflow npm release.
Contributors do not need to run these steps for ordinary pull requests.

Replace `<version>` with the version being published, for example `0.1.2`.

## Pre-Publish

- [ ] Confirm the release scope and expected version impact.
- [ ] Update `package.json` version.
- [ ] Update `CHANGELOG.md`.
- [ ] Confirm `README.md` installation instructions match the release.
- [ ] Confirm Greenfield and Brownfield common flow changes are synchronized.
- [ ] Confirm generated templates match skill source where applicable.
- [ ] Run the lifecycle check in the development repo and confirm it is green,
      so every proposal this release covers is terminal (`implemented` /
      `rejected` / `superseded`) and already archived:

```bash
node scripts/check-lifecycle.mjs
```

- [ ] Run:

```bash
npm test
npm pack --dry-run
git diff --check
```

- [ ] Inspect `npm pack --dry-run` output for unexpected files or missing files.
- [ ] Commit the release preparation changes.

## Publish

- [ ] Confirm npm authentication:

```bash
npm whoami
```

- [ ] Publish:

```bash
npm publish
```

Use npm Security Key / WebAuthn 2FA when prompted. Do not assume a TOTP
`--otp` flow is available for maintainer accounts.

## Post-Publish Smoke

Run the smoke checks against the public registry package:

```bash
npx dflow-sdd-ddd@<version> --version
npx dflow-sdd-ddd@<version> --help
npx dflow-sdd-ddd@<version> init
npx dflow-sdd-ddd@<version> configure-agents
```

Verify:

- [ ] `--version` prints `<version>`.
- [ ] `--help` lists the expected commands.
- [ ] `init` creates the expected `dflow/specs/` workspace.
- [ ] `init` creates or preserves selected AI-agent instruction files correctly.
- [ ] `configure-agents` adds later selected AI-agent shims in an initialized
      project.

## Tags and GitHub Release

- [ ] Tag the development repo:

```bash
git tag v<version>
git push origin v<version>
```

- [ ] Export or sync the dist repo if this release includes public source
      changes.
- [ ] Run release verification in the dist repo.
- [ ] Tag the dist repo:

```bash
git tag v<version>
git push origin v<version>
```

- [ ] Create the GitHub Release for `v<version>`.
- [ ] Include user-facing changes, verification summary, and migration notes if
      any.

## Closeout

- [ ] Verify the npm registry shows `<version>` as `latest` when intended.
- [ ] Record post-publish smoke results in the release handoff or closeout note.
- [ ] Move implemented or rejected proposals out of the active proposal
      workspace.
- [ ] Leave the development repo clean except for intentional next-work notes.
