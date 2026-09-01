#!/bin/sh
# Container entry point.
#
# Two steps, in order:
#   1. Reconcile the Next.js build against the modules actually installed in
#      the /app/src/modules volume (see scripts/reconcile-build.ts). Normally
#      a sub-second no-op; rebuilds after a module install or an image update.
#   2. Hand the process over to the server.
#
# `exec` matters: it replaces this shell rather than forking, so `next start`
# becomes PID 1 and receives SIGTERM from `docker stop` directly. Without it
# the shell would be PID 1, the signal would stop at the shell, and every
# container stop would end in a 10-second SIGKILL with the shutdown registry
# never running.
set -e

npx tsx scripts/reconcile-build.ts

exec npx next start -p 3001 -H 0.0.0.0
