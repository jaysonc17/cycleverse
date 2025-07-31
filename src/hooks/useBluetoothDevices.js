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
