# IoT Smart Light Control System

An IoT-based smart light control system using **ESP32**, **Supabase**, and a web-based control interface. The system allows four lights to be controlled remotely through the web application as well as locally using physical push buttons.

The ESP32 communicates with Supabase using both **REST API** and **Realtime WebSocket**, allowing light states to stay synchronized between the hardware, database, and web application.

---

## Features

* Control up to **4 lights/relays**
* Remote light control through the web application
* Local control using physical push buttons
* Real-time synchronization using **Supabase Realtime**
* REST API communication with Supabase
* Automatic Wi-Fi reconnection
* Offline operation for physical buttons
* Pending changes are synchronized after reconnecting
* Automatic fallback polling when Realtime is unavailable
* Active-Low relay support
* Hardware testing mode
* Supabase connection testing
* Serial monitor commands
* System status and free heap monitoring

---

## System Architecture

```text
              ┌─────────────────────┐
              │    Web Application  │
              │   Remote Control    │
              └──────────┬──────────┘
                         │
                         │ REST / Realtime
                         ▼
              ┌─────────────────────┐
              │      Supabase       │
              │                     │
              │   lights table      │
              └──────────┬──────────┘
                         │
                 Wi-Fi / Internet
                         │
                         ▼
              ┌─────────────────────┐
              │        ESP32        │
              │                     │
              │  REST API Client    │
              │  WebSocket Client   │
              │  State Management   │
              └──────┬───────┬──────┘
                     │       │
              Physical      GPIO
              Buttons        │
                     │       ▼
                     │   ┌──────────┐
                     └──►│  Relays  │
                         │ / LEDs   │
                         └──────────┘
```

---

## Hardware Requirements

* ESP32 development board
* 4 × Relay modules or LEDs
* 4 × Push buttons
* Jumper wires
* Breadboard or suitable circuit
* 5V power supply if using relay modules
* Wi-Fi network

---

## Pin Configuration

### Relay / LED Pins

| Light   | ESP32 GPIO |
| ------- | ---------- |
| Light 1 | GPIO 13    |
| Light 2 | GPIO 14    |
| Light 3 | GPIO 26    |
| Light 4 | GPIO 33    |

### Button Pins

| Button   | ESP32 GPIO |
| -------- | ---------- |
| Button 1 | GPIO 15    |
| Button 2 | GPIO 16    |
| Button 3 | GPIO 17    |
| Button 4 | GPIO 18    |

The buttons use the ESP32's internal `INPUT_PULLUP` configuration.

---

## Software Requirements

* Arduino IDE
* ESP32 board support for Arduino
* A Supabase project
* Wi-Fi network
* The following Arduino libraries:

```text
WiFi
WiFiClientSecure
HTTPClient
WebSocketsClient
ArduinoJson
```

---

## Supabase Database

The ESP32 expects a table named:

```text
lights
```

with the following basic structure:

| Column   | Type    | Description            |
| -------- | ------- | ---------------------- |
| `id`     | integer | Light identifier (1–4) |
| `status` | boolean | Current ON/OFF state   |

Example:

| id | status |
| -: | :----: |
|  1 |  false |
|  2 |  false |
|  3 |  false |
|  4 |  false |

The ESP32 reads the light states from Supabase and updates the database whenever a local button changes a light.

---

## Configuration
Esp32 Source code:
```cpp
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "Shaharia";
const char* WIFI_PASSWORD = "/effect @s nausea";

const char* SUPABASE_HOST = "lnoqfxycsgfgabkbmfgc.supabase.co";
const char* SUPABASE_URL  = "https://lnoqfxycsgfgabkbmfgc.supabase.co";
const char* SUPABASE_KEY  = "sb_publishable_u9NDClqOlfz4SEo2FP3zNA_l-RFl4z1";

const int ledPins[4] = {13, 14, 26, 33};
const int btnPins[4] = {15, 16, 17, 18};

const uint16_t HTTP_TIMEOUT_MS = 4000;

const bool RELAY_ACTIVE_LOW = true;

inline void writeLight(int idx, bool on) {
  digitalWrite(ledPins[idx], (on != RELAY_ACTIVE_LOW) ? HIGH : LOW);
}

WiFiClientSecure secureClient;
WebSocketsClient webSocket;

bool wsJoined = false;
unsigned long refCounter = 1;
unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 25000;

unsigned long lastFallbackPoll = 0;
const unsigned long fallbackPollInterval = 60000;

bool lightStates[4]     = {false, false, false, false};
bool lastSyncedState[4] = {false, false, false, false};
unsigned long lastHeapPrint = 0;

volatile bool wifiJustReconnected = false;
bool wifiWasConnected = false;
unsigned long lastWifiAttempt = 0;
const unsigned long wifiRetryInterval = 12000;

unsigned long lastPendingSyncAttempt = 0;
const unsigned long pendingSyncInterval = 10000;

volatile unsigned long lastEdgeTime[4] = {0, 0, 0, 0};
bool confirmedPressed[4] = {false, false, false, false};
const unsigned long debounceMs = 40;

void IRAM_ATTR handleButtonISR(void* arg) {
  int id = (int)(intptr_t)arg;
  lastEdgeTime[id] = millis();
}

void pushLightState(int id);
void fetchFromSupabase();
void pushPendingSync();
void processButtonPress(int id);
void processSerialCommand(String command);
void manageWiFi();
void onWiFiEvent(WiFiEvent_t event);
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length);
void joinRealtimeChannel();
void sendHeartbeat();
void applyRemoteLightUpdate(int id, bool status);
void testMode();
void testSupabaseConnection();

void setup() {
  Serial.begin(115200);
  delay(100);

  for (int i = 0; i < 4; i++) {
    pinMode(ledPins[i], OUTPUT);
    writeLight(i, false);
  }

  for (int i = 0; i < 4; i++) {
    pinMode(btnPins[i], INPUT_PULLUP);
    attachInterruptArg(digitalPinToInterrupt(btnPins[i]), handleButtonISR,
                        (void*)(intptr_t)i, CHANGE);
  }

  secureClient.setInsecure();

  Serial.println("\n==========================================");
  Serial.println("   ESP32 - Supabase Realtime Light Controller");
  Serial.println("==========================================");
  Serial.println("\n📌 LED/Relay Pins: 13, 14, 26, 33");
  Serial.println("📌 Button Pins: 15, 16, 17, 18\n");

  WiFi.onEvent(onWiFiEvent);
  WiFi.mode(WIFI_STA);
  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 10) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Wi-Fi Connected!");
    Serial.print("📡 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n⏳ Wi-Fi not up yet - will keep retrying in the background.");
    Serial.println("   Buttons and LEDs work locally regardless.");
  }
  lastWifiAttempt = millis();

  if (WiFi.status() == WL_CONNECTED) {
    delay(500);
    fetchFromSupabase();
    for (int i = 0; i < 4; i++) lastSyncedState[i] = lightStates[i];
  }
  wifiWasConnected = (WiFi.status() == WL_CONNECTED);
  lastPendingSyncAttempt = millis();

  String wsPath = "/realtime/v1/websocket?apikey=" + String(SUPABASE_KEY) + "&vsn=1.0.0";
  webSocket.beginSSL(SUPABASE_HOST, 443, wsPath.c_str());
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(4000);

  Serial.println("\n==========================================");
  Serial.println("📋 Commands: L1 L2 L3 L4 | FETCH | STATUS | HEAP | HELP | TEST");
  Serial.println("==========================================\n");
}

void loop() {
  unsigned long currentMillis = millis();

  manageWiFi();

  bool wifiNowConnected = (WiFi.status() == WL_CONNECTED);
  if (wifiNowConnected && !wifiWasConnected) {
    wifiJustReconnected = true;
  }
  wifiWasConnected = wifiNowConnected;

  if (wifiJustReconnected) {
    wifiJustReconnected = false;
    Serial.println("🔄 WiFi back up - syncing with Supabase...");
    pushPendingSync();
    fetchFromSupabase();
    lastPendingSyncAttempt = currentMillis;
  }

  if (wifiNowConnected && currentMillis - lastPendingSyncAttempt >= pendingSyncInterval) {
    lastPendingSyncAttempt = currentMillis;
    pushPendingSync();
  }

  webSocket.loop();

  if (wsJoined && currentMillis - lastHeartbeat >= heartbeatInterval) {
    lastHeartbeat = currentMillis;
    sendHeartbeat();
  }

  for (int i = 0; i < 4; i++) {
    unsigned long lastEdge;
    noInterrupts();
    lastEdge = lastEdgeTime[i];
    interrupts();

    if (currentMillis - lastEdge >= debounceMs) {
      bool levelLow = (digitalRead(btnPins[i]) == LOW);
      if (levelLow && !confirmedPressed[i]) {
        confirmedPressed[i] = true;
        processButtonPress(i);
      } else if (!levelLow && confirmedPressed[i]) {
        confirmedPressed[i] = false;
      }
    }
  }

  if (!wsJoined && WiFi.status() == WL_CONNECTED &&
      currentMillis - lastFallbackPoll >= fallbackPollInterval) {
    lastFallbackPoll = currentMillis;
    Serial.println("⏳ Realtime not joined - falling back to REST poll");
    pushPendingSync();
    fetchFromSupabase();
  }

  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    processSerialCommand(command);
  }

  if (currentMillis - lastHeapPrint >= 30000) {
    lastHeapPrint = currentMillis;
    Serial.printf("💾 Free heap: %u bytes | WS joined: %s | WiFi: %s\n",
                  ESP.getFreeHeap(),
                  wsJoined ? "yes" : "no",
                  WiFi.status() == WL_CONNECTED ? "connected" : "disconnected");
  }
}

void onWiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.print("\n✅ WiFi (re)connected! IP: ");
      Serial.println(WiFi.localIP());
      wifiJustReconnected = true;
      break;

    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.println("⚠️ WiFi lost connection - will keep retrying, buttons still work.");
      wsJoined = false;
      break;

    default:
      break;
  }
}

void manageWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWifiAttempt >= wifiRetryInterval) {
    lastWifiAttempt = now;
    Serial.printf("📶 WiFi status=%d, attempting reconnect...\n", WiFi.status());
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("🔌 Realtime WebSocket connected");
      joinRealtimeChannel();
      break;

    case WStype_DISCONNECTED:
      Serial.println("🔌 Realtime WebSocket disconnected");
      wsJoined = false;
      break;

    case WStype_TEXT: {
      DynamicJsonDocument doc(1024);
      DeserializationError err = deserializeJson(doc, payload, length);
      if (err) {
        Serial.printf("❌ WS JSON parse error: %s\n", err.c_str());
        return;
      }

      const char* event = doc["event"] | "";

      if (strcmp(event, "phx_reply") == 0) {
        const char* status = doc["payload"]["status"] | "";
        if (strcmp(status, "ok") == 0) {
          Serial.println("✅ Realtime channel joined");
          wsJoined = true;
          pushPendingSync();
          fetchFromSupabase();
        } else {
          Serial.println("❌ Realtime join failed - check RLS policy on 'lights' table");
        }
      }
      else if (strcmp(event, "postgres_changes") == 0) {
        JsonObject record = doc["payload"]["data"]["record"];
        if (!record.isNull()) {
          int id = record["id"] | -1;
          bool status = record["status"] | false;
          if (id >= 1 && id <= 4) {
            applyRemoteLightUpdate(id, status);
          }
        }
      }
      break;
    }

    default:
      break;
  }
}

void joinRealtimeChannel() {
  DynamicJsonDocument doc(512);
  doc["topic"] = "realtime:public:lights";
  doc["event"] = "phx_join";
  JsonObject config = doc["payload"].createNestedObject("config");
  JsonArray changes = config.createNestedArray("postgres_changes");
  JsonObject change = changes.createNestedObject();
  change["event"] = "*";
  change["schema"] = "public";
  change["table"] = "lights";
  doc["ref"] = String(refCounter++);

  String out;
  serializeJson(doc, out);
  webSocket.sendTXT(out);
  Serial.println("📤 Joining realtime:public:lights ...");
}

void sendHeartbeat() {
  DynamicJsonDocument doc(128);
  doc["topic"] = "phoenix";
  doc["event"] = "heartbeat";
  doc.createNestedObject("payload");
  doc["ref"] = String(refCounter++);

  String out;
  serializeJson(doc, out);
  webSocket.sendTXT(out);
}

void applyRemoteLightUpdate(int id, bool status) {
  int idx = id - 1;
  bool changed = (lightStates[idx] != status);
  lightStates[idx] = status;
  lastSyncedState[idx] = status;
  writeLight(idx, status);
  if (changed) {
    Serial.printf("📥 Light %d synced (realtime): %s\n", id, status ? "ON" : "OFF");
  }
}

void processButtonPress(int id) {
  if (id < 0 || id > 3) return;

  lightStates[id] = !lightStates[id];
  writeLight(id, lightStates[id]);

  Serial.printf("🔘 Button %d pressed - Toggling to %s (GPIO %d)\n",
                id + 1, lightStates[id] ? "ON" : "OFF", ledPins[id]);

  pushLightState(id + 1);
}

void pushLightState(int id) {
  int idx = id - 1;
  bool desired = lightStates[idx];

  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("📴 Offline - Light %d change queued, will sync when back online\n", id);
    return;
  }

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/lights?id=eq." + String(id);

  http.begin(secureClient, url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  String payload = String("{\"status\":") + (desired ? "true" : "false") + "}";
  int httpCode = http.sendRequest("PATCH", payload);

  if (httpCode >= 200 && httpCode < 300) {
    lastSyncedState[idx] = desired;
    Serial.printf("📥 HTTP %d - Light %d set to %s confirmed in DB\n", httpCode, id, desired ? "ON" : "OFF");
  } else if (httpCode > 0) {
    Serial.printf("❌ HTTP %d rejected Light %d update: %s\n", httpCode, id, http.getString().c_str());
    Serial.printf("📴 Light %d still pending - will retry\n", id);
  } else {
    Serial.printf("❌ Connection error: %d (%s)\n", httpCode, http.errorToString(httpCode).c_str());
    Serial.printf("📴 Light %d change queued, will retry\n", id);
  }

  http.end();
}

void pushPendingSync() {
  if (WiFi.status() != WL_CONNECTED) return;

  for (int i = 0; i < 4; i++) {
    if (lightStates[i] != lastSyncedState[i]) {
      Serial.printf("🔁 Pushing pending sync for Light %d\n", i + 1);
      pushLightState(i + 1);
    }
  }
}

void fetchFromSupabase() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/lights?select=id,status&order=id.asc";

  http.begin(secureClient, url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));

  int httpCode = http.GET();
  if (httpCode >= 200 && httpCode < 300) {
    String payload = http.getString();
    DynamicJsonDocument doc(1024);
    if (!deserializeJson(doc, payload)) {
      for (JsonObject obj : doc.as<JsonArray>()) {
        int id = obj["id"];
        bool status = obj["status"];
        int idx = id - 1;
        if (idx >= 0 && idx < 4 && lightStates[idx] != lastSyncedState[idx]) {
          continue;
        }
        if (id >= 1 && id <= 4) applyRemoteLightUpdate(id, status);
      }
      Serial.println("✅ State fetched from Supabase");
    }
  } else {
    Serial.printf("❌ Fallback fetch HTTP error: %d\n", httpCode);
  }
  http.end();
}

void testMode() {
  Serial.println("\n╔═══════════════════════════════════════════╗");
  Serial.println("║         🔧 TEST MODE STARTED            ║");
  Serial.println("╚═══════════════════════════════════════════╝\n");

  Serial.println("📌 TEST 1: LED Test");
  Serial.println("   LED 1 (GPIO13) → ON");
  writeLight(0, true);
  delay(1000);
  Serial.println("   LED 1 (GPIO13) → OFF");
  writeLight(0, false);

  for (int i = 0; i < 4; i++) {
    Serial.printf("   LED %d (GPIO%d) → ON\n", i+1, ledPins[i]);
    writeLight(i, true);
    delay(800);
    Serial.printf("   LED %d (GPIO%d) → OFF\n", i+1, ledPins[i]);
    writeLight(i, false);
    delay(200);
  }

  Serial.println("\n📌 TEST 2: All LEDs ON");
  for (int i = 0; i < 4; i++) {
    writeLight(i, true);
  }
  delay(2000);
  Serial.println("   All LEDs OFF");
  for (int i = 0; i < 4; i++) {
    writeLight(i, false);
  }

  Serial.println("\n📌 TEST 3: Button Test");
  Serial.println("   Press each button within 5 seconds...");
  for (int i = 0; i < 4; i++) {
    Serial.printf("   Waiting for Button %d (GPIO%d): ", i+1, btnPins[i]);
    unsigned long start = millis();
    bool pressed = false;
    while (millis() - start < 5000) {
      if (digitalRead(btnPins[i]) == LOW) {
        pressed = true;
        writeLight(i, true);
        break;
      }
    }
    if (pressed) {
      Serial.println("✅ Pressed!");
    } else {
      Serial.println("❌ No press detected");
    }
    writeLight(i, false);
  }

  Serial.println("\n╔═══════════════════════════════════════════╗");
  Serial.println("║         ✅ TEST MODE COMPLETE           ║");
  Serial.println("╚═══════════════════════════════════════════╝\n");
}

void testSupabaseConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Not connected to Wi-Fi. Cannot test Supabase.");
    return;
  }

  Serial.println("\n🌐 Testing Supabase Connection...");

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/lights?limit=1";

  http.begin(secureClient, url);
  http.setTimeout(5000);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));

  int httpCode = http.GET();
  Serial.printf("📡 HTTP Response Code: %d\n", httpCode);

  if (httpCode > 0) {
    String response = http.getString();
    int maxLen = 200;
    int respLen = response.length();
    int printLen = (maxLen < respLen) ? maxLen : respLen;
    String truncatedResponse = response.substring(0, printLen);
    Serial.println("📥 Response: " + truncatedResponse);
    if (httpCode == 200) {
      Serial.println("✅ Supabase connection successful!");
    } else {
      Serial.println("❌ Supabase returned error. Check your API key and table permissions.");
    }
  } else {
    Serial.printf("❌ HTTP Error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  Serial.println();
}

void processSerialCommand(String command) {
  command.trim();
  command.toUpperCase();

  if (command == "L1") {
    processButtonPress(0);
  }
  else if (command == "L2") {
    processButtonPress(1);
  }
  else if (command == "L3") {
    processButtonPress(2);
  }
  else if (command == "L4") {
    processButtonPress(3);
  }
  else if (command == "FETCH") {
    fetchFromSupabase();
  }
  else if (command == "TEST") {
    testMode();
  }
  else if (command == "SUPABASE" || command == "DBTEST") {
    testSupabaseConnection();
  }
  else if (command == "HEAP") {
    Serial.printf("💾 Free heap: %u bytes\n", ESP.getFreeHeap());
  }
  else if (command == "STATUS") {
    Serial.println("\n📊 System Status:");
    Serial.printf("   WiFi: %s\n", WiFi.status() == WL_CONNECTED ? "✅ Connected" : "❌ Disconnected");
    Serial.printf("   IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("   WebSocket: %s\n", wsJoined ? "✅ Connected" : "❌ Disconnected");
    Serial.printf("   Free Heap: %u bytes\n", ESP.getFreeHeap());
    Serial.printf("   Uptime: %lu seconds\n", millis() / 1000);
    Serial.println("   LED States:");
    for (int i = 0; i < 4; i++) {
      bool pending = (lightStates[i] != lastSyncedState[i]);
      Serial.printf("      Light %d (GPIO %d): %s%s\n", i+1, ledPins[i],
                    lightStates[i] ? "ON" : "OFF", pending ? "  (pending sync)" : "");
    }
    Serial.println();
  }
  else if (command == "HELP") {
    Serial.println("\n╔═══════════════════════════════════════════╗");
    Serial.println("║         📋 AVAILABLE COMMANDS            ║");
    Serial.println("╚═══════════════════════════════════════════╝");
    Serial.println("  L1, L2, L3, L4  → Toggle light 1-4");
    Serial.println("  FETCH            → Force fetch from Supabase");
    Serial.println("  TEST             → Run hardware test mode");
    Serial.println("  SUPABASE         → Test Supabase connection");
    Serial.println("  STATUS           → Show system status");
    Serial.println("  HEAP             → Show free memory");
    Serial.println("  HELP             → Show this help");
    Serial.println("═══════════════════════════════════════════\n");
  }
  else if (command.length() > 0) {
    Serial.println("❌ Unknown command. Type 'HELP' for available commands.");
  }
}
```
Open the ESP32 source code and update the Wi-Fi configuration:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
```

Configure the Supabase project:

```cpp
const char* SUPABASE_HOST = "YOUR_PROJECT.supabase.co";
const char* SUPABASE_URL  = "https://YOUR_PROJECT.supabase.co";
const char* SUPABASE_KEY  = "YOUR_SUPABASE_KEY";
```

The relay logic is configured using:

```cpp
const bool RELAY_ACTIVE_LOW = true;
```

Set this to `false` if your relay module uses active-HIGH logic.

> **Security:** Do not commit real Wi-Fi passwords or private Supabase credentials to a public GitHub repository. Use placeholders in the source before publishing the project.

---

## How It Works

### 1. Local Button Control

When a physical button is pressed:

```text
Button Press
     ↓
ESP32 detects interrupt
     ↓
Debounce validation
     ↓
Light state toggles locally
     ↓
Relay / LED changes immediately
     ↓
New state is sent to Supabase
```

Local control does not depend on the internet. The ESP32 changes the physical light immediately even when Wi-Fi is unavailable.

---

### 2. Remote Control

When a light is changed from the web application:

```text
Web Application
      ↓
Supabase Database
      ↓
Supabase Realtime
      ↓
ESP32 WebSocket
      ↓
Physical Light
```

The ESP32 receives the updated `id` and `status` and applies the change to the corresponding relay/LED.

---

### 3. Offline Synchronization

If Wi-Fi is disconnected and a physical button is pressed:

```text
Button Press
     ↓
Local Light State Changes
     ↓
Change remains Pending
     ↓
Wi-Fi Reconnects
     ↓
Pending State Sent to Supabase
     ↓
Database Synchronized
```

The ESP32 keeps track of:

* Current local light state
* Last state confirmed by Supabase

This allows it to identify changes that still need synchronization.

---

## REST API Communication

The ESP32 uses Supabase's REST API to read and update light states.

### Fetch states

```http
GET /rest/v1/lights?select=id,status&order=id.asc
```

### Update a light

```http
PATCH /rest/v1/lights?id=eq.1
```

Example request body:

```json
{
  "status": true
}
```

The project uses an explicit boolean state instead of a database toggle operation. This makes repeated synchronization safer because sending the same desired state multiple times produces the same result.

---

## Supabase Realtime

The ESP32 connects to Supabase using a secure WebSocket connection.

It subscribes to changes on:

```text
public.lights
```

When a database change occurs, Supabase sends the updated record to the ESP32.

The ESP32 then updates the corresponding physical light.

A heartbeat is also sent periodically to maintain the Phoenix Realtime connection.

---

## Wi-Fi Reconnection

The system is designed to continue operating even when Wi-Fi is temporarily unavailable.

The ESP32:

* Detects Wi-Fi disconnection
* Continues allowing physical button control
* Periodically attempts reconnection
* Detects when Wi-Fi comes back
* Pushes pending local changes
* Fetches the latest database state

This prevents temporary network failures from stopping local light control.

---

## Realtime Fallback

If the WebSocket connection is unavailable, the ESP32 periodically uses REST polling as a fallback.

```text
Realtime Connected
       │
       ▼
Receive live updates
       
Realtime Unavailable
       │
       ▼
REST polling
       │
       ▼
Fetch latest light states
```

This provides another way to synchronize the hardware with Supabase.

---

## Serial Monitor Commands

Open the Arduino Serial Monitor at:

```text
115200 baud
```

Available commands:

| Command    | Function                           |
| ---------- | ---------------------------------- |
| `L1`       | Toggle Light 1                     |
| `L2`       | Toggle Light 2                     |
| `L3`       | Toggle Light 3                     |
| `L4`       | Toggle Light 4                     |
| `FETCH`    | Fetch current states from Supabase |
| `TEST`     | Run hardware test                  |
| `SUPABASE` | Test Supabase connection           |
| `DBTEST`   | Test Supabase connection           |
| `STATUS`   | Display system status              |
| `HEAP`     | Display free memory                |
| `HELP`     | Display available commands         |

Example:

```text
L1
```

toggles Light 1.

---

## Hardware Test Mode

The project includes a test mode for checking the connected LEDs/relays and buttons.

The test mode can be enabled in `setup()`:

```cpp
// testMode();
```

Change it to:

```cpp
testMode();
```

The test performs:

1. Individual LED/relay testing
2. All-light testing
3. Physical button testing

---

## Supabase Connection Test

The project also includes a dedicated Supabase connection test.

Use the Serial Monitor command:

```text
SUPABASE
```

or:

```text
DBTEST
```

The ESP32 will attempt to access the `lights` table and display the HTTP response.

---

## Project Workflow

```text
                    START
                      │
                      ▼
               Initialize ESP32
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
    Initialize GPIO          Connect Wi-Fi
          │                       │
          │                       ▼
          │                Connect WebSocket
          │                       │
          ▼                       ▼
     Read Buttons           Join Realtime
          │                       │
          └───────────┬───────────┘
                      │
                      ▼
                  Main Loop
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
       Buttons    WebSocket    Wi-Fi
          │           │           │
          ▼           ▼           ▼
       Toggle      Receive      Reconnect
        Light      Updates         │
          │           │             ▼
          ▼           │        Sync Pending
     Update DB        │          Changes
                      │
                      ▼
                 Update Light
```

---

## Reliability Features

The project includes several mechanisms to improve reliability:

* **Interrupt-based button detection**
* **40 ms button debounce**
* **Non-blocking Wi-Fi reconnection**
* **Pending state tracking**
* **Automatic synchronization after reconnect**
* **Idempotent REST updates**
* **Realtime WebSocket communication**
* **REST fallback polling**
* **Periodic WebSocket heartbeat**
* **Free heap monitoring**

---

## Project Structure

A typical project structure can be:

```text
IoT-Smart-Light-Control/
│
├── ESP32/
│   └── ESP32_Light_Controller.ino
│
├── WebApp/
│   └── ...
│
├── README.md
└── Project_Report/
    └── ...
```

---

## Setup Instructions

### Step 1 — Create Supabase Project

Create a Supabase project and create the `lights` table.

Insert four initial records:

```text
1 → false
2 → false
3 → false
4 → false
```

### Step 2 — Configure Realtime

Enable Realtime for the `lights` table so that database changes can be delivered to the ESP32.

### Step 3 — Configure ESP32

Update:

```cpp
WIFI_SSID
WIFI_PASSWORD
SUPABASE_HOST
SUPABASE_URL
SUPABASE_KEY
```

### Step 4 — Install Libraries

Install the required Arduino libraries:

```text
ArduinoJson
WebSockets
```

The Wi-Fi and HTTP libraries are provided with the ESP32 Arduino environment.

### Step 5 — Connect Hardware

Connect the four relays/LEDs and four push buttons according to the GPIO configuration described above.

### Step 6 — Upload

Select the correct ESP32 board and COM port in Arduino IDE and upload the program.

### Step 7 — Monitor

Open Serial Monitor:

```text
Baud Rate: 115200
```

The ESP32 will display its Wi-Fi, WebSocket, synchronization, and system status.

---

## Troubleshooting

### Wi-Fi does not connect

Check:

* SSID is correct
* Password is correct
* ESP32 is within Wi-Fi range
* The network supports the ESP32

The physical buttons and LEDs can still operate even if Wi-Fi is unavailable.

### Relay works in reverse

Change:

```cpp
const bool RELAY_ACTIVE_LOW = true;
```

to:

```cpp
const bool RELAY_ACTIVE_LOW = false;
```

depending on your relay module.

### Realtime does not work

Check:

* Supabase URL
* Supabase API key
* Realtime configuration
* Database permissions/RLS policies
* `lights` table name and schema

The ESP32 will use REST polling as a fallback when the Realtime channel is unavailable.

### Database update fails

Use:

```text
SUPABASE
```

in the Serial Monitor to test the connection.

Also check the HTTP response and Supabase table permissions.

---

## Technologies Used

* **ESP32**
* **Arduino IDE**
* **C/C++**
* **Wi-Fi**
* **HTTP/REST API**
* **WebSocket**
* **Supabase**
* **Supabase Realtime**
* **ArduinoJson**
* **HTML/CSS/JavaScript** for the web interface

---

## Future Improvements

Possible future improvements include:

* User authentication
* Multiple device support
* Device registration
* Energy/power monitoring
* Scheduling and automation
* Mobile-responsive interface improvements
* Device status monitoring
* OTA firmware updates
* Secure credential management
* More advanced automation rules

---

## Author

Developed as an **IoT project for smart light/relay control using ESP32 and Supabase**.

---

## License

This project is intended for educational and academic purposes.
****
