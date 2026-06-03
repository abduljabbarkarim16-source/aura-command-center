# AURA Desktop Live Updater Guide

AURA Command Center now supports seamless, over-the-air (OTA) updates using the official Tauri v2 Updater plugin. This allows installed desktop apps to check GitHub for newer versions, download the update, and automatically restart.

This guide explains how to generate the required cryptographic keys, configure your build environment, and publish a release.

## 1. Generating Updater Keys

Tauri requires all updates to be cryptographically signed. If an update's signature doesn't match the public key embedded in the app, the update will be rejected.

> [!CAUTION]
> **Keep your private key secret.** Never commit it to GitHub. If you lose your private key, you will not be able to issue updates for your app. Users would have to download the installer manually to update.

To generate a new keypair, open your terminal (PowerShell or Git Bash) and run:

```bash
npm run tauri signer generate -w ~/.tauri/aura.key
```

You will be prompted for a password. Remember this password! 
The command will generate two files in `~/.tauri/`:
- `aura.key` (Your private key)
- `aura.key.pub` (Your public key)

## 2. Configuring the Public Key

Open the `aura.key.pub` file. It contains a Base64 string. 
Copy that string and paste it into your `src-tauri/tauri.conf.json` file under `plugins > updater > pubkey`:

```json
"plugins": {
  "updater": {
    "pubkey": "YOUR_PUBLIC_KEY_BASE64_STRING",
    "endpoints": [
      "https://github.com/abduljabbarkarim16-source/aura-command-center/releases/latest/download/latest.json"
    ]
  }
}
```

## 3. Configuring Your Build Environment

Before running a build that generates updater artifacts, you must set two environment variables so Tauri can access your private key. 

In PowerShell, you can set them for your current session like this:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY="C:\Users\karim\.tauri\aura.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-secure-password"
```

## 4. Building the Release

With the variables set, bump the `version` in both `package.json` and `src-tauri/tauri.conf.json` (e.g., from `0.5.0` to `0.5.1`).

Then run the production build:

```bash
npm run tauri:build
```

Because `"createUpdaterArtifacts": true` is set, Tauri will generate three important files in `src-tauri/target/release/bundle/msi/`:
1. `AURA-Command-Center_0.5.1_x64_en-US.msi` (The actual installer)
2. `AURA-Command-Center_0.5.1_x64_en-US.msi.zip` (The compressed update payload)
3. `AURA-Command-Center_0.5.1_x64_en-US.msi.zip.sig` (The cryptographic signature)

## 5. Publishing to GitHub Releases

To push an update to your users:

1. Create a file named `latest.json` containing the update metadata. It should look like this:

```json
{
  "version": "0.5.1",
  "notes": "Added the live desktop updater!",
  "pub_date": "2026-06-03T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "CONTENTS_OF_THE_.sig_FILE",
      "url": "https://github.com/abduljabbarkarim16-source/aura-command-center/releases/download/v0.5.1/AURA-Command-Center_0.5.1_x64_en-US.msi.zip"
    }
  }
}
```

2. Create a new Release on your GitHub repository (e.g., tag `v0.5.1`).
3. Upload the following files to the release assets:
   - `latest.json`
   - `AURA-Command-Center_0.5.1_x64_en-US.msi`
   - `AURA-Command-Center_0.5.1_x64_en-US.msi.zip`
   - `AURA-Command-Center_0.5.1_x64_en-US.msi.zip.sig` (Optional, since the signature is in `latest.json`, but good for completeness).

> [!TIP]
> Notice how the `endpoints` in `tauri.conf.json` points to `.../releases/latest/download/latest.json`. Because GitHub always redirects the `latest` tag to your newest release, the AURA app will automatically fetch the newest `latest.json` and know where to download the `.zip`.

