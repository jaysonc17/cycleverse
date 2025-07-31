import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Users, Trophy, Settings, Map, Zap, Heart, Activity, Timer, Award, Target } from 'lucide-react';

const CycleVerse = () => {
  const [isRiding, setIsRiding] = useState(false);
  const [currentWorld, setCurrentWorld] = useState('volcano');
  const [speed, setSpeed] = useState(0);
  const [power, setPower] = useState(0);
  const [heartRate, setHeartRate] = useState(0);
  const [distance, setDistance] = useState(0);
  const [time, setTime] = useState(0);
  const [elevation, setElevation] = useState(150);
  const [riders, setRiders] = useState([
    { id: 1, name: 'Alex_Rider', distance: 15.2, power: 285, avatar: '🚴‍♂️' },
    { id: 2, name: 'CycleQueen', distance: 14.8, power: 260, avatar: '🚴‍♀️' },
    { id: 3, name: 'SpeedDemon', distance: 16.1, power: 310, avatar: '🚴‍♂️' },
    { id: 4, name: 'You', distance: 0, power: 0, avatar: '🚴‍♂️' }
  ]);
  const [achievements, setAchievements] = useState([]);
  const [currentRoute, setCurrentRoute] = useState('Volcano Circuit');
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const terrainOffset = useRef(0);

  const worlds = {
    volcano: { name: 'Volcano World', color: '#ff6b35', terrain: 'volcanic' },
    forest: { name: 'Forest Trails', color: '#2d5016', terrain: 'forest' },
    city: { name: 'City Streets', color: '#4a90e2', terrain: 'urban' },
    desert: { name: 'Desert Oasis', color: '#f4a261', terrain: 'desert' }
  };

  // Simulate cycling data
  useEffect(() => {
    let interval;
    if (isRiding) {
      interval = setInterval(() => {
        const newSpeed = 25 + Math.random() * 10 - 5;
        const newPower = 200 + Math.random() * 100;
        const newHR = 140 + Math.random() * 40;
        
        setSpeed(Math.max(0, newSpeed));
        setPower(Math.max(0, newPower));
        setHeartRate(Math.max(120, newHR));
        setDistance(prev => prev + newSpeed / 3600);
        setTime(prev => prev + 1);
        setElevation(prev => prev + (Math.random() - 0.5) * 2);
        
        setRiders(prev => prev.map(rider => 
          rider.name === 'You' 
            ? { ...rider, distance: distance, power: newPower }
            : rider
        ));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRiding, distance]);

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
        terrainOffset.current += speed * 0.1;
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
  }, [currentWorld, speed, isRiding]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRide = () => {
    setIsRiding(true);
    setDistance(0);
    setTime(0);
  };

  const stopRide = () => {
    setIsRiding(false);
    if (distance > 5) {
      setAchievements(prev => [...prev, {
        id: Date.now(),
        title: 'Ride Complete',
        description: `Completed ${distance.toFixed(1)}km ride`,
        icon: '🏆'
      }]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
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
          <Settings className="w-5 h-5 cursor-pointer hover:text-blue-400" />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="flex-1">
          <div className="relative h-96 bg-black overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full" />
            
            <div className="absolute top-4 left-4 space-y-2">
              <div className="bg-black bg-opacity-50 rounded px-3 py-1 text-sm">
                <span className="text-blue-400">Speed:</span> {speed.toFixed(1)} km/h
              </div>
              <div className="bg-black bg-opacity-50 rounded px-3 py-1 text-sm">
                <span className="text-yellow-400">Power:</span> {power.toFixed(0)}W
              </div>
              <div className="bg-black bg-opacity-50 rounded px-3 py-1 text-sm">
                <span className="text-red-400">HR:</span> {heartRate.toFixed(0)} bpm
              </div>
            </div>

            <div className="absolute top-4 right-4">
              <div className="bg-black bg-opacity-50 rounded px-3 py-1 text-sm">
                Elevation: {elevation.toFixed(0)}m
              </div>
            </div>

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

        <div className="w-full lg:w-80 bg-gray-800 p-4 space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Session Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700 p-3 rounded">
                <div className="flex items-center space-x-2 mb-1">
                  <Timer className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-300">Time</span>
                </div>
                <div className="text-xl font-mono">{formatTime(time)}</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="flex items-center space-x-2 mb-1">
                  <Target className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-300">Distance</span>
                </div>
                <div className="text-xl">{distance.toFixed(1)} km</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="flex items-center space-x-2 mb-1">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">Avg Power</span>
                </div>
                <div className="text-xl">{power.toFixed(0)}W</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="flex items-center space-x-2 mb-1">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-gray-300">Avg HR</span>
                </div>
                <div className="text-xl">{heartRate.toFixed(0)}</div>
              </div>
            </div>
          </div>

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
        </div>
      </div>
    </div>
  );
};

export default CycleVerse;
