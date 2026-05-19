import { configureStore } from "@reduxjs/toolkit";
import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from "react-redux";
import { panoramaReduser } from "./panoramaSlice";

const store = configureStore({
  reducer: {
    panoramaSlice: panoramaReduser, // Убедитесь, что здесь подключен ваш редюсер
  },
});

// Автоматически вытаскиваем тип состояния из самого стора
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
// Этот хук теперь жестко связан с RootState и будет знать все свойства
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export default store;
