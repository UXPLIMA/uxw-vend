import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The update path's security property, written down where it can fail.
 *
 * Updating means pulling an image and recreating a container, which means the
 * Docker socket, which is root on the host. The application container runs
 * module code that arrived in a ZIP from a marketplace, so it must never hold
 * that socket - the panel asks for an update by writing a tag into a shared
 * volume, and a separate service does the work.
 *
 * Two ways that could quietly stop being true: somebody adds the socket to the
 * app service to make a feature easier, or the updater's script moves onto the
 * shared volume, where the app could rewrite what the socket holder runs. Both
 * read as small edits. This is the test that says they are not.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const COMPOSE = fs.readFileSync(path.join(ROOT, "docker-compose.yml"), "utf8");

/** The block of a service, from its name to the next service at the same indent. */
function service(name: string): string {
    const start = COMPOSE.indexOf(`\n  ${name}:`);
    expect(start, `${name} should be a service`).toBeGreaterThan(-1);
    const rest = COMPOSE.slice(start + 1);
    const next = rest.slice(1).search(/^ {2}[a-z][\w-]*:$/m);
    return next === -1 ? rest : rest.slice(0, next + 1);
}

/** Service names that mount the Docker socket. */
function socketHolders(): string[] {
    const holders: string[] = [];
    for (const match of COMPOSE.matchAll(/^ {2}([a-z][\w-]*):$/gm)) {
        if (service(match[1]).includes("/var/run/docker.sock")) holders.push(match[1]);
    }
    return holders;
}

describe("the docker socket", () => {
    it("is held by the updater and by nothing else", () => {
        expect(socketHolders()).toEqual(["updater"]);
    });

    it("is not held by the application, which runs module code from a ZIP", () => {
        expect(service("app")).not.toContain("docker.sock");
    });
});

describe("what the socket holder runs", () => {
    it("comes from the host, not from the volume the app can write", () => {
        const updater = service("updater");
        // Mounted read-only from the compose project directory. If this ever
        // points into the shared state volume, a compromised app container
        // writes the script that holds the socket.
        expect(updater).toContain("./updater.sh:/updater.sh:ro");
        expect(updater.replace(/\n/g, " ")).toMatch(/command:.*updater\.sh/);
        expect(updater).not.toMatch(/updatestate:\/updater\.sh/);
    });

    it("is shipped with the stack, so an installed host has it", () => {
        const installer = fs.readFileSync(path.join(ROOT, "install.sh"), "utf8");
        expect(installer).toMatch(/COMPOSE_FILES=\([^)]*updater\.sh/);
        expect(fs.existsSync(path.join(ROOT, "updater.sh"))).toBe(true);
    });

    it("refuses anything that is not a tag, whatever reached the volume", () => {
        const script = fs.readFileSync(path.join(ROOT, "updater.sh"), "utf8");
        // The app validates before writing; this is the second check, on the
        // side that would run the value.
        expect(script).toContain("*[!A-Za-z0-9._-]*");
        expect(script).toContain("refused a tag that is not a tag");
    });

    it("does not recreate itself in the middle of its own run", () => {
        const script = fs.readFileSync(path.join(ROOT, "updater.sh"), "utf8");
        expect(script).toContain("compose up -d migrate app");
        expect(script).not.toMatch(/compose up -d\s*(>|$)/m);
    });

    it("puts the previous tag back when the new one does not come up", () => {
        const script = fs.readFileSync(path.join(ROOT, "updater.sh"), "utf8");
        expect(script).toContain("pin_tag \"$previous\"");
        expect(script).toContain("rolled back to");
    });
});

describe("the shared volume", () => {
    it("is mounted by both sides and declared once", () => {
        expect(service("app")).toContain("updatestate:/var/lib/blysis/update");
        expect(service("updater")).toContain("updatestate:/state");
        expect(COMPOSE).toMatch(/^volumes:[\s\S]*^ {2}updatestate:$/m);
    });
});
