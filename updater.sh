#!/bin/sh
# The only part of the stack that may talk to Docker.
#
# The admin panel cannot update the application it is part of: doing so means
# pulling an image and recreating a container, which means the Docker socket,
# which is root on the host. The app container runs module code that arrives in
# a ZIP from a marketplace, so it does not get that. This does, and nothing
# else.
#
# It watches one file. `/state/request` holds a single line - an image tag the
# app took from the release feed, never from a request body. Everything this
# script will do is decided by that one value, and it is checked again here
# against the alphabet a tag may use, because a file on a shared volume is not
# a promise.
#
# Progress goes back the same way: a word in `/state/status`, a timestamp in
# `/state/heartbeat` so a panel can tell "working" from "died", and the output
# in `/state/progress.log` for the screen to tail.
#
# Failure policy: if the new image does not come up healthy within the wait,
# the previous tag is put back and the stack is restarted on it. That returns
# the application. It does not return the database - migrations are additive
# and forward-only for exactly this reason, so the older image runs against the
# newer schema.
set -u

STATE=/state
PROJECT=/project
POLL_SECONDS=5
# The first boot on a new image recompiles installed modules, which is a full
# Next build. The app's own healthcheck allows ten minutes for it; this waits
# longer than that before calling the update failed.
HEALTH_WAIT_SECONDS=1200

log() {
    printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >> "$STATE/progress.log"
}

beat() {
    date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE/heartbeat"
}

status() {
    printf '%s' "$1" > "$STATE/status"
}

compose() {
    ( cd "$PROJECT" && docker compose "$@" )
}

current_tag() {
    grep -E '^UXWVEND_VERSION=' "$PROJECT/.env" 2>/dev/null | head -n1 | cut -d= -f2- || true
}

pin_tag() {
    if grep -qE '^UXWVEND_VERSION=' "$PROJECT/.env" 2>/dev/null; then
        sed -i -E "s|^UXWVEND_VERSION=.*|UXWVEND_VERSION=$1|" "$PROJECT/.env"
    else
        printf 'UXWVEND_VERSION=%s\n' "$1" >> "$PROJECT/.env"
    fi
}

# Healthy means the healthcheck the stack already defines says so. Asking
# Docker rather than making our own HTTP call keeps one definition of healthy.
app_healthy() {
    id="$(compose ps -q app 2>/dev/null | head -n1)"
    [ -n "$id" ] || return 1
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null)"
    case "$state" in
        healthy) return 0 ;;
        # Only reached on a compose file whose app declares no healthcheck.
        # Then "up" is all there is to go on, and the wait below is shorter
        # than it looks - which is a reason to keep the healthcheck.
        running) return 0 ;;
        *) return 1 ;;
    esac
}

wait_healthy() {
    waited=0
    while [ "$waited" -lt "$HEALTH_WAIT_SECONDS" ]; do
        beat
        if app_healthy; then return 0; fi
        sleep 10
        waited=$((waited + 10))
        if [ $((waited % 60)) -eq 0 ]; then
            log "still starting (${waited}s) - a first boot after an update recompiles installed modules"
        fi
    done
    return 1
}

# `up -d migrate app` and not a bare `up -d`: a bare one would recreate this
# container too, in the middle of its own run.
bring_up() {
    compose up -d migrate app >> "$STATE/progress.log" 2>&1
}

run_update() {
    tag="$1"
    previous="$(current_tag)"
    [ -n "$previous" ] || previous=latest

    status running
    beat
    log "updating to $tag (from ${previous})"

    pin_tag "$tag"

    log "pulling the image"
    if ! compose pull >> "$STATE/progress.log" 2>&1; then
        log "the image could not be pulled - nothing was changed"
        pin_tag "$previous"
        status failed
        return
    fi
    beat

    log "migrating and restarting"
    if ! bring_up; then
        log "the stack refused to start on the new image"
        pin_tag "$previous"
        bring_up
        status failed
        return
    fi

    if wait_healthy; then
        log "updated to $tag and healthy"
        status done
        return
    fi

    log "the new version did not become healthy in time - putting ${previous} back"
    pin_tag "$previous"
    if bring_up && wait_healthy; then
        log "rolled back to ${previous}"
    else
        log "the rollback did not come up either - run 'uxwvend logs' on the host"
    fi
    status failed
}

mkdir -p "$STATE"
log "updater watching for requests"

while true; do
    if [ -f "$STATE/request" ]; then
        requested="$(head -n1 "$STATE/request" | tr -d '\r\n')"
        rm -f "$STATE/request"
        case "$requested" in
            *[!A-Za-z0-9._-]* | "" | [!A-Za-z0-9_]*)
                status failed
                log "refused a tag that is not a tag"
                ;;
            *)
                run_update "$requested"
                ;;
        esac
    fi
    sleep "$POLL_SECONDS"
done
