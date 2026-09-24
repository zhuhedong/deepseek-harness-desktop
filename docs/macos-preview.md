# macOS unsigned preview install guide

This page covers installing the unsigned contributor preview of **DeepSeek Harness Desktop** on Apple Silicon and Intel Macs. Official Windows install steps remain in the root [README.en.md](../README.en.md) and [desktop.md](desktop.md).

## Scope and limits

- Apple Silicon installs the arm64 package. Intel Macs install the x64 package. The two builds are not interchangeable: Rosetta cannot run the arm64 package, and Apple Silicon cannot run the x64 package directly.
- This is an unsigned preview, not a stable distribution, and it is not on the Mac App Store.
- macOS uses the system Git. MinGit is not bundled. If `git --version` fails, install Xcode Command Line Tools with `xcode-select --install`.
- Preview builds have no in-app auto-update. **Help > Check for Updates** explains this. Download new builds from [GitHub Releases](https://github.com/ningbainb/deepseek-harness-desktop/releases). Do not use `/releases/latest`; pre-releases are omitted from Latest.
- Starting with macOS 15 Sequoia, Apple removed the **Right-click > Open** bypass. Use the Terminal command or System Settings path below.

## Install

1. Download the `.dmg` or `.zip` that matches this Mac from [GitHub Releases](https://github.com/ningbainb/deepseek-harness-desktop/releases). Apple Silicon files look like `DeepSeek-Harness-Desktop-<version>-arm64.dmg`. Intel files look like `DeepSeek-Harness-Desktop-<version>-x64.dmg`. Preview titles will say the build is unsigned and for contributor verification only.
2. Open the `.dmg` and drag **DeepSeek Harness Desktop.app** to `/Applications`, or unzip the `.zip` and move the `.app` into `/Applications`.
3. Clear the quarantine attribute (downloaded unsigned apps almost always have it):

```bash
xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness Desktop.app"
```

4. If Gatekeeper still blocks it: open **System Settings > Privacy & Security** and choose **Open Anyway**. Do not expect a right-click Open shortcut.
5. Launch **DeepSeek Harness Desktop**.

## Contributor checklist

- The app starts and shows the main window.
- The built-in terminal works (it must not exit because `pty.node` or `spawn-helper` is missing).
- System Git is detected; a missing CLT should prompt installation instead of reporting that Git is absent.
- Exercise plugin install, SSH, Task Board, and deep links the way you normally would.

## Feedback

Open a GitHub Issue with chip generation, macOS version, reproduction steps, and a redacted diagnostic export from the app. Do not attach `.credentials.yaml`, a real `~/.dsh` tree, or secrets.
