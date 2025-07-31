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
