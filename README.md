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
