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
  
  // gyroActive управляет режимом: true - вращение телефоном, false - обычный ручной режим
  const [gyroActive, setGyroActive] = useState(false);
  const [isLibLoaded, setIsLibLoaded] = useState(false);
  
  // Добавляем any для стейта, чтобы TypeScript не ругался на структуру стора
  const { list, currentPanoId } = useAppSelector((state: any) => state.panoramaSlice);
  const activePano = list.find((p: any) => p.id === currentPanoId);

  // Загрузка скрипта Pannellum
  useEffect(() => {
    import('pannellum/build/pannellum.js')
      .then(() => setIsLibLoaded(true))
      .catch((err) => console.error('Ошибка загрузки плеера:', err));
  }, []);

  // Инициализация WebGL плеера
  const initPannellum = (useGyro: boolean) => {
    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }
    if (!isLibLoaded || !window.pannellum || !activePano) return;

    setTimeout(() => {
      const container = document.getElementById('panorama-container');
      if (!container) return;

      try {
        viewerRef.current = window.pannellum.viewer('panorama-container', {
          type: 'equirectangular',
          panorama: activePano.url,
          autoLoad: true,
          autoRotate: useGyro ? 0 : -0.3, // Медленное вращение, если гироскоп выключен
          orientationOnByDefault: useGyro, // Включает/выключает гироскоп
          compass: false,
          showControls: false,
          mouseZoom: true,
          draggable: true,
        });
      } catch (e) {
        console.error("Ошибка WebGL:", e);
      }
    }, 50);
  };

  // Переключаем плеер при изменении картинки или режима гироскопа
  useEffect(() => {
    if (activePano && isLibLoaded) {
      initPannellum(gyroActive);
    }
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [currentPanoId, activePano, isLibLoaded, gyroActive]);

  // Запрос прав на гироскоп (актуально для iOS) и переключение режима
  const toggleGyroMode = async () => {
    if (gyroActive) {
      // Если режим был активен — просто выключаем его
      setGyroActive(false);
      return;
    }

    // Проверяем политики iOS Safari
    if (
      typeof window.DeviceOrientationEvent !== 'undefined' &&
      typeof window.DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        const permissionState = await window.DeviceOrientationEvent.requestPermission();
        if (permissionState === 'granted') {
          setGyroActive(true);
        } else {
          alert('Доступ к датчикам движения отклонен. Режим обзора телефоном недоступен.');
        }
      } catch (error) {
        console.error("Ошибка датчиков:", error);
      }
    } else {
      // На Android и ПК включаем сразу
      setGyroActive(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    const shortName = file.name.length > 25 ? `${file.name.substring(0, 22)}...` : file.name;

    dispatch(addPanorama({
      id: `custom-${Date.now()}`,
      title: shortName,
      url: localUrl
    }));
  };

  return (
    <div className="w-full h-screen bg-slate-950 flex flex-col justify-center items-center relative overflow-hidden text-white font-sans">
      
      {/* СТАРТОВЫЙ ЭКРАН (Кнопка по центру) */}
      {!activePano ? (
        <div className="flex flex-col items-center gap-6 p-4 text-center z-10">
          <div className="text-6xl mb-2">🌐</div>
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
        // ЭКРАН ПРОСМОТРА ПАНОРАМЫ
        <div className="w-full h-full relative touch-none">
          <div id="panorama-container" className="w-full h-full" />

          {/* Неброская верхняя плашка с названием файла */}
          {/* <div className="absolute top-4 left-4 right-4 bg-slate-900/70 backdrop-blur border border-slate-800/50 px-4 py-2 rounded-xl z-20 pointer-events-none text-center">
            <span className="text-xs font-medium text-slate-300 truncate block">
              {activePano.title}
            </span>
          </div> */}

          {/* НИЖНИЙ ИНТЕРФЕЙС: Две круглые кнопки по бокам */}
          <div className="absolute bottom-8 left-6 right-6 flex justify-between items-center z-20 pointer-events-none">
            
            {/* Левая кнопка: Выбор другого фото (папка) */}
            <label className="pointer-events-auto w-14 h-14 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-full flex items-center justify-center text-xl shadow-2xl active:scale-90 transition-all cursor-pointer">
              📁
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>

            {/* Правая кнопка: Вход / Выход из режима просмотра телефоном */}
            <button
              onClick={toggleGyroMode}
              className={`pointer-events-auto w-14 h-14 backdrop-blur-md border rounded-full flex items-center justify-center text-xl shadow-2xl active:scale-90 transition-all ${
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
