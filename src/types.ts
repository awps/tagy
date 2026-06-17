export interface ReplaceRule {
  files: string | string[]
  from: string
  to: string
  flags?: string | false
}

export interface TagyConfig {
  branch: string | null
  tagPrefix: string
  bump: string[]
  replace: ReplaceRule[]
  autoRelease: boolean
}
