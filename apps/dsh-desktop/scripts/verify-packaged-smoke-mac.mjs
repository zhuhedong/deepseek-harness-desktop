import { access, mkdtemp, rm, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { runPackagedDesktop } from './packaged-smoke-runner.mjs'
import { PRODUCT_FILENAME } from './verify-package-mac.mjs'

const desktopAppDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function macPackArchFromArgv(argv = []) {
  const wantsArm64 = argv.includes('--arm64')
  const wantsX64 = argv.includes('--x64')
  if (wantsArm64 && wantsX64) throw new Error('macOS packaged smoke accepts only one of --arm64 or --x64')
  return wantsX64 ? 'x64' : 'arm64'
}

export function packagedMacExecutableCandidates(appDir = desktopAppDir, arch = 'arm64') {
  const executable = join('Contents', 'MacOS', PRODUCT_FILENAME)
  const appName = `${PRODUCT_FILENAME}.app`
  const folders = arch === 'x64' ? ['mac', 'mac-x64'] : ['mac-arm64']
  return folders.map((folder) => join(appDir, 'dist', folder, appName, executable))
}

export function packagedMacResourcesPath(executablePath) {
  return resolve(join(executablePath, '..', '..', 'Resources'))
}

export function assertIsolatedSmokePaths({ userData, dshHome, realHome = homedir() }) {
  const realDsh = resolve(join(realHome, '.dsh'))
  if (resolve(dshHome) === realDsh) {
    throw new Error('macOS packaged smoke must not use the real ~/.dsh')
  }
  const prefix = `${realDsh}${sep}`
  if (resolve(userData).startsWith(prefix) || resolve(dshHome).startsWith(prefix)) {
    throw new Error('macOS packaged smoke paths must stay outside ~/.dsh')
  }
}

export async function snapshotPath(path) {
  try {
    const info = await stat(path)
    return { exists: true, mtimeMs: info.mtimeMs, size: info.size }
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, mtimeMs: 0, size: 0 }
    throw error
  }
}

export function assertSnapshotUnchanged(before, after, label) {
  if (before.exists !== after.exists || before.mtimeMs !== after.mtimeMs || before.size !== after.size) {
    throw new Error(`${label} changed during packaged smoke`)
  }
}

export async function resolvePackagedMacExecutable(appDir = desktopAppDir, arch = 'arm64') {
  const candidates = packagedMacExecutableCandidates(appDir, arch)
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  throw new Error(`packaged macOS executable is missing; looked in ${candidates.join(', ')}`)
}

export async function assertMacTerminalNatives(resources, arch = 'arm64') {
  if (arch !== 'arm64' && arch !== 'x64') {
    throw new Error(`macOS packaged smoke only supports arm64 or x64, received ${arch}`)
  }
  const unpackedModules = join(resources, 'app.asar.unpacked', 'node_modules')
  const triple = `darwin-${arch}`
  const prebuild = join(unpackedModules, 'node-pty', 'prebuilds', triple)
  await access(join(prebuild, 'pty.node'))
  await access(join(prebuild, 'spawn-helper'))
  await access(join(unpackedModules, '@img', `sharp-${triple}`))
  await access(join(unpackedModules, `lightningcss-${triple}`, `lightningcss.${triple}.node`))
  await access(join(unpackedModules, '@koromix', `koffi-${triple}`))
  try {
    await access(join(resources, 'managed-git'))
    throw new Error('packaged macOS app must not include bundled MinGit')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

export async function runMacPackagedSmoke({
  appDir = desktopAppDir,
  realHome = homedir(),
  timeoutMs = 180_000,
  arch = 'arm64',
} = {}) {
  const appPath = await resolvePackagedMacExecutable(appDir, arch)
  const resources = packagedMacResourcesPath(appPath)
  await assertMacTerminalNatives(resources, arch)

  const root = await mkdtemp(join(tmpdir(), 'dsh-packaged-smoke-mac-'))
  const userData = join(root, 'user-data')
  const dshHome = join(root, 'dsh-home')
  assertIsolatedSmokePaths({ userData, dshHome, realHome })
  const realDsh = join(realHome, '.dsh')
  const before = await snapshotPath(realDsh)
  try {
    const result = await runPackagedDesktop({
      appPath,
      userData,
      dshHome,
      timeoutMs,
    })
    const after = await snapshotPath(realDsh)
    assertSnapshotUnchanged(before, after, 'real ~/.dsh')
    return Object.freeze({
      appPath,
      userData,
      dshHome,
      elapsedMs: result.elapsedMs,
      timings: result.timings,
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await runMacPackagedSmoke({ arch: macPackArchFromArgv(process.argv.slice(2)) })
  console.log(`packaged macOS desktop smoke ${JSON.stringify({
    elapsedMs: result.elapsedMs,
    appPath: result.appPath,
    ...result.timings,
  })}`)
}
