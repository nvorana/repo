export type StudioId = 'idea' | 'research' | 'blueprint' | 'writing' | 'launch'

export interface Project {
  spark: string
  oneLiner: string
}

export interface Module {
  id: string
  title: string
  summary: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'companion'
  text: string
  streaming?: boolean
}

export interface Suggestion {
  id: string
  label: string
  reply: string
}
