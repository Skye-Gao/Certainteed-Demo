// NFC Assigned Key Emulator for Windows - Maps specific NFC tag UIDs to assigned keys
const { NFC } = require("nfc-pcsc");
const { exec } = require("child_process");
const fs = require("fs");
const readline = require("readline");
const path = require("path");
const os = require("os");

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

// Key mapping for Windows SendKeys syntax
// SendKeys uses special codes: {LEFT}, {RIGHT}, {ENTER}, {TAB}, {ESC}, {SPACE}, etc.
// Regular letters and numbers are sent as-is
const KEY_MAPPINGS = {
  'left': '{LEFT}',
  'right': '{RIGHT}',
  'down': '{DOWN}',
  'up': '{UP}',
  'enter': '{ENTER}',
  'return': '{ENTER}',
  'space': ' ',
  'escape': '{ESC}',
  'esc': '{ESC}',
  'tab': '{TAB}',
  'delete': '{DELETE}',
  'backspace': '{BS}',
  'home': '{HOME}',
  'end': '{END}',
  'pageup': '{PGUP}',
  'pagedown': '{PGDN}',
  // Arrow keys (alternative names)
  'arrowleft': '{LEFT}',
  'arrowright': '{RIGHT}',
  'arrowdown': '{DOWN}',
  'arrowup': '{UP}',
  // Number keys (just use the character)
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  // Letter keys (just use the character, uppercase for consistency)
  'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D', 'e': 'E', 'f': 'F',
  'g': 'G', 'h': 'H', 'i': 'I', 'j': 'J', 'k': 'K', 'l': 'L',
  'm': 'M', 'n': 'N', 'o': 'O', 'p': 'P', 'q': 'Q', 'r': 'R',
  's': 'S', 't': 'T', 'u': 'U', 'v': 'V', 'w': 'W', 'x': 'X',
  'y': 'Y', 'z': 'Z',
};

// Function to simulate a key press using PowerShell (Windows)
function pressKey(keyName) {
  return new Promise((resolve, reject) => {
    const normalizedKey = keyName.toLowerCase().trim();
    
    if (!(normalizedKey in KEY_MAPPINGS)) {
      reject(new Error(`Unknown key: ${keyName}. Available keys: ${Object.keys(KEY_MAPPINGS).filter(k => !k.startsWith('arrow')).join(', ')}`));
      return;
    }
    
    const sendKeyCode = KEY_MAPPINGS[normalizedKey];
    
    // Use PowerShell with System.Windows.Forms.SendKeys to simulate key press
    // Create a temporary PowerShell script to avoid escaping issues
    const tempScript = path.join(os.tmpdir(), `nfc-sendkey-${Date.now()}.ps1`);
    const scriptContent = `Add-Type -AssemblyName System.Windows.Forms\n[System.Windows.Forms.SendKeys]::SendWait("${sendKeyCode.replace(/"/g, '`"')}")`;
    
    fs.writeFileSync(tempScript, scriptContent, 'utf8');
    
    // Execute PowerShell script
    exec(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`, (error, stdout, stderr) => {
      // Clean up temp file
      try {
        if (fs.existsSync(tempScript)) {
          fs.unlinkSync(tempScript);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
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
        // Validate the key exists (check if keyName is in KEY_MAPPINGS)
        const normalizedKey = keyName.toLowerCase().trim();
        if (!(normalizedKey in KEY_MAPPINGS)) {
          console.error(`❌ Invalid key: "${keyName}". Key not assigned.`);
          console.error(`   Available keys: ${Object.keys(KEY_MAPPINGS).filter(k => !k.startsWith('arrow')).join(', ')}`);
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
      console.error("Make sure the application has proper permissions to simulate keyboard input.");
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

console.log("\n🚀 NFC Assigned Key Emulator (Windows) started. Waiting for NFC tags...");
console.log("📝 Mappings are stored in:", MAPPINGS_FILE);
console.log("💡 When you tap an unassigned tag, you'll be prompted to assign a key.\n");

// Cleanup on exit
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down...");
  rl.close();
  process.exit(0);
});

