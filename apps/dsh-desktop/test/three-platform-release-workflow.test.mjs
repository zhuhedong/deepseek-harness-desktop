import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

const workflowPath = join(import.meta.dirname, '..', '..', '..', '.github', 'workflows', 'desktop-three-platform-release.yml')

test('three-platform release delegates the stable updater channel to the Windows packer once', async () => {
  const workflow = await readFile(workflowPath, 'utf8')

  assert.match(workflow, /^\s*- run: pnpm --filter @linxin666\/dsh-desktop pack:win\s*$/mu)
  assert.doesNotMatch(workflow, /pack:win[^\n]*--config\.publish\.channel/u)
  assert.match(workflow, /DSH_DESKTOP_UPDATE_CHANNEL: stable/u)
  assert.match(workflow, /runs-on: macos-15-intel/u)
  assert.match(workflow, /test "\$\(uname -m\)" = x86_64/u)
  assert.match(workflow, /pnpm --filter @linxin666\/dsh-desktop pack:mac:x64/u)
  assert.match(workflow, /pnpm --filter @linxin666\/dsh-desktop pack:verify:mac:x64/u)
  assert.match(workflow, /pnpm --filter @linxin666\/dsh-desktop pack:smoke:mac:x64/u)
  assert.match(workflow, /DeepSeek-Harness-Desktop-\$\{\{ needs\.metadata\.outputs\.version \}\}-x64\.dmg/u)
  assert.match(workflow, /DeepSeek-Harness-Desktop-\$\{\{ needs\.metadata\.outputs\.version \}\}-x64\.zip/u)
})
