import assert from 'node:assert';
import { describe, it } from 'node:test';

import { getLatestSemverTag, getNextVersion } from '../../lib/semver.js';

describe('getLatestSemverTag', () => {
  it('should return the latest semver tag', () => {
    // This test assumes that the git repository has at least one semver tag.
    const latestTag = getLatestSemverTag(['v3.0.0', 'v1.1.0', 'v2.0.0', 'v5.0.1-beta', 'v6.0.0', 'not-a-tag']);
    assert.strictEqual(latestTag, 'v6.0.0');
  });
});

describe('getNextVersion', () => {
  it('should calculate the next version correctly if project is already increased', () => {
    const latestTag = '1.2.3';
    /** @type {import('../../lib/semver.js').ProjectInfo} */
    const projectInfo = { version: '1.2.4', type: 'node', path: '' };
    const releaseType = 'minor';

    const nextVersion = getNextVersion(latestTag, projectInfo, releaseType);
    assert.strictEqual(nextVersion.version, '1.3.0');
    assert.strictEqual(nextVersion.source, 'tag');
    assert.strictEqual(nextVersion.isInitialRelease, false);
  });
  it('should calculate the next version correctly if project is behind latest tag', () => {
    const latestTag = '2.0.0';
    /** @type {import('../../lib/semver.js').ProjectInfo} */
    const projectInfo = { version: '1.5.0', type: 'node', path: '' };
    const releaseType = 'patch';

    const nextVersion = getNextVersion(latestTag, projectInfo, releaseType);
    assert.strictEqual(nextVersion.version, '2.0.1');
    assert.strictEqual(nextVersion.source, 'tag');
    assert.strictEqual(nextVersion.isInitialRelease, false);
  });
  it('should return initial version if no valid versions exist', () => {
    const latestTag = null;
    /** @type {import('../../lib/semver.js').ProjectInfo} */
    const projectInfo = { version: null, type: 'node', path: '' };
    const releaseType = 'major';

    const nextVersion = getNextVersion(latestTag, projectInfo, releaseType);
    assert.strictEqual(nextVersion.version, '1.0.0');
    assert.strictEqual(nextVersion.source, 'vfk-cli');
    assert.strictEqual(nextVersion.isInitialRelease, true);
  });
  it('should use tag if tag and project version are the same', () => {
    const latestTag = '1.0.0';
    /** @type {import('../../lib/semver.js').ProjectInfo} */
    const projectInfo = { version: '1.0.0', type: 'node', path: '' };
    const releaseType = 'minor';

    const nextVersion = getNextVersion(latestTag, projectInfo, releaseType);
    assert.strictEqual(nextVersion.version, '1.1.0');
    assert.strictEqual(nextVersion.source, 'tag');
    assert.strictEqual(nextVersion.isInitialRelease, false);
  });
  it('should return 1.0.0 and mark as initial release if project version is 1.0.0 and no tags exist', () => {
    const latestTag = null;
    /** @type {import('../../lib/semver.js').ProjectInfo} */
    const projectInfo = { version: '1.0.0', type: 'node', path: '' };
    const releaseType = 'minor';

    const nextVersion = getNextVersion(latestTag, projectInfo, releaseType);
    assert.strictEqual(nextVersion.version, '1.0.0');
    assert.strictEqual(nextVersion.source, 'project');
    assert.strictEqual(nextVersion.isInitialRelease, true);
  });
});