// script.js

// Bluetooth service and characteristic UUIDs
const PYBRICKS_COMMAND_EVENT_CHAR_UUID = "c5f50002-8280-46da-89f4-6d8051e4aeef";
const PYBRICKS_COMMAND_EVENT_SERVICE_UUID = "c5f50001-8280-46da-89f4-6d8051e4aeef"; // CORRECTED SERVICE UUID

// Global flags and variables
let hubReadyReceived = false;
let sensorDataDisplayed = false;  // tracks if sensor data is currently displayed
let bluetoothDevice = null;
let commandEventCharacteristic = null;
let dataStreamActive = false;
let expectingSensorData = false;
let ignoreFirstNotification = false; // flag to optionally ignore first notification

// UI Elements
const connectButton    = document.getElementById("connectButton");
const startButton      = document.getElementById("startButton");
const stopButton       = document.getElementById("stopButton");
const disconnectButton = document.getElementById("disconnectButton");
const prunusButton     = document.getElementById("prunusButton");
const statusDiv        = document.getElementById("status");
const sensorDataDiv    = document.getElementById("sensorData");

// --- EVENT LISTENERS ---
connectButton.addEventListener('click', () => {
  if (isWebBluetoothEnabled()) { connectGATT(); }
});

startButton.addEventListener('click', () => {
  if (isWebBluetoothEnabled()) { startDataStream(); }
});

stopButton.addEventListener('click', () => {
  if (isWebBluetoothEnabled()) { stopDataStream(); }
});

disconnectButton.addEventListener('click', () => {
  if (isWebBluetoothEnabled()) { disconnectGATT(); }
});

prunusButton.addEventListener('click', () => {
  if (isWebBluetoothEnabled() && dataStreamActive && hubReadyReceived) {
    sendPrunusCommand();
  } else {
    statusDiv.textContent += "\nStatus: Data stream not active. Start data stream first.";
  }
});

// --- FUNCTION DEFINITIONS ---

// Check if Web Bluetooth is available
function isWebBluetoothEnabled() {
  if (!navigator.bluetooth) {
    console.log('Web Bluetooth API is not available in this browser!');
    statusDiv.textContent = 'Error: Web Bluetooth API is not available in this browser!';
    return false;
  }
  return true;
}

// Connect to the Bluetooth device and get the characteristic
function connectGATT() {
  statusDiv.textContent = "Status: Scanning for devices...";
  sensorDataDiv.textContent = "FIRST RUN THE PROGRAM ON HUB";
  startButton.disabled = true;
  stopButton.disabled = true;
  disconnectButton.disabled = true;
  prunusButton.disabled = true;

  const options = {
    optionalServices: [PYBRICKS_COMMAND_EVENT_SERVICE_UUID],
    filters: [{ name: "NaViTech" }]
  };

  console.log('Requesting Bluetooth Device...');
  navigator.bluetooth.requestDevice(options)
    .then(device => {
      bluetoothDevice = device;
      statusDiv.textContent = `Status: Device selected: ${bluetoothDevice.name}`;
      console.log('Device selected:', bluetoothDevice);
      return bluetoothDevice.gatt.connect();
    })
    .then(server => {
      statusDiv.textContent += "\nStatus: Connected to GATT Server.";
      console.log('GATT Server connected:', server);
      return server.getPrimaryService(PYBRICKS_COMMAND_EVENT_SERVICE_UUID);
    })
    .then(service => {
      statusDiv.textContent += "\nStatus: Getting Command/Event Characteristic from Service...";
      console.log('Getting Command/Event Characteristic from Service:', service);
      return service.getCharacteristic(PYBRICKS_COMMAND_EVENT_CHAR_UUID);
    })
    .then(characteristic => {
      commandEventCharacteristic = characteristic;
      statusDiv.textContent = "\nStatus: Command/Event Characteristic found.";
      console.log('Command/Event Characteristic found:', commandEventCharacteristic);
      startButton.disabled = false;
      stopButton.disabled = true;
      disconnectButton.disabled = false;
      prunusButton.disabled = true;
      statusDiv.textContent = "\nStatus: Ready to start data stream (press 'Start Data Stream').";
    })
    .catch(error => {
      console.error('Connection error:', error);
      statusDiv.textContent += "\nError: Connection failed: " + (error.message || error);
      startButton.disabled = true;
      stopButton.disabled = true;
      disconnectButton.disabled = true;
      prunusButton.disabled = true;
    });
}

// Global notification handler (for messages like "rdy")
function handleNotifications(event) {
  const value = event.target.value;
  const decodedStringUTF8 = new TextDecoder('utf-8').decode(value);
  let cleanedData = decodedStringUTF8.replace(/\0/g, '').trim();

  // Remove first character if it isn't alphanumeric
  if (cleanedData.length > 0 && !/[a-zA-Z0-9]/.test(cleanedData.charAt(0))) {
    cleanedData = cleanedData.substring(1);
  }

  setTimeout(() => {
    // Process "rdy" only if not expecting sensor data and no sensor data is displayed.
    if (cleanedData === "rdy" && !expectingSensorData && !sensorDataDisplayed) {
      statusDiv.textContent += "\nStatus: Hub is ready and waiting for command.";
      sensorDataDiv.textContent = "Hub Ready.";
      hubReadyReceived = true;
      prunusButton.disabled = false;
      return;
    }
    console.log("Ignoring spurious notification:", cleanedData);
  }, 0);
}

// Start the data stream and add the notification handler
function startDataStream() {
  statusDiv.textContent += "\nStatus: Starting data stream...";
  startButton.disabled = true;
  stopButton.disabled = false;
  prunusButton.disabled = true;
  sensorDataDiv.textContent = "Data stream started. Waiting for Hub to be ready...";
  dataStreamActive = true;
  expectingSensorData = false;
  sensorDataDisplayed = false; // Reset sensor data flag
  ignoreFirstNotification = true; // Optionally ignore first notification

  console.log("startDataStream FUNCTION CALLED");
  console.log("Starting notifications on Command/Event characteristic...", commandEventCharacteristic);

  if (!commandEventCharacteristic) {
    console.error("Characteristic is not available. Cannot start notifications.");
    statusDiv.textContent += "\nError: Characteristic unavailable.";
    return;
  }

  commandEventCharacteristic.startNotifications()
    .then(() => {
      statusDiv.textContent = "\nStatus: Data stream started (Command/Event Char).";
      console.log('Data stream started successfully.');
      statusDiv.textContent += "\nStatus: Waiting for 'rdy' message from hub...";
      // Remove any previous listener to avoid duplicates.
      commandEventCharacteristic.removeEventListener('characteristicvaluechanged', handleNotifications);
      commandEventCharacteristic.addEventListener('characteristicvaluechanged', handleNotifications);
      console.log('Event listener added for characteristicvaluechanged.');
    })
    .catch(error => {
      console.error('Error starting data stream:', error);
      statusDiv.textContent += "\nError starting data stream: " + (error.message || error);
      startButton.disabled = false;
      stopButton.disabled = true;
      prunusButton.disabled = true;
      dataStreamActive = false;
      expectingSensorData = false;
      ignoreFirstNotification = false;
    });
}

// Stop the data stream and remove the notification listener
function stopDataStream() {
  statusDiv.textContent += "\nStatus: Stopping data stream.";
  startButton.disabled = false;
  stopButton.disabled = true;
  prunusButton.disabled = true;
  sensorDataDiv.textContent = "Data stream stopped. Press 'Start Data Stream' to begin.";
  dataStreamActive = false;
  expectingSensorData = false;
  ignoreFirstNotification = false;

  if (!commandEventCharacteristic) {
    console.warn("Characteristic is not available. Data stream may already be stopped.");
    return;
  }

  commandEventCharacteristic.stopNotifications()
    .then(() => {
      commandEventCharacteristic.removeEventListener('characteristicvaluechanged', handleNotifications);
      statusDiv.textContent += "\nStatus: Data stream stopped (Command/Event Char).";
      console.log('Data stream stopped.');
    })
    .catch(error => {
      console.error('Error stopping data stream:', error);
      statusDiv.textContent += "\nError stopping data stream: " + (error.message || error);
      startButton.disabled = false;
      stopButton.disabled = true;
      prunusButton.disabled = true;
      dataStreamActive = false;
      expectingSensorData = false;
      ignoreFirstNotification = false;
    });
}

// Disconnect from the GATT server and clean up
function disconnectGATT() {
  statusDiv.textContent += "\nStatus: Disconnecting from hub...";
  startButton.disabled = true;
  stopButton.disabled = true;
  disconnectButton.disabled = true;
  prunusButton.disabled = true;
  dataStreamActive = false;
  expectingSensorData = false;
  ignoreFirstNotification = false;
  sensorDataDiv.textContent = "Data stream stopped. FIRST RUN THE PROGRAM ON HUB";

  if (commandEventCharacteristic) {
    commandEventCharacteristic.removeEventListener('characteristicvaluechanged', handleNotifications);
  }

  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
    statusDiv.textContent += "\nStatus: Disconnected from hub.";
    console.log('Disconnected from hub.');
  } else {
    statusDiv.textContent += "\nStatus: No device connected.";
    console.log('No device connected.');
  }
  connectButton.disabled = false;
  startButton.disabled = true;
  stopButton.disabled = true;
  disconnectButton.disabled = true;
  prunusButton.disabled = true;
  bluetoothDevice = null;
  commandEventCharacteristic = null;
}

/* === Gemini API (Spectroscopic Analyzer) Integration Using fetch === */

// Function to analyze sensor data using fetch to call the Gemini API
async function analyzeSpectroscopicData(sensorData) {
  statusDiv.textContent += "\nStatus: Getting analysis from Gemini API...";

  // First, display the raw sensor data.
  sensorDataDiv.textContent = `Sensor Data:
Hue: ${sensorData.hue}
Saturation: ${sensorData.saturation}
Color Value: ${sensorData.colorValue}
Reflection: ${sensorData.reflection}
Ambient Light: ${sensorData.ambient}

Getting analysis from Gemini API...`;

  // Replace with your actual Gemini API key.
  const API_KEY = 'AIzaSyDLQTdDePYDPB2UwBYdRRzl9wOqGHponIA';
  // Using the "pro" model; adjust the model name if needed.
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  // Construct the prompt.
  const prompt = `Analiză scurtă ,!!IMPORTAN!! nu uita că datele primite sunt dela un senzor depe drona de cercetare a fundului oceanului și datele pot fi un pic deviate,încercă să le recuperezi(NU UTILIZA MULT SPATII FOARTE SUCCINT SI NU UITA DE ANALIZA DE METALE SI COMPOZITIE NU SCHIMBA TEMELE NU FA NIMI INAFARA DE ANALIZA ) și structurată a datelor spectroscopice pentru sol marin de la fundul oceanului (submarin) si compozitia solului. Interpretează concis fiecare parametru.

**Nuanță (Hue):** Interpretare scurtă pentru sol marin.
**Saturație (Saturation):** Interpretare scurtă pentru sol marin.
**Valoare Culoare (Color Value):** Interpretare scurtă pentru sol marin.
**Reflecție (Reflection):** Interpretare scurtă pentru sol marin.
**Lumină Ambientală (Ambient Light):** Interpretare scurtă pentru mediu subacvatic.

**Rezumat Sol Marin & Condiții Oceanice:** Concluzii scurte despre compoziția solului(compozitie concreta indicand elementele) și condițiile oceanice.

Date Senzor:
Hue: ${sensorData.hue}
Saturation: ${sensorData.saturation}
Color Value: ${sensorData.colorValue}
Reflection: ${sensorData.reflection}
Ambient Light: ${sensorData.ambient}

Date Senzor:
Hue: ${sensorData.hue}
Saturation: ${sensorData.saturation}
Color Value: ${sensorData.colorValue}
Reflection: ${sensorData.reflection}
Ambient Light: ${sensorData.ambient}
  
Hue: ${sensorData.hue}
Saturation: ${sensorData.saturation}
Color Value: ${sensorData.colorValue}
Reflection: ${sensorData.reflection}
Ambient Light: ${sensorData.ambient}`;

  // Build the payload.
  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    const analysisText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    // Append the Gemini API analysis below the sensor data.
    sensorDataDiv.textContent += "\n\nSpectroscopic Analysis:\n" + (analysisText || "No analysis text received.");
    console.log("Gemini API analysis:", analysisText);
  } catch (error) {
    console.error("Gemini API Error:", error);
    sensorDataDiv.textContent += "\n\nError during spectroscopic analysis: " + (error.message || error);
  }
}

// Function to send the "prunus" command and then handle sensor data
function sendPrunusCommand() {
  let sensorBuffer = '';
  
  // Temporary handler to capture sensor data for analysis
  function handleSensorData(event) {
    const value = event.target.value;
    const data = new Uint8Array(value.buffer);
    let decoded;
    try {
      // If the first byte indicates a stdout message (0x01), skip it.
      if (data[0] === 0x01) {
        decoded = new TextDecoder('utf-8').decode(data.slice(1));
      } else {
        decoded = new TextDecoder('utf-8').decode(data);
      }
    } catch (error) {
      console.error('Decoding error:', error);
      return;
    }
  
    // Append to the buffer and process complete lines
    sensorBuffer += decoded;
    const messages = sensorBuffer.split('\n');
    if (messages.length > 1) {
      // Keep any incomplete message in the buffer
      sensorBuffer = messages.pop();
      messages.forEach(message => {
        message = message.trim();
        // Look for messages starting with "NaVi" that contain sensor data
        if (message.startsWith('NaVi')) {
          const dataStr = message.substring(4).trim();
          const parts = dataStr.split(',');
          if (parts.length === 5) {
            const [hue, saturation, colorValue, reflection, ambient] = parts;
            const naviData = { hue, saturation, colorValue, reflection, ambient };
            // Call the Gemini API analyzer function (using fetch)
            analyzeSpectroscopicData(naviData);
          } else {
            sensorDataDiv.textContent = `Invalid sensor data format: ${message}`;
          }
        }
      });
    }
  }
  
  // Clear previous data and wait for sensor data
  sensorDataDiv.textContent = "Waiting for sensor data...";
  
  // Switch the characteristic event handler temporarily
  commandEventCharacteristic.removeEventListener('characteristicvaluechanged', handleNotifications);
  commandEventCharacteristic.addEventListener('characteristicvaluechanged', handleSensorData);
  
  // Prepare and send the prunus command (with appropriate encoding)
  const encoder = new TextEncoder();
  const command = new Uint8Array([0x06, ...encoder.encode('prunus')]);
  
  commandEventCharacteristic.writeValue(command)
    .then(() => {
      statusDiv.textContent += "\nStatus: 'prunus' command sent successfully";
      // After a short delay, restore the original notification handler
      setTimeout(() => {
        commandEventCharacteristic.removeEventListener('characteristicvaluechanged', handleSensorData);
        commandEventCharacteristic.addEventListener('characteristicvaluechanged', handleNotifications);
      }, 2000);
    })
    .catch(error => {
      console.error('Send error:', error);
      statusDiv.textContent += "\nError sending command: " + (error.message || error);
    });
}

// INITIAL UI SETUP
sensorDataDiv.textContent = "FIRST RUN THE PROGRAM ON HUB";
startButton.disabled = true;
stopButton.disabled = true;
prunusButton.disabled = true;
disconnectButton.disabled = true;
