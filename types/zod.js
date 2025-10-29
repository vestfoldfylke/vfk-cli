import z from "zod";

/** @typedef { z.infer<typeof ProjectInfo> } */
export const ProjectInfo = z.object({
  version: z.string().nullable(),
  type: z.enum(['node', 'dotnet']),
  paths: z.array(z.string())
});

/** @typedef { z.infer<typeof NextVersion> } */
export const NextVersion = z.object({
  version: z.string(),
  isInitialRelease: z.boolean(),
  source: z.enum(['tag', 'project', 'vfk-cli'])
})

/** @typedef { z.infer<typeof RepoInfo> } */
export const RepoInfo = z.object({
  remoteUrl: z.string(),
  githubUrl: z.url(),
  currentBranch: z.string(),
  defaultBranch: z.string(),
  repoIsClean: z.boolean(),
  commitDiff: z.object({
    behind: z.number(),
    ahead: z.number()
  })
})