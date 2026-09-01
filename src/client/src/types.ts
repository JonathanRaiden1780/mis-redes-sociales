export interface AmplifyResponse {
  success: boolean
  amplified_prompt: string
  image_prompt: string
  video_script: { time: string; scene: string; description: string }[]
  hashtags: string[]
  cta: string
  color_palette: string[]
  style: string
  text_overlay: string
  platform_prompts: Record<string, {
    prompt: string
    format: string
    hashtags: string[]
    additional_params: Record<string, string>
  }>
  diffusion_message: string
  sale_type: string
  emotion: string
  tone: string
  psychological_triggers: string[]
}

export interface Platform {
  name: string
  icon: string
  color: string
}
