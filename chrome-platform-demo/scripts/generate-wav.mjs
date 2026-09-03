import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SAMPLE_RATE = 44_100
export const DURATION_SECONDS = 1.25
export const MEDIA_COUNT = 20

function writeAscii(buffer, offset, value) {
  buffer.write(value, offset, value.length, 'ascii')
}

export function createToneWav({ frequency, duration = DURATION_SECONDS, sampleRate = SAMPLE_RATE }) {
  const sampleCount = Math.round(duration * sampleRate)
  const bytesPerSample = 2
  const dataLength = sampleCount * bytesPerSample
  const buffer = Buffer.alloc(44 + dataLength)

  writeAscii(buffer, 0, 'RIFF')
  buffer.writeUInt32LE(36 + dataLength, 4)
  writeAscii(buffer, 8, 'WAVE')
  writeAscii(buffer, 12, 'fmt ')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28)
  buffer.writeUInt16LE(bytesPerSample, 32)
  buffer.writeUInt16LE(16, 34)
  writeAscii(buffer, 36, 'data')
  buffer.writeUInt32LE(dataLength, 40)

  const fadeSamples = Math.round(sampleRate * 0.025)
  for (let index = 0; index < sampleCount; index += 1) {
    const fadeIn = Math.min(1, index / fadeSamples)
    const fadeOut = Math.min(1, (sampleCount - index - 1) / fadeSamples)
    const envelope = Math.min(fadeIn, fadeOut)
    const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate)
    buffer.writeInt16LE(Math.round(sample * envelope * 0.24 * 32767), 44 + index * bytesPerSample)
  }

  return buffer
}

export async function generateWavFiles(outputDirectory) {
  await mkdir(outputDirectory, { recursive: true })
  const files = []

  for (let index = 0; index < MEDIA_COUNT; index += 1) {
    const number = String(index + 1).padStart(2, '0')
    const filename = `tone-${number}.wav`
    const buffer = createToneWav({ frequency: 220 + index * 24 })
    await writeFile(resolve(outputDirectory, filename), buffer)
    files.push({ filename, buffer })
  }

  return files
}

const currentFile = fileURLToPath(import.meta.url)
const defaultOutput = resolve(dirname(currentFile), '..', 'public', 'media')

if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const files = await generateWavFiles(defaultOutput)
  console.log(`Generated ${files.length} deterministic WAV files in ${defaultOutput}`)
}
