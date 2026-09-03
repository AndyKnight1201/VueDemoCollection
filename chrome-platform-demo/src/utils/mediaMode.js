export const MEDIA_MODES = Object.freeze(['lazy', 'eager'])

export function parseMediaMode(value) {
  return MEDIA_MODES.includes(value) ? value : 'lazy'
}
