import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import semver from 'semver';
import { getLatestSemverTag } from './semver.js';
import { get } from 'node:http';
import { RepoInfo } from '../types/zod.js';

const runGitCommand = command => {
  if (typeof command !== 'string' || !command.startsWith('git ')) {
    throw new Error('Command must be string and only git commands are allowed');
  }
  try {
    const res = execSync(command)
    return res.toString()
  } catch (err) {
    if (err.message.includes('Not a git repository')) {
      throw new Error('Directory is not a Git repository')
    }
    throw err
  }
}

export const getDefaultBranch = () => {
  return runGitCommand('git rev-parse --abbrev-ref origin/HEAD').trim().replace('origin/', '');
}

export const getCurrentBranch = () => {
  return runGitCommand('git rev-parse --abbrev-ref HEAD').trim();
}

export const fetchChangesAndTags = () => {
  return runGitCommand(`git fetch --all --tags`);
}

export const isRepoClean = () => {
  const status = runGitCommand('git status');
  return status.includes('Your branch is up to date with ') && status.includes('nothing to commit, working tree clean');
}

export const isGithubRepo = () => {
  const remoteUrl = runGitCommand('git config --get remote.origin.url').trim();
  // git@github.com:<owner>/<repo>.git - SSH version
  // https://github.com/<owner>/<repo>.git - HTTPS version
  return remoteUrl.startsWith('git@github.com:') || remoteUrl.startsWith('https://github.com/');
}

export const getCommitsBehindAndAheadDefaultBranch = () => {
  const defaultBranch = getDefaultBranch()
  const diff = runGitCommand(`git rev-list --left-right --count origin/${defaultBranch}...HEAD`).trim();
  const [behind, ahead] = diff.split('\t');
  return { behind: parseInt(behind), ahead: parseInt(ahead) };
}

export const getLatestReleaseTag = () => {
  const tags = runGitCommand('git tag').trim().split('\n');
  // Lets find the latest semver tag
  return getLatestSemverTag(tags);
}


/**
 * 
 * @param {RepoInfo} repoInfo 
 * @returns {void}
 */
export const repoIsReadyForPullRequest = (repoInfo) => {
  repoInfo = RepoInfo.parse(repoInfo);
  if (repoInfo.currentBranch === repoInfo.defaultBranch) {
    throw new Error('You are currently on the default branch. Please switch to a feature branch to create a PR.');
  }
  if (repoInfo.commitDiff.behind > 0) {
    throw new Error(`Your branch is behind the default branch by ${repoInfo.commitDiff.behind} commit(s). Please merge the default branch (maybe add how to merge) into your branch before creating a PR.`);
  }
  if (!repoInfo.repoIsClean) {
    throw new Error('Please commit and push or stash your changes before creating a PR.');
  }
  return;
}

/**
 * 
 * @returns {RepoInfo}
 */
export const getRepoInfo = () => {
  const remoteUrl = runGitCommand('git config --get remote.origin.url').trim();
  if (!(remoteUrl.startsWith('git@github.com:') || remoteUrl.startsWith('https://github.com/'))) {
    throw new Error('Repository is not a GitHub repository. VFK CLI only supports GitHub for PR creation.');
  }
  fetchChangesAndTags();
  const githubUrl = (remoteUrl.startsWith('git@') ? remoteUrl.replace('git@github.com:', 'https://github.com/') : remoteUrl).replace(/\.git$/, '');
  // git@github.com:<owner>/<repo>.git - SSH version
  // https://github.com/<owner>/<repo>.git - HTTPS version
  const currentBranch = getCurrentBranch();
  const defaultBranch = getDefaultBranch();
  const repoIsClean = isRepoClean();
  const commitDiff = getCommitsBehindAndAheadDefaultBranch();

  return {
    remoteUrl,
    githubUrl,
    currentBranch,
    defaultBranch,
    repoIsClean,
    commitDiff
  }
}

export const commitAndPush = (message) => {
  runGitCommand('git add .');
  runGitCommand(`git commit -m "${message}"`);
  const currentBranch = getCurrentBranch();
  runGitCommand(`git push origin ${currentBranch} --quiet`);
}
