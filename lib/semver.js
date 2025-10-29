// @ts-check

import semver from 'semver';
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import z from 'zod';
import { ProjectInfo, NextVersion } from '../types/zod.js';

/**
 * @param {string[]} tags
 * @returns {?string}
 */
export const getLatestSemverTag = (tags) => {
  const semverTags = tags.filter(tag => semver.valid(tag));
  return semver.maxSatisfying(semverTags, '*', { includePrerelease: true });
}

/**
 * @returns {z.infer<typeof ProjectInfo>}
 */
export const getProjectInfo = () => {
  // Read project version from relevant file based on project type
  // Node.js - package.json
  if (existsSync('./package.json')) {
    const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
    const paths = ['./package.json']
    if (existsSync('./package-lock.json')) {
      paths.push('./package-lock.json');
    }
    return {
      version: semver.valid(pkg.version),
      type: 'node',
      paths
    }
  }
  // .NET - .csproj
  const csProjFiles = readdirSync('./', { recursive: true }).filter(filename => typeof filename === 'string' && filename.endsWith('.csproj'))
  if (!csProjFiles.every(file => typeof file === 'string')) {
    throw new Error('Error reading .csproj files, not all filenames are strings.');
  }
  if (csProjFiles.length > 0) {
    const versions = csProjFiles.map(file => {
      const content = readFileSync(`./${file}`, 'utf-8');
      const match = content.match(/<Version>(.*?)<\/Version>/);
      if (match && match.length > 1) {
        throw new Error(`Multiple <Version> tags found in .csproj file ${file}`);
      }
      return match ? { version: match[1], path: file } : null;
    }).filter(v => v !== null);
    if (versions.length > 1) {
      throw new Error('Multiple .csproj files with version tag found in solution.');
    }
    if (versions.length === 0) {
      throw new Error('No <Version> tag found in any .csproj file.');
    }
    return {
      version: semver.valid(versions[0].version),
      type: 'dotnet',
      paths: [versions[0].path]
    };
  }
  // Add more project types as needed
  throw new Error('Unsupported project type for version retrieval.');
}

/**
 *
 * Finds the next version based on latest tag and project version.
 * Favors the latest semver tag, and fallbacks to project version if semver tag is not present.
 * 
 * @param {?string} latestTag
 * @param {ProjectInfo} projectInfo
 * @param {'patch' | 'minor' | 'major'} releaseType
 * @returns {NextVersion}
 */
export const getNextVersion = (latestTag, projectInfo, releaseType) => {
  if (!semver.valid(projectInfo.version) && !semver.valid(latestTag)) {
    return NextVersion.parse({
      version: '1.0.0',
      isInitialRelease: true,
      source: 'vfk-cli'
    });
  }
  if (latestTag && semver.valid(latestTag)) {
    return NextVersion.parse({
      version: semver.inc(latestTag, releaseType),
      isInitialRelease: false,
      source: 'tag'
    });
  }
  const isInitialRelease = projectInfo.version === '1.0.0';
  return NextVersion.parse({
    // @ts-ignore IT IS VALID HERE
    version: isInitialRelease ? '1.0.0' : semver.inc(projectInfo.version, releaseType),
    isInitialRelease,
    source: 'project'
  });
}

/**
 * 
 * @param {ProjectInfo} projectInfo 
 * @param {string} newVersion
 * @return {void}
 */
export const updateProjectVersion = (projectInfo, newVersion) => {
  projectInfo = ProjectInfo.parse(projectInfo)
  if (!semver.valid(newVersion)) {
    throw new Error(`Invalid semver version: ${newVersion}`);
  }
  switch (projectInfo.type) {
    case 'node': {
      for (const path of projectInfo.paths) {
        const pkg = JSON.parse(readFileSync(path, 'utf-8'));
        pkg.version = newVersion;
        writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      }
      break;
    }
    case 'dotnet': {
      for (const path of projectInfo.paths) {
        const content = readFileSync(path, 'utf-8');
        const newContent = content.replace(/<Version>(.*?)<\/Version>/, `<Version>${newVersion}</Version>`);
        writeFileSync(path, newContent, 'utf-8');
      }
      break;
    }
    default:
      throw new Error(`Unsupported project type: ${projectInfo.type}`);
  }
}
