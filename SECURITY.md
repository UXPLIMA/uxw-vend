# Security Policy

## Supported Versions

uxwVend is pre-1.0 and under active development. Security fixes are applied to
the latest `main` and the most recent tagged release only.

| Version | Supported |
|---------|-----------|
| latest `main` | :white_check_mark: |
| older tags | :x: |

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through one of:

1. **GitHub Security Advisories** (preferred) — open a draft advisory at
   <https://github.com/siracozmen01/uxwVend/security/advisories/new>.
2. **Email** — `siracozmen@protonmail.com` with the subject line
   `[SECURITY] uxwVend`.

Please include:
- A description of the vulnerability and its impact.
- Steps to reproduce (proof of concept if possible).
- Affected version / commit.
- Any suggested remediation.

We aim to acknowledge reports within **72 hours** and to provide a remediation
timeline after triage. Please give us a reasonable window to release a fix
before any public disclosure (coordinated disclosure).

## Scope

In scope: the core platform (`src/core`, `src/app`), first-party modules
(`module-sources/`), themes, the module/theme install pipeline, auth, RBAC,
the upload and webhook surfaces.

Out of scope: vulnerabilities in third-party dependencies (report those
upstream), issues that require a pre-compromised admin account, and findings
that depend on running with insecure non-default configuration (e.g.
`PAYPAL_ALLOW_UNVERIFIED=1`).

## Hardening Notes

Production deployments should set `AUTH_SECRET`, `SECRET_ENCRYPTION_KEY`, a
shared `REDIS_URL` (for multi-worker rate limiting), and serve over HTTPS so
the secure cookie prefixes activate. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
