// Google Play (novembre 2026) : l'application doit cibler l'API 36 au minimum.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const v = readFileSync(new URL('../android/variables.gradle', import.meta.url), 'utf8');
test('Android : targetSdk et compileSdk >= 36, minSdk 24', () => {
  assert.ok(Number(/targetSdkVersion = (\d+)/.exec(v)[1]) >= 36);
  assert.ok(Number(/compileSdkVersion = (\d+)/.exec(v)[1]) >= 36);
  assert.equal(Number(/minSdkVersion = (\d+)/.exec(v)[1]), 24);
});
