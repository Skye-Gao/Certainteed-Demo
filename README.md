# Certainteed-Demo

NFC Key Emulator for Figma Prototype Navigation

This application detects NFC tags and simulates a right arrow key press, which can be used to advance slides in a Figma prototype demo running in a web browser.

## Prerequisites

- Node.js installed
- NFC reader device connected to your computer
- macOS, Linux, or Windows (cross-platform support)

### macOS Permissions

On macOS, you'll need to grant Accessibility permissions to Terminal (or your terminal app) to allow keyboard simulation:

1. Go to **System Settings** → **Privacy & Security** → **Accessibility**
2. Add Terminal (or iTerm2, etc.) to the list of allowed apps
3. Make sure it's enabled/checked

Without these permissions, the keyboard simulation will not work.

## Installation

1. Install dependencies using yarn (recommended) or npm:
```bash
yarn install
# OR
npm install
```

**Note:** If you encounter permission issues with npm, use yarn instead.

## Usage

1. Make sure your NFC reader is connected to your computer
2. Open your Figma prototype in a web browser and make sure the browser window is active/focused
3. Run the emulator using any of these methods:
```bash
# Using npm (recommended if npm works on your system)
npm start

# Using yarn
yarn start

# Or directly with node
node nfc-key-emulator.js
```

**Note:** `npm start` should work even if `npm install` had permission issues, since it just runs `node` under the hood. If dependencies are already installed, you can use any of the above commands.

4. When you tap an NFC tag to the reader, it will automatically simulate a right arrow key press, advancing to the next slide in your Figma prototype.

## How It Works

- The application uses `nfc-pcsc` to detect NFC tags via a connected NFC reader
- When a tag is detected, it uses AppleScript (on macOS) to simulate a keyboard right arrow key press
- The key press is sent globally to the active application (your web browser)
- This approach avoids native compilation issues and works reliably on macOS

## Notes

- Make sure the browser window with your Figma prototype is focused/active when tapping the NFC tag
- The application will continue running until you stop it (Ctrl+C)
- Each NFC tag detection triggers a single right arrow key press
