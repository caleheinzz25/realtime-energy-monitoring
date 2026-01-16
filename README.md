# Energy Monitoring Dashboard

Real-time energy monitoring system for Ravelware office with scalable electrical panel support.

## Table of Contents

- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Database Schema (ERD)](#database-schema-erd)
- [REST API Documentation](#rest-api-documentation)
- [MQTT Topics](#mqtt-topics)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Framework** | Next.js 14 (App Router) + TypeScript |
| **Time-Series DB** | InfluxDB 2.x |
| **Relational DB** | PostgreSQL 15 |
| **Message Broker** | Eclipse Mosquitto (MQTT) |
| **ORM** | Prisma |
| **Charts** | Recharts |
| **Styling** | Tailwind CSS |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│                                                                             │
│    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│    │ Panel Status    │  │ Today's Usage   │  │ Energy Chart    │           │
│    │ Cards           │  │ Widget          │  │ (Recharts)      │           │
│    └────────┬────────┘  └────────┬────────┘  └────────┬────────┘           │
│             │                    │                    │                     │
│             └────────────────────┼────────────────────┘                     │
│                                  │                                          │
│                          HTTP/REST API                                      │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────────────────┐
│                          NEXT.JS SERVER                                      │
│                                  │                                          │
│    ┌─────────────────────────────┼─────────────────────────────────────┐    │
│    │                      API Routes (/api/v1)                          │    │
│    │                                                                    │    │
│    │  /panels/realtime    /panels/usage/today    /panels/history       │    │
│    └───────────┬─────────────────┬─────────────────┬───────────────────┘    │
│                │                 │                 │                        │
│    ┌───────────┴─────────────────┴─────────────────┴───────────────────┐    │
│    │                      Business Logic Layer                          │    │
│    │  - calculateTodayUsage()  - getPanelStatus()  - formatRupiah()    │    │
│    └───────────┬─────────────────┬─────────────────┬───────────────────┘    │
│                │                 │                 │                        │
│    ┌───────────┴───────┐ ┌───────┴───────┐ ┌───────┴───────────────────┐    │
│    │   MQTT Client     │ │  InfluxDB     │ │  Prisma (PostgreSQL)     │    │
│    │   (Subscriber)    │ │  Client       │ │  Client                  │    │
│    └─────────┬─────────┘ └───────┬───────┘ └───────────┬───────────────┘    │
│              │                   │                     │                    │
└──────────────┼───────────────────┼─────────────────────┼────────────────────┘
               │                   │                     │
    ┌──────────┴──────────┐  ┌─────┴─────┐  ┌───────────┴───────────┐
    │  MQTT Broker        │  │ InfluxDB  │  │  PostgreSQL           │
    │  (Mosquitto:1883)   │  │ (:8086)   │  │  (:5432)              │
    │                     │  │           │  │                       │
    │  Topic Pattern:     │  │ Bucket:   │  │  Tables:              │
    │  DATA/PM/{PANEL_ID} │  │ energy    │  │  - panels             │
    └──────────┬──────────┘  └───────────┘  │  - energy_summary_*   │
               │                            └───────────────────────┘
    ┌──────────┴──────────┐
    │  Power Meters       │
    │  (IoT Devices)      │
    │                     │
    │  - Panel Lantai 1   │
    │  - Panel Lantai 2   │
    │  - Panel Lantai 3   │
    │  - ... (scalable)   │
    └─────────────────────┘
```

### Data Flow

1. **Power Meters** → Publish data ke MQTT broker (`DATA/PM/{PANEL_CODE}`)
2. **MQTT Client** → Subscribe & receive data, write ke InfluxDB + update PostgreSQL
3. **API Routes** → Query data dari InfluxDB & PostgreSQL
4. **Frontend** → Fetch via REST API, render dengan Recharts

---

## Database Schema (ERD)

### PostgreSQL (Relational - Panel Metadata)

```
┌─────────────────────────────────────────────────────────────┐
│                          panels                              │
├─────────────────────────────────────────────────────────────┤
│ id              │ INT           │ PK, Auto Increment        │
│ panelCode       │ VARCHAR(50)   │ UNIQUE, NOT NULL          │
│ location        │ VARCHAR(100)  │ NOT NULL                  │
│ floor           │ INT           │ NOT NULL, DEFAULT 1       │
│ status          │ VARCHAR(20)   │ DEFAULT 'OFFLINE'         │
│ lastOnline      │ TIMESTAMP     │ NULL                      │
│ createdAt       │ TIMESTAMP     │ DEFAULT NOW()             │
│ updatedAt       │ TIMESTAMP     │ AUTO UPDATE               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    energy_summary_daily                      │
├─────────────────────────────────────────────────────────────┤
│ id              │ INT           │ PK, Auto Increment        │
│ panelId         │ INT           │ FK → panels.id            │
│ date            │ DATE          │ NOT NULL                  │
│ totalKWh        │ DECIMAL(10,2) │ NOT NULL                  │
│ totalCost       │ DECIMAL(12,2) │ NOT NULL                  │
│ peakKW          │ DECIMAL(8,2)  │ NULL                      │
│ avgPowerFactor  │ DECIMAL(4,2)  │ NULL                      │
│ createdAt       │ TIMESTAMP     │ DEFAULT NOW()             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   energy_summary_monthly                     │
├─────────────────────────────────────────────────────────────┤
│ id              │ INT           │ PK, Auto Increment        │
│ panelId         │ INT           │ FK → panels.id            │
│ year            │ INT           │ NOT NULL                  │
│ month           │ INT           │ NOT NULL                  │
│ totalKWh        │ DECIMAL(12,2) │ NOT NULL                  │
│ totalCost       │ DECIMAL(14,2) │ NOT NULL                  │
│ peakKW          │ DECIMAL(8,2)  │ NULL                      │
│ avgPowerFactor  │ DECIMAL(4,2)  │ NULL                      │
│ createdAt       │ TIMESTAMP     │ DEFAULT NOW()             │
└─────────────────────────────────────────────────────────────┘
```

### InfluxDB (Time-Series - Energy Readings)

```
Measurement: energy_data
├── Tags:
│   └── panelId (string)     # e.g., "PANEL_LANTAI_1"
│
├── Fields:
│   ├── voltage_r (float)    # Voltage R phase (V)
│   ├── voltage_s (float)    # Voltage S phase (V)
│   ├── voltage_t (float)    # Voltage T phase (V)
│   ├── voltage_n (float)    # Voltage Neutral (V)
│   ├── current_r (float)    # Current R phase (A)
│   ├── current_s (float)    # Current S phase (A)
│   ├── current_t (float)    # Current T phase (A)
│   ├── current_n (float)    # Current Neutral (A)
│   ├── powerKW (float)      # Active Power (kW)
│   ├── powerKVA (float)     # Apparent Power (kVA)
│   ├── energyKWh (float)    # Cumulative Energy (kWh)
│   ├── powerFactor (float)  # Power Factor (0-1)
│   ├── voltageUnbalance (float)
│   └── currentUnbalance (float)
│
└── Timestamp: RFC3339 format
```

---

## REST API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

---

### 1. GET /panels/realtime

Get real-time data for all panels.

**Response:**
```json
{
  "status": "OK",
  "data": {
    "panels": [
      {
        "pmCode": "PANEL_LANTAI_1",
        "location": "Lantai 1 - Main",
        "floor": 1,
        "panelStatus": "ONLINE",
        "lastUpdateRelative": "2s ago",
        "v": [224.7, 224.7, 223.5, 149.8],
        "i": [0.8, 0.99, 0.58, 0.03],
        "kw": "0.36",
        "kVA": "0.46",
        "kWh": "150.07",
        "pf": 0.86,
        "vunbal": 0.01,
        "iunbal": 0.047,
        "time": "2026-01-16 11:30:05"
      }
    ],
    "timestamp": "2026-01-16 11:30:10"
  }
}
```

---

### 2. GET /panels/usage/today/:panelCode

Get today's energy usage and cost for a specific panel.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| panelCode | string | Yes | Panel identifier (e.g., `PANEL_LANTAI_1`) |

**Response:**
```json
{
  "status": "OK",
  "data": {
    "panelCode": "PANEL_LANTAI_1",
    "date": "2026-01-16",
    "todayUsageKWh": 18.97,
    "todayCost": 28455,
    "currency": "IDR",
    "currentKWh": 150.07,
    "midnightKWh": 131.1
  }
}
```

---

### 3. GET /panels/history/:panelCode

Get historical energy data for charts.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| panelCode | string | Yes | Panel identifier |
| range | string | No | Time range: `1h`, `6h`, `12h`, `24h`, `7d`, `30d`, `1y` (default: `24h`) |

**Response:**
```json
{
  "status": "OK",
  "message": "",
  "data": {
    "pmCode": "PANEL_LANTAI_1",
    "year": "2026",
    "month": "01",
    "date": "16",
    "range": "24h",
    "energy": [131.179, 131.523, 131.87, ...],
    "cost": [196768, 197284, 197805, ...],
    "dataPoints": 24
  }
}
```

---

### 4. GET /panels/usage/monthly/:year/:month

Get monthly energy usage summary.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| year | string | Yes | Year (e.g., `2026`) |
| month | string | Yes | Month 01-12 (e.g., `01`) |

**Response:**
```json
{
  "status": "OK",
  "data": {
    "year": 2026,
    "month": 1,
    "panels": [
      {
        "panelCode": "PANEL_LANTAI_1",
        "totalKWh": 450.5,
        "totalCost": 675750
      }
    ],
    "buildingTotal": {
      "totalKWh": 1200.75,
      "totalCost": 1801125
    }
  }
}
```

---

### 5. POST /mqtt/start

Start the MQTT client listener.

**Response:**
```json
{
  "status": "OK",
  "message": "MQTT client started",
  "connected": true
}
```

---

### 6. GET /mqtt/start

Check MQTT client status.

**Response:**
```json
{
  "status": "OK",
  "connected": true,
  "initialized": true
}
```

---

## MQTT Topics

### Topic Pattern
```
DATA/PM/{PANEL_CODE}
```

### Examples
```
DATA/PM/PANEL_LANTAI_1
DATA/PM/PANEL_LANTAI_2
DATA/PM/PANEL_LANTAI_3
DATA/PM/#  (wildcard - subscribe to all)
```

### Payload Format
```json
{
  "status": "OK",
  "data": {
    "v": [224.7, 224.7, 223.5, 149.8],
    "i": [0.8, 0.99, 0.58, 0.03],
    "kw": "0.36",
    "kVA": "0.46",
    "kWh": "150.07",
    "pf": 0.86,
    "vunbal": 0.01,
    "iunbal": 0.047,
    "time": "2026-01-16 11:30:05"
  }
}
```

### Field Description
| Field | Type | Description |
|-------|------|-------------|
| v | array[4] | Voltage [R, S, T, N] in Volts |
| i | array[4] | Current [R, S, T, N] in Amperes |
| kw | string | Active power in kW |
| kVA | string | Apparent power in kVA |
| kWh | string | Cumulative energy in kWh |
| pf | number | Power factor (0-1) |
| vunbal | number | Voltage unbalance ratio |
| iunbal | number | Current unbalance ratio |
| time | string | Timestamp (YYYY-MM-DD HH:mm:ss) |

---

## Quick Start

### 1. Start Infrastructure
```bash
docker compose up -d
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Database
```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Start MQTT Listener
```bash
curl -X POST http://localhost:3000/api/mqtt/start
```

### 6. Run Simulator (Testing)
```bash
npm run simulate      # Real-time data
npm run seed:influx   # Historical data
```

---

## Project Structure

```
realtime-energy-monitoring/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed script
├── scripts/
│   ├── mqtt-simulator.ts      # MQTT data simulator
│   └── seed-influxdb.ts       # InfluxDB seeder
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── mqtt/start/    # MQTT control endpoint
│   │   │   └── v1/panels/     # REST API endpoints
│   │   │       ├── realtime/
│   │   │       ├── usage/today/[panelCode]/
│   │   │       ├── usage/monthly/[year]/[month]/
│   │   │       └── history/[panelCode]/
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Dashboard page
│   ├── components/
│   │   ├── PanelStatusCard.tsx
│   │   ├── TodayUsageWidget.tsx
│   │   └── EnergyChart.tsx
│   └── lib/
│       ├── business-logic.ts  # Business logic
│       ├── influxdb.ts        # InfluxDB client
│       ├── mqtt-client.ts     # MQTT service
│       └── prisma.ts          # Prisma client
├── docker-compose.yml
├── package.json
└── README.md
```

---

## Environment Variables

```env
# MQTT
MQTT_BROKER_URL=mqtt://localhost:1883

# InfluxDB
INFLUX_URL=http://localhost:8086
INFLUX_TOKEN=<your_token>
INFLUX_BUCKET=energy
INFLUX_ORG=ravelware

# PostgreSQL
DATABASE_URL=postgresql://admin:supersecretpassword@localhost:5432/energy_db

# Business Logic
COST_PER_KWH=1500
```

---

## License

Private - Ravelware
# realtime-energy-monitoring
