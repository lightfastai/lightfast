enum NetworkType {
  "single-agent" = "single-agent",
  "multi-agent" = "multi-agent",
}
interface Network {
  type: NetworkType;
}
enum AgentType {
  execution = "execution",
  research = "research",
  planning = "planning",
  reasoning = "reasoning",
  communication = "communication",
  memory = "memory",
  learning = "learning",
  creativity = "creativity",
  "problem-solving" = "problem-solving",
  "decision-making" = "decision-making",
}
interface Agent {}
interface Task {}
enum ResourceType {
  image = "image",
  video = "video",
  audio = "audio",
  text = "text",
  code = "code",
  "3d-model" = "3d-model",
}
interface Resource {}
