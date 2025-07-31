import StreetViewIntegration from './components/StreetViewIntegration';
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
    error: bluetoothError,
    connectedDeviceInfo
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
    desert: { name: 'Desert Oasis', color: '#f4a261', terrain: 'desert' },
    streetview: { name: 'Street View', color: '#4285f4', terrain: 'real-world' }
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
            {currentWorld === 'streetview' ? (
              <StreetViewIntegration
                speed={currentData.speed}
                isRiding={isRiding}
                currentData={currentData}
              />
            ) : (
              <>
                <canvas ref={canvasRef} className="w-full h-full" />            <canvas ref={canvasRef} className="w-full h-full" />
            
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
              </>
            )}            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
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
                connectedDeviceInfo={connectedDeviceInfo}
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
