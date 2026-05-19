import React, { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store'; 
import { addPanorama } from '../store/panoramaSlice';
import 'pannellum/build/pannellum.css';

declare global {
  interface Window {
    pannellum: any;
    DeviceOrientationEvent: any;
  }
}

export default function PanoramaViewer() {
  const dispatch = useAppDispatch();
  const viewerRef = useRef<any>(null);
  
  const [gyroActive, setGyroActive] = useState(false);
  const [isLibLoaded, setIsLibLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  const { list, currentPanoId } = useAppSelector((state: any) => state.panoramaSlice);
  const activePano = list.find((p: any) => p.id === currentPanoId);

  useEffect(() => {
    import('pannellum/build/pannellum.js')
      .then(() => setIsLibLoaded(true))
      .catch((err) => console.error('Ошибка загрузки плеера:', err));
  }, []);

  const initPannellum = (useGyro: boolean) => {
    if (viewerRef.current) {
      try {
        viewerRef.current.destroy();
      } catch (e) {}
      viewerRef.current = null;
    }
    if (!isLibLoaded || !window.pannellum || !activePano) return;

    // Ждем, пока нода точно появится в DOM
    const checkExist = setInterval(() => {
      const container = document.getElementById('panorama-container');
      if (container) {
        clearInterval(checkExist);
        try {
          viewerRef.current = window.pannellum.viewer('panorama-container', {
            type: 'equirectangular',
            panorama: activePano.url,
            autoLoad: true,
            autoRotate: useGyro ? 0 : -0.3, 
            orientationOnByDefault: useGyro, // Родной гироскоп библиотеки
            friction: 0.85, // Внутреннее сглаживание Pannellum для плавности
            compass: false,
            showControls: false,
            mouseZoom: true,
            draggable: true,
          });

          viewerRef.current.on('load', () => {
            setIsLoading(false);
          });
        } catch (e) {
          console.error("Ошибка WebGL:", e);
          setIsLoading(false);
        }
      }
    }, 30);

    setTimeout(() => clearInterval(checkExist), 1000);
  };

  // Переинициализируем плеер строго при изменении gyroActive или смене фото
  useEffect(() => {
    if (activePano && isLibLoaded) {
      initPannellum(gyroActive);
    }
    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch(e) {}
        viewerRef.current = null;
      }
    };
  }, [currentPanoId, activePano, isLibLoaded, gyroActive]);

  const toggleGyroMode = async () => {
    if (gyroActive) {
      setGyroActive(false);
      return;
    }

    // Запрос на доступ к датчикам движения (КРИТИЧНО для iOS на Vercel)
    if (
      typeof window.DeviceOrientationEvent !== 'undefined' &&
      typeof window.DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        const permissionState = await window.DeviceOrientationEvent.requestPermission();
        if (permissionState === 'granted') {
          setGyroActive(true);
        } else {
          alert('Доступ к датчикам отклонен. Включите доступ в настройках Safari для этого сайта.');
        }
      } catch (error) {
        console.error("Ошибка датчиков:", error);
      }
    } else {
      // Android / ПК
      setGyroActive(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    let maxWebGLSize = 4096;
    try {
      const canvasTest = document.createElement('canvas');
      const gl = canvasTest.getContext('webgl') || canvasTest.getContext('experimental-webgl');
      if (gl) {
        const size = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_TEXTURE_SIZE);
        if (size) maxWebGLSize = size;
      }
    } catch (err) {}

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (img.width <= maxWebGLSize) {
          const originalUrl = URL.createObjectURL(file);
          setBgUrl(originalUrl);
          const shortName = file.name.length > 25 ? `${file.name.substring(0, 22)}...` : file.name;

          dispatch(addPanorama({
            id: `custom-${Date.now()}`,
            title: shortName,
            url: originalUrl
          }));
          return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let width = img.width;
        let height = img.height;

        height = Math.round((height * maxWebGLSize) / width);
        width = maxWebGLSize;

        canvas.width = width;
        canvas.height = height;

        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) {
              setIsLoading(false);
              return;
            }
            const optimizedUrl = URL.createObjectURL(blob);
            setBgUrl(optimizedUrl);
            const shortName = file.name.length > 25 ? `${file.name.substring(0, 22)}...` : file.name;

            dispatch(addPanorama({
              id: `custom-${Date.now()}`,
              title: `${shortName} (Оптимизировано)`,
              url: optimizedUrl
            }));
          }, 'image/jpeg', 0.9);
        } else {
          setIsLoading(false);
        }
      };
      img.onerror = () => setIsLoading(false);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => setIsLoading(false);
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col justify-center items-center overflow-hidden text-white font-sans selection:bg-transparent">
      {bgUrl && (
        <div 
          className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-20 pointer-events-none transition-all duration-700"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
      )}

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md z-50 transition-all duration-300">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <div className="absolute w-10 h-10 border-4 border-indigo-500/10 border-b-indigo-400 rounded-full animate-spin [animation-duration:0.6s]" />
          </div>
          <p className="mt-4 text-sm font-semibold tracking-wider text-blue-400 uppercase animate-pulse">
            Обработка 360° сферы...
          </p>
        </div>
      )}

      {!activePano ? (
        <div className="flex flex-col items-center gap-6 p-4 text-center z-10">
          <div className="text-6xl mb-2 animate-pulse">🌐</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Просмотр панорам 360°
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xs">
            Выберите ваше панорамное фото, чтобы открыть его
          </p>
          
          <label className="mt-4 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white px-8 py-4 rounded-2xl cursor-pointer font-bold shadow-xl shadow-blue-500/20 transition-all select-none text-base md:text-lg border border-blue-400/20">
            <span>📁</span>
            <span>Открыть 360° фото</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
      ) : (
        <div className="w-full h-full absolute inset-0 touch-none select-none overflow-hidden">
          <div id="panorama-container" className="w-full h-full border-none outline-none" />

          <div className="absolute bottom-8 left-6 right-6 flex justify-between items-center z-20 pointer-events-none">
            <label className="pointer-events-auto w-14 h-14 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-full flex items-center justify-center text-xl shadow-2xl active:scale-90 transition-all cursor-pointer select-none">
              📁
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>

            <button
              onClick={toggleGyroMode}
              className={`pointer-events-auto w-14 h-14 backdrop-blur-md border rounded-full flex items-center justify-center text-xl shadow-2xl active:scale-90 transition-all select-none ${
                gyroActive 
                  ? 'bg-blue-600 border-blue-400 text-white animate-pulse shadow-blue-500/40' 
                  : 'bg-slate-900/90 border-slate-700/60 text-slate-300'
              }`}
            >
              {gyroActive ? '👁️‍🗨️' : '📱'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
