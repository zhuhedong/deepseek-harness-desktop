import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { prepareReleaseDirectory } from './prepare-release-directory.mjs'
import { defaultReleaseChannel } from '../src/release-manifest.mjs'

const APP_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ELECTRON_BUILDER_BIN = join(APP_DIRECTORY, 'node_modules', '.bin', 'electron-builder')
const PACKAGE_MANIFEST = JSON.parse(await readFile(resolve(APP_DIRECTORY, 'package.json'), 'utf8'))
const RELEASE_CHANNEL = defaultReleaseChannel({
  version: PACKAGE_MANIFEST.version,
  configuredChannel: process.env.DSH_DESKTOP_UPDATE_CHANNEL,
})

export function assertDarwinPackHost(platform = process.platform, { arch, hostArch = process.arch } = {}) {
  if (platform !== 'darwin') throw new Error('pack:mac only runs on macOS')
  if (arch !== undefined && hostArch !== arch) {
    throw new Error(`pack:mac ${arch} only runs on a native darwin-${arch} Mac`)
  }
}

export function parsePackMacArguments(argv) {
  const wantsArm64 = argv.includes('--arm64')
  const wantsX64 = argv.includes('--x64')
  if (wantsArm64 && wantsX64) throw new Error('pack:mac accepts only one of --arm64 or --x64')
  return { dir: argv.includes('--dir'), arch: wantsX64 ? 'x64' : 'arm64' }
}

export function electronBuilderCommand() {
  return ELECTRON_BUILDER_BIN
}

export function electronBuilderPublishChannel(releaseChannel = RELEASE_CHANNEL) {
  return releaseChannel === 'beta' ? 'beta' : 'latest'
}

export function electronBuilderArgs(argv = [], releaseChannel = RELEASE_CHANNEL) {
  const parsed = parsePackMacArguments(argv)
  const extra = argv.filter((argument) => argument !== '--dir' && argument !== '--arm64' && argument !== '--x64')
  const args = [
    '--mac',
    parsed.arch === 'x64' ? '--x64' : '--arm64',
    '--publish',
    'never',
    `--config.publish.channel=${electronBuilderPublishChannel(releaseChannel)}`,
  ]
  if (parsed.dir) args.push('--dir')
  args.push(...extra)
  return args
}

export function packEnvironment(env = process.env, arch = 'arm64') {
  const userAgent = env.npm_config_user_agent
  return {
    ...env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    // electron-builder looks in the app directory for pnpm-lock.yaml. Direct
    // node invocation has no user-agent, so it would collect modules as npm
    // and drop optional darwin natives (sharp / koffi / lightningcss).
    npm_config_user_agent: typeof userAgent === 'string' && userAgent.includes('pnpm')
      ? userAgent
      : `pnpm/11.22.0 npm/? node/? darwin ${arch}`,
  }
}

function spawnProcess(command, args, env) {
  return spawn(command, args, {
    cwd: APP_DIRECTORY,
    env,
    stdio: 'inherit',
    shell: false,
  })
}

function run(command, args, env = process.env) {
  return new Promise((resolveRun, reject) => {
    const child = spawnProcess(command, args, env)
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveRun()
        return
      }
      reject(new Error(`${command} ${args.join(' ')} exited with ${signal || `code ${code}`}`))
    })
  })
}

export async function packMac({
  argv = process.argv.slice(2),
  platform = process.platform,
  hostArch = process.arch,
  runCommand = run,
  prepare = prepareReleaseDirectory,
  releaseChannel = RELEASE_CHANNEL,
} = {}) {
  const parsed = parsePackMacArguments(argv)
  assertDarwinPackHost(platform, { arch: parsed.arch, hostArch })
  await prepare()
  await runCommand(
    electronBuilderCommand(),
    electronBuilderArgs(argv, releaseChannel),
    packEnvironment(process.env, parsed.arch),
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await packMac()
}
