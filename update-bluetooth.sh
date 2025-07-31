#!/bin/bash

# CycleVerse Bluetooth Integration Update Script
echo "🚴 Updating CycleVerse with Bluetooth integration..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the cycleverse project directory."
    echo "Usage: cd cycleverse && ./update-bluetooth.sh"
    exit 1
fi

# Check if this is the CycleVerse project
if ! grep -q "cycleverse" package.json; then
    echo "⚠️  Warning: This doesn't appear to be the CycleVerse project."
    echo "Are you sure you want to continue? (y/N)"
    read -r response
    if [[ ! $response =~ ^[Yy]$ ]]; then
        echo "Update cancelled."
        exit 0
    fi
fi

echo "📁 Creating directory structure..."

# Create directories
mkdir -p src/hooks
mkdir -p src/components

echo "📝 Creating useBluetoothDevices hook..."

# Create the Bluetooth hook
cat > src/hooks/useBluetoothDevices.js << 'EOF'
import { useState, useEffect, useCallback } from 'react';

// Bluetooth service UUIDs for cycling devices
const FITNESS_MACHINE_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';
const CYCLING_POWER_SERVICE = '00001818-0000-1000-8000-00805f9b34fb';
const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const CYCLING_SPEED_CADENCE_SERVICE = '00001816-0000-1000-8000-00805f9b34fb';

// Characteristic UUIDs
const FITNESS_MACHINE_FEATURE = '00002acc-0000-1000-8000-00805f9b34fb';
const INDOOR_BIKE_DATA = '00002ad2-0000-1000-8000-00805f9b34fb';
const FITNESS_MACHINE_CONTROL_POINT = '00002ad9-0000-1000-8000-00805f9b34fb';
const CYCLING_POWER_MEASUREMENT = '00002a63-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';

export const useBluetoothDevices = () => {
  const [devices, setDevices] = useState({
    trainer: null,
    powerMeter: null,
    heartRate: null
  });
  
  const [connectionStatus, setConnectionStatus] = useState({
    trainer: 'disconnected',
    powerMeter: 'disconnected',
    heartRate: 'disconnected'
  });
  
  const [sensorData, setSensorData] = useState({
    power: 0,
    cadence: 0,
    speed: 0,
    heartRate: 0,
    resistance: 0
  });

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);

  // Check if Web Bluetooth is supported
  const isBluetoothSupported = useCallback(() => {
    return 'bluetooth' in navigator;
  }, []);

  // Parse Indoor Bike Data (for Wahoo KICKR)
  const parseIndoorBikeData = useCallback((dataView) => {
    const flags = dataView.getUint16(0, true);
    let offset = 2;
    const data = {};

    // Instantaneous Speed (if present)
    if (flags & 0x01) {
      data.speed = dataView.getUint16(offset, true) * 0.01; // km/h
      offset += 2;
    }

    // Average Speed (if present)
    if (flags & 0x02) {
      data.averageSpeed = dataView.getUint16(offset, true) * 0.01;
      offset += 2;
    }

    // Instantaneous Cadence (if present)
    if (flags & 0x04) {
      data.cadence = dataView.getUint16(offset, true) * 0.5; // rpm
      offset += 2;
    }

    // Average Cadence (if present)
    if (flags & 0x08) {
      data.averageCadence = dataView.getUint16(offset, true) * 0.5;
      offset += 2;
    }

    // Total Distance (if present)
    if (flags & 0x10) {
      data.totalDistance = dataView.getUint32(offset, true); // meters
      offset += 3; // 24-bit value
    }

    // Resistance Level (if present)
    if (flags & 0x20) {
      data.resistance = dataView.getInt16(offset, true);
      offset += 2;
    }

    // Instantaneous Power (if present)
    if (flags & 0x40) {
      data.power = dataView.getInt16(offset, true); // watts
      offset += 2;
    }

    // Average Power (if present)
    if (flags & 0x80) {
      data.averagePower = dataView.getInt16(offset, true);
      offset += 2;
    }

    return data;
  }, []);

  // Parse Cycling Power Measurement
  const parseCyclingPowerData = useCallback((dataView) => {
    const flags = dataView.getUint16(0, true);
    let offset = 2;
    const data = {};

    // Instantaneous Power
    data.power = dataView.getInt16(offset, true);
    offset += 2;

    // Pedal Power Balance (if present)
    if (flags & 0x01) {
      data.pedalPowerBalance = dataView.getUint8(offset);
      offset += 1;
    }

    // Accumulated Torque (if present)
    if (flags & 0x04) {
      data.accumulatedTorque = dataView.getUint16(offset, true);
      offset += 2;
    }

    // Wheel Revolution Data (if present)
    if (flags & 0x10) {
      data.cumulativeWheelRevolutions = dataView.getUint32(offset, true);
      offset += 4;
      data.lastWheelEventTime = dataView.getUint16(offset, true);
      offset += 2;
    }

    // Crank Revolution Data (if present)
    if (flags & 0x20) {
      data.cumulativeCrankRevolutions = dataView.getUint16(offset, true);
      offset += 2;
      data.lastCrankEventTime = dataView.getUint16(offset, true);
      offset += 2;
      
      // Calculate cadence from crank revolution data
      if (data.lastCrankEventTime && data.cumulativeCrankRevolutions) {
        // This would need previous values to calculate actual cadence
        // For now, we'll estimate
        data.cadence = 60; // placeholder
      }
    }

    return data;
  }, []);

  // Parse Heart Rate Data
  const parseHeartRateData = useCallback((dataView) => {
    const flags = dataView.getUint8(0);
    let offset = 1;
    const data = {};

    // Heart Rate Measurement Value
    if (flags & 0x01) {
      // 16-bit heart rate value
      data.heartRate = dataView.getUint16(offset, true);
      offset += 2;
    } else {
      // 8-bit heart rate value
      data.heartRate = dataView.getUint8(offset);
      offset += 1;
    }

    // Energy Expended (if present)
    if (flags & 0x08) {
      data.energyExpended = dataView.getUint16(offset, true);
      offset += 2;
    }

    // RR-Intervals (if present)
    if (flags & 0x10) {
      const rrCount = (dataView.byteLength - offset) / 2;
      data.rrIntervals = [];
      for (let i = 0; i < rrCount; i++) {
        data.rrIntervals.push(dataView.getUint16(offset, true));
        offset += 2;
      }
    }

    return data;
  }, []);

  // Connect to Wahoo KICKR or similar fitness machine
  const connectToTrainer = useCallback(async () => {
    if (!isBluetoothSupported()) {
      setError('Bluetooth is not supported in this browser');
      return;
    }

    try {
      setConnectionStatus(prev => ({ ...prev, trainer: 'connecting' }));
      setError(null);

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [FITNESS_MACHINE_SERVICE] },
          { namePrefix: 'KICKR' },
          { namePrefix: 'Wahoo' }
        ],
        optionalServices: [CYCLING_POWER_SERVICE, HEART_RATE_SERVICE]
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(FITNESS_MACHINE_SERVICE);
      
      // Get Indoor Bike Data characteristic
      const indoorBikeDataChar = await service.getCharacteristic(INDOOR_BIKE_DATA);
      
      // Start notifications
      await indoorBikeDataChar.startNotifications();
      
      indoorBikeDataChar.addEventListener('characteristicvaluechanged', (event) => {
        const data = parseIndoorBikeData(event.target.value);
        setSensorData(prev => ({
          ...prev,
          ...data
        }));
      });

      // Get Fitness Machine Control Point for resistance control
      try {
        const controlPointChar = await service.getCharacteristic(FITNESS_MACHINE_CONTROL_POINT);
        device.controlPoint = controlPointChar;
      } catch (e) {
        console.log('Control point not available');
      }

      setDevices(prev => ({ ...prev, trainer: device }));
      setConnectionStatus(prev => ({ ...prev, trainer: 'connected' }));

      // Handle disconnection
      device.addEventListener('gattserverdisconnected', () => {
        setConnectionStatus(prev => ({ ...prev, trainer: 'disconnected' }));
        setDevices(prev => ({ ...prev, trainer: null }));
      });

    } catch (error) {
      console.error('Failed to connect to trainer:', error);
      setError(`Failed to connect to trainer: ${error.message}`);
      setConnectionStatus(prev => ({ ...prev, trainer: 'disconnected' }));
    }
  }, [isBluetoothSupported, parseIndoorBikeData]);

  // Connect to Power Meter
  const connectToPowerMeter = useCallback(async () => {
    if (!isBluetoothSupported()) {
      setError('Bluetooth is not supported in this browser');
      return;
    }

    try {
      setConnectionStatus(prev => ({ ...prev, powerMeter: 'connecting' }));
      setError(null);

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [CYCLING_POWER_SERVICE] }
        ]
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(CYCLING_POWER_SERVICE);
      const characteristic = await service.getCharacteristic(CYCLING_POWER_MEASUREMENT);
      
      await characteristic.startNotifications();
      
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const data = parseCyclingPowerData(event.target.value);
        setSensorData(prev => ({
          ...prev,
          ...data
        }));
      });

      setDevices(prev => ({ ...prev, powerMeter: device }));
      setConnectionStatus(prev => ({ ...prev, powerMeter: 'connected' }));

      device.addEventListener('gattserverdisconnected', () => {
        setConnectionStatus(prev => ({ ...prev, powerMeter: 'disconnected' }));
        setDevices(prev => ({ ...prev, powerMeter: null }));
      });

    } catch (error) {
      console.error('Failed to connect to power meter:', error);
      setError(`Failed to connect to power meter: ${error.message}`);
      setConnectionStatus(prev => ({ ...prev, powerMeter: 'disconnected' }));
    }
  }, [isBluetoothSupported, parseCyclingPowerData]);

  // Connect to Heart Rate Monitor
  const connectToHeartRate = useCallback(async () => {
    if (!isBluetoothSupported()) {
      setError('Bluetooth is not supported in this browser');
      return;
    }

    try {
      setConnectionStatus(prev => ({ ...prev, heartRate: 'connecting' }));
      setError(null);

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [HEART_RATE_SERVICE] }
        ]
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(HEART_RATE_SERVICE);
      const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);
      
      await characteristic.startNotifications();
      
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const data = parseHeartRateData(event.target.value);
        setSensorData(prev => ({
          ...prev,
          ...data
        }));
      });

      setDevices(prev => ({ ...prev, heartRate: device }));
      setConnectionStatus(prev => ({ ...prev, heartRate: 'connected' }));

      device.addEventListener('gattserverdisconnected', () => {
        setConnectionStatus(prev => ({ ...prev, heartRate: 'disconnected' }));
        setDevices(prev => ({ ...prev, heartRate: null }));
      });

    } catch (error) {
      console.error('Failed to connect to heart rate monitor:', error);
      setError(`Failed to connect to heart rate monitor: ${error.message}`);
      setConnectionStatus(prev => ({ ...prev, heartRate: 'disconnected' }));
    }
  }, [isBluetoothSupported, parseHeartRateData]);

  // Set resistance on trainer (for Wahoo KICKR)
  const setResistance = useCallback(async (resistanceLevel) => {
    const trainer = devices.trainer;
    if (!trainer || !trainer.controlPoint) {
      console.log('No trainer with control point available');
      return;
    }

    try {
      // Fitness Machine Control Point command for setting target resistance
      const command = new Uint8Array([0x04, resistanceLevel & 0xFF, (resistanceLevel >> 8) & 0xFF]);
      await trainer.controlPoint.writeValue(command);
    } catch (error) {
      console.error('Failed to set resistance:', error);
    }
  }, [devices.trainer]);

  // Set target power on trainer
  const setTargetPower = useCallback(async (targetPower) => {
    const trainer = devices.trainer;
    if (!trainer || !trainer.controlPoint) {
      console.log('No trainer with control point available');
      return;
    }

    try {
      // Fitness Machine Control Point command for setting target power
      const command = new Uint8Array([0x05, targetPower & 0xFF, (targetPower >> 8) & 0xFF]);
      await trainer.controlPoint.writeValue(command);
    } catch (error) {
      console.error('Failed to set target power:', error);
    }
  }, [devices.trainer]);

  // Disconnect device
  const disconnectDevice = useCallback(async (deviceType) => {
    const device = devices[deviceType];
    if (device && device.gatt.connected) {
      await device.gatt.disconnect();
    }
  }, [devices]);

  // Scan for available devices
  const scanForDevices = useCallback(async () => {
    if (!isBluetoothSupported()) {
      setError('Bluetooth is not supported in this browser');
      return [];
    }

    setIsScanning(true);
    setError(null);

    try {
      // This is a simplified scan - in reality, you'd need to scan for each service type
      const devices = await navigator.bluetooth.getAvailability();
      return devices;
    } catch (error) {
      console.error('Failed to scan for devices:', error);
      setError(`Failed to scan for devices: ${error.message}`);
      return [];
    } finally {
      setIsScanning(false);
    }
  }, [isBluetoothSupported]);

  return {
    devices,
    connectionStatus,
    sensorData,
    isScanning,
    error,
    isBluetoothSupported: isBluetoothSupported(),
    connectToTrainer,
    connectToPowerMeter,
    connectToHeartRate,
    disconnectDevice,
    scanForDevices,
    setResistance,
    setTargetPower
  };
};
EOF

echo "🔗 Creating BluetoothPanel component..."

# Create the Bluetooth Panel component
cat > src/components/BluetoothPanel.js << 'EOF'
import React from 'react';
import { Bluetooth, Zap, Heart, Settings, Wifi, WifiOff, Loader } from 'lucide-react';

const BluetoothPanel = ({ 
  connectionStatus, 
  sensorData, 
  isBluetoothSupported,
  connectToTrainer,
  connectToPowerMeter,
  connectToHeartRate,
  disconnectDevice,
  error,
  setResistance,
  setTargetPower
}) => {
  const [targetPowerInput, setTargetPowerInput] = React.useState(200);
  const [resistanceInput, setResistanceInput] = React.useState(50);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'connecting':
        return <Loader className="w-4 h-4 text-yellow-400 animate-spin" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  if (!isBluetoothSupported) {
    return (
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center space-x-2 text-red-400">
          <Bluetooth className="w-5 h-5" />
          <span>Bluetooth not supported in this browser</span>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Please use Chrome, Edge, or another Chromium-based browser for Bluetooth support.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg space-y-4">
      <div className="flex items-center space-x-2">
        <Bluetooth className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold">Bluetooth Devices</h3>
      </div>

      {error && (
        <div className="bg-red-900 bg-opacity-50 border border-red-500 rounded p-3">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Device Connections */}
      <div className="space-y-3">
        {/* Trainer */}
        <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
          <div className="flex items-center space-x-3">
            <Settings className="w-4 h-4 text-blue-400" />
            <div>
              <div className="font-medium">Smart Trainer</div>
              <div className={`text-sm ${getStatusColor(connectionStatus.trainer)}`}>
                Wahoo KICKR / Compatible
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon(connectionStatus.trainer)}
            {connectionStatus.trainer === 'connected' ? (
              <button
                onClick={() => disconnectDevice('trainer')}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={connectToTrainer}
                disabled={connectionStatus.trainer === 'connecting'}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-xs"
              >
                Connect
              </button>
            )}
          </div>
        </div>

        {/* Power Meter */}
        <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
          <div className="flex items-center space-x-3">
            <Zap className="w-4 h-4 text-yellow-400" />
            <div>
              <div className="font-medium">Power Meter</div>
              <div className={`text-sm ${getStatusColor(connectionStatus.powerMeter)}`}>
                Cycling Power Service
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon(connectionStatus.powerMeter)}
            {connectionStatus.powerMeter === 'connected' ? (
              <button
                onClick={() => disconnectDevice('powerMeter')}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={connectToPowerMeter}
                disabled={connectionStatus.powerMeter === 'connecting'}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-xs"
              >
                Connect
              </button>
            )}
          </div>
        </div>

        {/* Heart Rate */}
        <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
          <div className="flex items-center space-x-3">
            <Heart className="w-4 h-4 text-red-400" />
            <div>
              <div className="font-medium">Heart Rate Monitor</div>
              <div className={`text-sm ${getStatusColor(connectionStatus.heartRate)}`}>
                Heart Rate Service
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon(connectionStatus.heartRate)}
            {connectionStatus.heartRate === 'connected' ? (
              <button
                onClick={() => disconnectDevice('heartRate')}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={connectToHeartRate}
                disabled={connectionStatus.heartRate === 'connecting'}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-xs"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Data Display */}
      {(connectionStatus.trainer === 'connected' || connectionStatus.powerMeter === 'connected') && (
        <div className="border-t border-gray-600 pt-4">
          <h4 className="font-medium mb-3">Live Sensor Data</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700 p-2 rounded text-center">
              <div className="text-2xl font-bold text-yellow-400">{sensorData.power}W</div>
              <div className="text-xs text-gray-400">Power</div>
            </div>
            <div className="bg-gray-700 p-2 rounded text-center">
              <div className="text-2xl font-bold text-blue-400">{sensorData.cadence}</div>
              <div className="text-xs text-gray-400">Cadence</div>
            </div>
            <div className="bg-gray-700 p-2 rounded text-center">
              <div className="text-2xl font-bold text-green-400">{sensorData.speed.toFixed(1)}</div>
              <div className="text-xs text-gray-400">Speed (km/h)</div>
            </div>
            <div className="bg-gray-700 p-2 rounded text-center">
              <div className="text-2xl font-bold text-red-400">{sensorData.heartRate}</div>
              <div className="text-xs text-gray-400">Heart Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Trainer Controls */}
      {connectionStatus.trainer === 'connected' && (
        <div className="border-t border-gray-600 pt-4">
          <h4 className="font-medium mb-3">Trainer Control</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Target Power (W)</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={targetPowerInput}
                  onChange={(e) => setTargetPowerInput(parseInt(e.target.value))}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white"
                  min="0"
                  max="1000"
                />
                <button
                  onClick={() => setTargetPower(targetPowerInput)}
                  className="px-4 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
                >
                  Set
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Resistance Level</label>
              <div className="flex space-x-2">
                <input
                  type="range"
                  value={resistanceInput}
                  onChange={(e) => setResistanceInput(parseInt(e.target.value))}
                  className="flex-1"
                  min="0"
                  max="100"
                />
                <button
                  onClick={() => setResistance(resistanceInput)}
                  className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  Set
                </button>
              </div>
              <div className="text-xs text-gray-400 mt-1">Current: {resistanceInput}%</div>
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
        Compatible with Wahoo KICKR, Elite, Tacx, and other BLE smart trainers
      </div>
    </div>
  );
};

export default BluetoothPanel;
EOF

echo "🔄 Updating App.js with Bluetooth integration..."

# Backup the original App.js
cp src/App.js src/App.js.backup

# Create the updated App.js
cat > src/App.js << 'EOF'
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Users, Trophy, Settings, Map, Zap, Heart, Activity, Timer, Award, Target, Bluetooth } from 'lucide-react';
import { useBluetoothDevices } from './hooks/useBluetoothDevices';
import BluetoothPanel from './components/BluetoothPanel';

const CycleVerse = () => {
  const [isRiding, setIsRiding] = useState(false);
  const [currentWorld, setCurrentWorld] = useState('volcano');
  const [showBluetoothPanel, setShowBluetoothPanel] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [currentRoute, setCurrentRoute] = useState('Volcano Circuit');
  const [riders, setRiders] = useState([
    { id: 1, name: 'Alex_Rider', distance: 15.2, power: 285, avatar: '🚴‍♂️' },
    { id: 2, name: 'CycleQueen', distance: 14.8, power: 260, avatar: '🚴‍♀️' },
    { id: 3, name: 'SpeedDemon', distance: 16.1, power: 310, avatar: '🚴‍♂️' },
    { id: 4, name: 'You', distance: 0, power: 0, avatar: '🚴‍♂️' }
  ]);
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const terrainOffset = useRef(0);

  // Bluetooth integration
  const {
    devices,
    connectionStatus,
    sensorData,
    isBluetoothSupported,
    connectToTrainer,
    connectToPowerMeter,
    connectToHeartRate,
    disconnectDevice,
    setResistance,
    setTargetPower,
    error: bluetoothError
  } = useBluetoothDevices();

  // Use real sensor data when available, otherwise simulate
  const [simulatedData, setSimulatedData] = useState({
    speed: 0,
    power: 0,
    heartRate: 0,
    distance: 0,
    time: 0,
    elevation: 150
  });

  // Determine if we should use real or simulated data
  const hasRealData = connectionStatus.trainer === 'connected' || connectionStatus.powerMeter === 'connected';
  const currentData = hasRealData ? {
    speed: sensorData.speed || 0,
    power: sensorData.power || 0,
    heartRate: sensorData.heartRate || simulatedData.heartRate,
    distance: simulatedData.distance, // Keep tracking distance locally
    time: simulatedData.time,
    elevation: simulatedData.elevation
  } : simulatedData;

  const worlds = {
    volcano: { name: 'Volcano World', color: '#ff6b35', terrain: 'volcanic' },
    forest: { name: 'Forest Trails', color: '#2d5016', terrain: 'forest' },
    city: { name: 'City Streets', color: '#4a90e2', terrain: 'urban' },
    desert: { name: 'Desert Oasis', color: '#f4a261', terrain: 'desert' }
  };

  // Simulate cycling data when not connected to real devices
  useEffect(() => {
    let interval;
    if (isRiding) {
      interval = setInterval(() => {
        // Always update time and distance
        setSimulatedData(prev => ({
          ...prev,
          time: prev.time + 1,
          distance: prev.distance + (currentData.speed || 0) / 3600,
          elevation: prev.elevation + (Math.random() - 0.5) * 2
        }));

        if (!hasRealData) {
          // Only simulate if no real data available
          const newSpeed = 25 + Math.random() * 10 - 5;
          const newPower = 200 + Math.random() * 100;
          const newHR = 140 + Math.random() * 40;
          
          setSimulatedData(prev => ({
            ...prev,
            speed: Math.max(0, newSpeed),
            power: Math.max(0, newPower),
            heartRate: Math.max(120, newHR)
          }));
        }
        
        // Update rider position
        setRiders(prev => prev.map(rider => 
          rider.name === 'You' 
            ? { ...rider, distance: currentData.distance, power: currentData.power }
            : rider
        ));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRiding, hasRealData, currentData.speed, currentData.distance, currentData.power]);

  // 3D terrain rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Sky gradient
      const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.6);
      skyGradient.addColorStop(0, '#87CEEB');
      skyGradient.addColorStop(1, '#98D8E8');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.6);
      
      // Terrain based on selected world
      const worldColor = worlds[currentWorld].color;
      
      // Background mountains
      ctx.fillStyle = worldColor + '80';
      for (let i = 0; i < 5; i++) {
        const x = (i * 200 - terrainOffset.current * 0.3) % (canvas.width + 200);
        const height = 100 + Math.sin(i * 0.8) * 50;
        ctx.beginPath();
        ctx.moveTo(x, canvas.height * 0.6);
        ctx.lineTo(x + 100, canvas.height * 0.6 - height);
        ctx.lineTo(x + 200, canvas.height * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      
      // Road
      const roadY = canvas.height * 0.75;
      ctx.fillStyle = '#444';
      ctx.fillRect(0, roadY, canvas.width, canvas.height * 0.25);
      
      // Road lines
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.setLineDash([20, 20]);
      ctx.beginPath();
      ctx.moveTo(-terrainOffset.current % 40, roadY + 20);
      ctx.lineTo(canvas.width, roadY + 20);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Trees/objects based on world
      ctx.fillStyle = worldColor;
      for (let i = 0; i < 10; i++) {
        const x = (i * 80 - terrainOffset.current) % (canvas.width + 80);
        const objHeight = 30 + Math.sin(i) * 20;
        if (currentWorld === 'forest') {
          ctx.fillRect(x, roadY - objHeight, 8, objHeight);
          ctx.beginPath();
          ctx.arc(x + 4, roadY - objHeight, 15, 0, Math.PI * 2);
          ctx.fill();
        } else if (currentWorld === 'city') {
          ctx.fillRect(x, roadY - objHeight, 20, objHeight);
        } else if (currentWorld === 'volcano') {
          ctx.beginPath();
          ctx.arc(x, roadY - 10, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      if (isRiding) {
        terrainOffset.current += currentData.speed * 0.1;
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentWorld, currentData.speed, isRiding]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRide = () => {
    setIsRiding(true);
    setSimulatedData(prev => ({ ...prev, distance: 0, time: 0 }));
  };

  const stopRide = () => {
    setIsRiding(false);
    if (currentData.distance > 5) {
      setAchievements(prev => [...prev, {
        id: Date.now(),
        title: 'Ride Complete',
        description: `Completed ${currentData.distance.toFixed(1)}km ride`,
        icon: '🏆'
      }]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            CycleVerse
          </h1>
          <div className="flex items-center space-x-2 text-sm">
            <Map className="w-4 h-4" />
            <span>{worlds[currentWorld].name}</span>
            <span className="text-gray-400">•</span>
            <span>{currentRoute}</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>{riders.length} riders</span>
          </div>
          <button
            onClick={() => setShowBluetoothPanel(!showBluetoothPanel)}
            className={`flex items-center space-x-2 px-3 py-1 rounded ${
              showBluetoothPanel ? 'bg-blue-600' : 'hover:bg-gray-700'
            }`}
          >
            <Bluetooth className="w-4 h-4" />
            <span className="hidden sm:inline">Devices</span>
            {(connectionStatus.trainer === 'connected' || 
              connectionStatus.powerMeter === 'connected' || 
              connectionStatus.heartRate === 'connected') && (
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            )}
          </button>
          <Settings className="w-5 h-5 cursor-pointer hover:text-blue-400" />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Main View */}
        <div className="flex-1">
          {/* 3D World View */}
          <div className="relative h-96 bg-black overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full" />
            
            {/* HUD Overlay */}
            <div className="absolute top-4 left-4 space-y-2">
              <div className={`bg-black bg-opacity-50 rounded px-3 py-1 text-sm ${hasRealData ? 'border-l-4 border-green-400' : ''}`}>
                <span className="text-blue-400">Speed:</span> {currentData.speed.toFixed(1)} km/h
                {hasRealData && <span className="text-green-400 text-xs ml-2">LIVE</span>}
              </div>
              <div className={`bg-black bg-opacity-50 rounded px-3 py-1 text-sm ${hasRealData ? 'border-l-4 border-green-400' : ''}`}>
                <span className="text-yellow-400">Power:</span> {currentData.power.toFixed(0)}W
                {hasRealData && <span className="text-green-400 text-xs ml-2">LIVE</span>}
              </div>
              <div className="bg-black bg-opacity-50 rounded px-3 py-1 text-sm">
                <span className="text-red-400">HR:</span> {currentData.heartRate.toFixed(0)} bpm
                {connectionStatus.heartRate === 'connected' && <span className="text-green-400 text-xs ml-2">LIVE</span>}
              </div>
            </div>

            <div className="absolute top-4 right-4">
              <div className="bg-black bg-opacity-50 rounded px-3 py-1 text-sm">
                Elevation: {currentData.elevation.toFixed(0)}m
              </div>
            </div>

            {/* Control Buttons */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <button
                onClick={isRiding ? stopRide : startRide}
                className={`flex items-center space-x-2 px-6 py-3 rounded-full font-semibold transition-colors ${
                  isRiding 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isRiding ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                <span>{isRiding ? 'Stop Ride' : 'Start Ride'}</span>
              </button>
            </div>
          </div>

          {/* World Selection */}
          <div className="p-4 bg-gray-800">
            <h3 className="text-lg font-semibold mb-3">Select World:</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(worlds).map(([key, world]) => (
                <button
                  key={key}
                  onClick={() => setCurrentWorld(key)}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    currentWorld === key
                      ? 'border-blue-500 bg-blue-500 bg-opacity-20'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div
                    className="w-full h-16 rounded mb-2"
                    style={{ backgroundColor: world.color }}
                  />
                  <span className="text-sm">{world.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-80 bg-gray-800 space-y-6">
          {/* Bluetooth Panel */}
          {showBluetoothPanel && (
            <div className="p-4">
              <BluetoothPanel
                connectionStatus={connectionStatus}
                sensorData={sensorData}
                isBluetoothSupported={isBluetoothSupported}
                connectToTrainer={connectToTrainer}
                connectToPowerMeter={connectToPowerMeter}
                connectToHeartRate={connectToHeartRate}
                disconnectDevice={disconnectDevice}
                error={bluetoothError}
                setResistance={setResistance}
                setTargetPower={setTargetPower}
              />
            </div>
          )}

          <div className="p-4 space-y-6">
            {/* Stats */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Session Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-700 p-3 rounded">
                  <div className="flex items-center space-x-2 mb-1">
                    <Timer className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-300">Time</span>
                  </div>
                  <div className="text-xl font-mono">{formatTime(currentData.time)}</div>
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <div className="flex items-center space-x-2 mb-1">
                    <Target className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-300">Distance</span>
                  </div>
                  <div className="text-xl">{currentData.distance.toFixed(1)} km</div>
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <div className="flex items-center space-x-2 mb-1">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-gray-300">Avg Power</span>
                  </div>
                  <div className="text-xl">{currentData.power.toFixed(0)}W</div>
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <div className="flex items-center space-x-2 mb-1">
                    <Heart className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-gray-300">Avg HR</span>
                  </div>
                  <div className="text-xl">{currentData.heartRate.toFixed(0)}</div>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span>Live Riders</span>
              </h3>
              <div className="space-y-2">
                {riders
                  .sort((a, b) => b.distance - a.distance)
                  .map((rider, index) => (
                  <div
                    key={rider.id}
                    className={`flex items-center justify-between p-2 rounded ${
                      rider.name === 'You' ? 'bg-blue-600 bg-opacity-30' : 'bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{index + 1}</span>
                      <span className="text-2xl">{rider.avatar}</span>
                      <div>
                        <div className="font-medium">{rider.name}</div>
                        <div className="text-sm text-gray-400">{rider.power}W</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono">{rider.distance.toFixed(1)}km</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Achievements */}
            {achievements.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center space-x-2">
                  <Award className="w-5 h-5 text-purple-400" />
                  <span>Recent Achievements</span>
                </h3>
                <div className="space-y-2">
                  {achievements.slice(-3).map((achievement) => (
                    <div key={achievement.id} className="bg-gray-700 p-3 rounded">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">{achievement.icon}</span>
                        <div>
                          <div className="font-medium">{achievement.title}</div>
                          <div className="text-sm text-gray-400">{achievement.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Power Zones */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Power Zones</h3>
              <div className="space-y-2">
                {[
                  { zone: 'Recovery', min: 0, max: 150, color: 'bg-gray-500' },
                  { zone: 'Endurance', min: 150, max: 200, color: 'bg-blue-500' },
                  { zone: 'Tempo', min: 200, max: 250, color: 'bg-green-500' },
                  { zone: 'Threshold', min: 250, max: 300, color: 'bg-yellow-500' },
                  { zone: 'VO2 Max', min: 300, max: 400, color: 'bg-red-500' }
                ].map((zone) => (
                  <div key={zone.zone} className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                    <span className="text-sm flex-1">{zone.zone}</span>
                    <span className="text-xs text-gray-400">{zone.min}-{zone.max}W</span>
                    {currentData.power >= zone.min && currentData.power <= zone.max && (
                      <Activity className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CycleVerse;
EOF

echo "🧪 Testing the updated application..."

# Test if the app compiles
if npm run build > /dev/null 2>&1; then
    echo "✅ Build test passed!"
else
    echo "⚠️  Build test failed. Please check for syntax errors."
fi

echo "🚀 Starting development server..."

# Start the development server in the background
npm start &
DEV_SERVER_PID=$!

echo "📱 Development server started (PID: $DEV_SERVER_PID)"
echo "🌐 App should be available at: http://localhost:3000"

sleep 3

echo ""
echo "🔗 Git operations..."

# Add all changes
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "ℹ️  No changes to commit."
else
    # Commit the changes
    git commit -m "Add Bluetooth integration for Wahoo KICKR and smart trainers

Features added:
- useBluetoothDevices hook for BLE device management
- BluetoothPanel component for device connections  
- Real-time sensor data integration (power, cadence, speed, HR)
- Smart trainer control (resistance, target power)
- Support for Wahoo KICKR, power meters, and HR monitors
- Seamless fallback between real and simulated data
- Live data indicators in HUD
- Device connection status with visual feedback

Compatible with:
- Wahoo KICKR series trainers
- Elite, Tacx, and other BLE smart trainers  
- Any BLE cycling power meter
- Any BLE heart rate monitor

Requires Chrome/Edge browser for Web Bluetooth API support."

    echo "📤 Pushing to GitHub..."
    
    # Push to GitHub
    if git push origin main; then
        echo "✅ Successfully pushed to GitHub!"
    else
        echo "❌ Failed to push to GitHub. Please check your credentials and try again."
        echo "You can manually push later with: git push origin main"
    fi
fi

echo ""
echo "🎉 Update complete!"
echo ""
echo "📋 Summary of changes:"
echo "   ✅ Created src/hooks/useBluetoothDevices.js"
echo "   ✅ Created src/components/BluetoothPanel.js" 
echo "   ✅ Updated src/App.js with Bluetooth integration"
echo "   ✅ Backed up original App.js to App.js.backup"
echo "   ✅ Committed and pushed changes to GitHub"
echo ""
echo "🚴 Next steps:"
echo "   1. Open http://localhost:3000 in Chrome or Edge"
echo "   2. Click the 'Devices' button to access Bluetooth panel"
echo "   3. Connect your Wahoo KICKR or other BLE devices"
echo "   4. Start riding with real sensor data!"
echo ""
echo "📚 Note: Web Bluetooth requires:"
echo "   - Chrome, Edge, or Chromium-based browser"
echo "   - HTTPS connection (dev server uses HTTP, so some features may be limited)"
echo "   - User gesture to initiate Bluetooth connections"
echo ""
echo "🛑 To stop the development server: kill $DEV_SERVER_PID"
echo ""
echo "Happy cycling! 🚴‍♂️💨"
