#!/usr/bin/env node
// Chlädderi – seal maps/pack.testing.json into maps/pack.testing.chlpack.
//
//   node tools/seal-fixture.mjs
//
// The browser suite installs an encrypted region the way a viewer would: from an address, with the
// key in the link. That needs a sealed file to install, and this makes it.
//
// The key below is a *fixture* and is meant to be public -- it opens nothing but an invented
// region that is committed in plaintext two files away. Real regions are sealed in the private
// Chlaedderi/maps repository, where their keys are, and never here.
//
// Run this whenever maps/pack.testing.json changes; src/core/packs/chlpack.test.ts fails if the
// two drift apart.

import { webcrypto } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// One copy, read by the sealer, the unit test and the browser suite alike.
const FIXTURE_KEY = readFileSync("maps/pack.testing.key", "utf8").trim();

const json = readFileSync("maps/pack.testing.json", "utf8");
const body = new Uint8Array(gzipSync(Buffer.from(json, "utf8"), { level: 9 }));

const head = new Uint8Array(18);
head.set([0x43, 0x48, 0x4c, 0x50], 0); // "CHLP"
head[4] = 1; // version
head[5] = 1; // gzip
const nonce = webcrypto.getRandomValues(new Uint8Array(12));
head.set(nonce, 6);

const raw = new Uint8Array(Buffer.from(FIXTURE_KEY, "base64url"));
const key = await webcrypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
const sealed = new Uint8Array(
    await webcrypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce, additionalData: head.subarray(0, 6), tagLength: 128 },
        key,
        body,
    ),
);

const out = new Uint8Array(head.length + sealed.length);
out.set(head, 0);
out.set(sealed, head.length);
writeFileSync("maps/pack.testing.chlpack", out);
console.log(`maps/pack.testing.chlpack: ${out.length} bytes (plain ${Buffer.byteLength(json)})`);
