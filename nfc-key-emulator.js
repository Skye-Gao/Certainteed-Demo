// NFC Key Emulator - Simulates right arrow key when NFC tag is detected
const { NFC } = require("nfc-pcsc");
const { exec } = require("child_process");

const nfc = new NFC();

// Function to simulate right arrow key using AppleScript (macOS)
function pressRightArrow() {
  return new Promise((resolve, reject) => {
    const appleScript = `
      tell application "System Events"
        key code 124
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
    console.log(`${reader.reader.name} card detected`, card);
    
    try {
      // Simulate right arrow key press
      console.log("Simulating right arrow key press...");
      await pressRightArrow();
      console.log("Right arrow key pressed successfully!");
    } catch (error) {
      console.error("Error simulating keyboard input:", error);
      console.error("Make sure Terminal has Accessibility permissions in System Settings");
    }
  });

  reader.on("card.off", (card) => {
    console.log(`${reader.reader.name} card removed`, card);
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

console.log("NFC Key Emulator started. Waiting for NFC tags...");
console.log("When a tag is detected, it will simulate a right arrow key press.");

