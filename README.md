# H7-Comms

An anonymous, browser-based, serverless encrypted rendezvous terminal for temporary operator communication.

## Overview

H7-Comms is a minimalist, secure communication environment operating under the H7 utility umbrella. It allows operators to connect via a shared Access Phrase into a cryptographically isolated room. There are no user accounts, profiles, logs, or server-side databases storing plaintext data. Everything is designed to be disposable, ephemeral, and secure by design.

## Features

- **Access Phrase Architecture**: Entering an Access Phrase automatically joins an existing room or creates a new one instantly.
- **Client-Side Encryption**: Messages are encrypted locally in your browser using AES-GCM before ever touching the database. Firebase only stores encrypted cipher payloads.
- **Strict Ephemerality**: Rooms have a fixed 24-hour lifetime and self-destruct completely once empty or expired.
- **Active Presence Counter**: A floating operator counter tracks active connections in real time with color-coded capacity feedback.
- **Session Restoration**: Seamlessly reconnects to your active session on browser refresh without creating duplicate operator instances.

## Quick Start Guide

1. Open the web interface in your browser or launch the Desktop `.exe`.
2. Click the terminal prompt (`<?>`) or `Enter` to wake the system.
3. Enter a secure, alphanumeric **Access Phrase** (letters and numbers only).
4. Begin communicating instantly with other operators sharing the exact same phrase.

## Command Manual

Operators can execute commands directly within the terminal interface by prefixing inputs with a forward slash (`/`):

| Command | Description |
| :--- | :--- |
| `/help` or `/h` | Display the system manual and available commands. |
| `/status` | View live room diagnostics (Room ID, active operator count, room age, and time remaining). |
| `/purge` | Permanently wipe all message history from the current room (requires `[Y/N]` confirmation). |
| `/clear` or `/cls` | Clear the local terminal display. |
| `/qr` | Generate a downloadable QR code. Usage: `/qr [url/text] [-s size] [-c hex_color] [-d download]` |
| `/exit` or `/bye` | Terminate your secure session and disconnect (requires `[Y/N]` confirmation). |

## Security & Privacy Constraints

- **No Plaintext Storage**: The server never sees your Access Phrase, your encryption keys, or your unencrypted text.
- **Automatic Purging**: Expired logs and empty rooms are automatically deleted.
- **Strict Input Rules**: Access phrases reject spaces, symbols, and special characters to ensure robust cryptographic derivation.

## Desktop Edition (Portable Windows App)

The terminal is also available as a standalone, portable Windows executable (`.exe`). It utilizes an Electron wrapper featuring native Windows 11 Acrylic blur, stripped developer menus for strict tamper-resistance, and active network polling for offline survival.

**How to use:**
1. Navigate to the [Releases page](https://github.com/hethwiQ/h7/releases) on this repository.
2. Download the latest release (e.g., **`H7-Comms 2.6.0.exe`**).
3. No installation required. Drop the single file on your desktop or a pen drive and double-click to execute instantly.
