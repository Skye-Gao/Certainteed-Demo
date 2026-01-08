// NFC Assigned Key Emulator - Maps specific NFC tag UIDs to assigned keys
const { NFC } = require("nfc-pcsc");
const { exec } = require("child_process");
const fs = require("fs");
const readline = require("readline");

const nfc = new NFC();
const MAPPINGS_FILE = "tag-key-mappings.json";

// Load tag-to-key mappings from JSON file
let TAG_KEY_MAPPING = {};

function loadMappings() {
  try {
    if (fs.existsSync(MAPPINGS_FILE)) {
      const data = fs.readFileSync(MAPPINGS_FILE, "utf8");
      TAG_KEY_MAPPING = JSON.parse(data);
      console.log(`✅ Loaded ${Object.keys(TAG_KEY_MAPPING).length} tag assignment(s) from ${MAPPINGS_FILE}`);
    } else {
      // Create empty mappings file if it doesn't exist
      saveMappings();
      console.log(`📝 Created new mappings file: ${MAPPINGS_FILE}`);
    }
  } catch (error) {
    console.error(`Error loading mappings file: ${error.message}`);
    console.log("Starting with empty mappings.");
  }
}

function saveMappings() {
  try {
    fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(TAG_KEY_MAPPING, null, 2), "utf8");
  } catch (error) {
    console.error(`Error saving mappings file: ${error.message}`);
  }
}

// Setup readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askForKeyAssignment(tagUID) {
  return new Promise((resolve) => {
    console.log(`\n📋 Tag detected with UID: ${tagUID}`);
    console.log("Available keys: left, right, up, down, enter, space, tab, escape, a-z, 0-9, etc.");
    rl.question("Enter the key to assign to this tag (press Enter to assign, or just Enter to skip): ", (answer) => {
      const keyName = answer.trim().toLowerCase();
      if (keyName === "") {
        console.log("⏭️  Skipped assignment.");
        resolve(null);
      } else {
        // The key will be assigned automatically when this resolves
        resolve(keyName);
      }
    });
  });
}

// Key code mapping for macOS (AppleScript key codes)
const KEY_CODES = {
  'left': 123,
  'right': 124,
  'down': 125,
  'up': 126,
  'enter': 36,
  'return': 36,
  'space': 49,
  'escape': 53,
  'tab': 48,
  'delete': 51,
  'backspace': 51,
  'home': 115,
  'end': 119,
  'pageup': 116,
  'pagedown': 121,
  // Arrow keys (alternative names)
  'arrowleft': 123,
  'arrowright': 124,
  'arrowdown': 125,
  'arrowup': 126,
  // Number keys
  '0': 29, '1': 18, '2': 19, '3': 20, '4': 21,
  '5': 23, '6': 22, '7': 26, '8': 28, '9': 25,
  // Letter keys (lowercase)
  'a': 0, 'b': 11, 'c': 8, 'd': 2, 'e': 14, 'f': 3,
  'g': 5, 'h': 4, 'i': 34, 'j': 38, 'k': 40, 'l': 37,
  'm': 46, 'n': 45, 'o': 31, 'p': 35, 'q': 12, 'r': 15,
  's': 1, 't': 17, 'u': 32, 'v': 9, 'w': 13, 'x': 7,
  'y': 16, 'z': 6,
};

// Function to simulate a key press using AppleScript (macOS)
function pressKey(keyName) {
  return new Promise((resolve, reject) => {
    const keyCode = KEY_CODES[keyName.toLowerCase()];
    
    if (keyCode === undefined) {
      reject(new Error(`Unknown key: ${keyName}. Available keys: ${Object.keys(KEY_CODES).join(', ')}`));
      return;
    }
    
    const appleScript = `
      tell application "System Events"
        key code ${keyCode}
      end tell
    `;
    
    exec(`osascript -e '${appleScript}'`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

nfc.on("reader", (reader) => {
  console.log(`${reader.reader.name} device attached`);

  reader.on("card", async (card) => {
    // Get the UID from the card
    // For TAG_ISO_14443_3 (standard NFC tags), UID is in card.uid
    // For TAG_ISO_14443_4, we might need to handle differently
    let tagUID = null;
    
    if (card.type === 'TAG_ISO_14443_3' && card.uid) {
      tagUID = card.uid;
    } else if (card.type === 'TAG_ISO_14443_4' && card.data) {
      // For ISO 14443-4 tags, you might need to extract UID differently
      // This is a placeholder - adjust based on your tag type
      tagUID = card.data.toString('hex');
    }
    
    console.log(`${reader.reader.name} card detected`);
    console.log(`Tag type: ${card.type}`);
    console.log(`Tag UID: ${tagUID || 'N/A'}`);
    
    if (!tagUID) {
      console.warn("Could not extract UID from tag. Full card data:", card);
      return;
    }
    
    // Look up the assigned key for this UID
    let assignedKey = TAG_KEY_MAPPING[tagUID];
    
    if (!assignedKey) {
      // Ask user to assign a key interactively
      const keyName = await askForKeyAssignment(tagUID);
      
      if (keyName) {
        // Validate the key exists (check if keyName is in KEY_CODES)
        const normalizedKey = keyName.toLowerCase().trim();
        if (!(normalizedKey in KEY_CODES)) {
          console.error(`❌ Invalid key: "${keyName}". Key not assigned.`);
          console.error(`   Available keys: ${Object.keys(KEY_CODES).filter(k => !k.startsWith('arrow')).join(', ')}`);
          return;
        }
        
        // Use normalized key
        const validKeyName = normalizedKey;
        
        // Assign and save automatically
        TAG_KEY_MAPPING[tagUID] = validKeyName;
        saveMappings();
        assignedKey = validKeyName;
        console.log(`✅ Assigned key "${validKeyName}" to tag ${tagUID}`);
        console.log(`💾 Saved to ${MAPPINGS_FILE}`);
      } else {
        return; // User skipped assignment
      }
    }
    
    try {
      console.log(`🎯 Tag UID ${tagUID} → Key: ${assignedKey}`);
      console.log(`Simulating ${assignedKey} key press...`);
      await pressKey(assignedKey);
      console.log(`✅ ${assignedKey} key pressed successfully!`);
    } catch (error) {
      console.error("Error simulating keyboard input:", error);
      console.error("Make sure Terminal has Accessibility permissions in System Settings");
    }
  });

  reader.on("card.off", (card) => {
    console.log(`${reader.reader.name} card removed`);
  });

  reader.on("error", (err) => {
    console.log(`${reader.reader.name} an error occurred`, err);
  });

  reader.on("end", () => {
    console.log(`${reader.reader.name} device removed`);
  });
});

nfc.on("error", (err) => {
  console.log("an error occurred", err);
});

// Load mappings on startup
loadMappings();

console.log("\n🚀 NFC Assigned Key Emulator started. Waiting for NFC tags...");
console.log("📝 Mappings are stored in:", MAPPINGS_FILE);
console.log("💡 When you tap an unassigned tag, you'll be prompted to assign a key.\n");

// Cleanup on exit
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down...");
  rl.close();
  process.exit(0);
});

