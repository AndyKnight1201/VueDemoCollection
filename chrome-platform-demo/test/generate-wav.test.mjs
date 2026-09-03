import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  DURATION_SECONDS,
  generateWavFiles,
  MEDIA_COUNT,
  SAMPLE_RATE,
} from '../scripts/generate-wav.mjs'

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

test('generates 20 valid deterministic PCM WAV files', async () => {
  const firstDirectory = await mkdtemp(join(tmpdir(), 'chrome-platform-wav-a-'))
  const secondDirectory = await mkdtemp(join(tmpdir(), 'chrome-platform-wav-b-'))

  try {
    await generateWavFiles(firstDirectory)
    await generateWavFiles(secondDirectory)
    const firstFiles = (await readdir(firstDirectory)).sort()
    const secondFiles = (await readdir(secondDirectory)).sort()

    assert.equal(firstFiles.length, MEDIA_COUNT)
    assert.deepEqual(firstFiles, secondFiles)
    assert.equal(firstFiles[0], 'tone-01.wav')
    assert.equal(firstFiles.at(-1), 'tone-20.wav')

    const first = await readFile(join(firstDirectory, firstFiles[0]))
    const sameTone = await readFile(join(secondDirectory, secondFiles[0]))
    assert.equal(first.toString('ascii', 0, 4), 'RIFF')
    assert.equal(first.toString('ascii', 8, 12), 'WAVE')
    assert.equal(first.readUInt16LE(20), 1)
    assert.equal(first.readUInt16LE(22), 1)
    assert.equal(first.readUInt32LE(24), SAMPLE_RATE)
    assert.equal(first.readUInt16LE(34), 16)
    assert.equal(first.readUInt32LE(40), Math.round(SAMPLE_RATE * DURATION_SECONDS) * 2)
    assert.equal(hash(first), hash(sameTone))
  } finally {
    await rm(firstDirectory, { recursive: true, force: true })
    await rm(secondDirectory, { recursive: true, force: true })
  }
})
