import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface PanoramaItem {
  id: string;
  title: string;
  url: string;
}

interface PanoramaState {
  currentPanoId: string | null;
  list: PanoramaItem[];
}

const initialState: PanoramaState = {
  currentPanoId: null,
  list: [] // Абсолютно пустой массив без начальных картинок
};

const panoramaSlice = createSlice({
  name: 'panorama',
  initialState,
  reducers: {
    setCurrentPano: (state, action: PayloadAction<string>) => {
      state.currentPanoId = action.payload;
    },
    addPanorama: (state, action: PayloadAction<PanoramaItem>) => {
      state.list.push(action.payload);
      state.currentPanoId = action.payload.id; 
    }
  }
});

export const { setCurrentPano, addPanorama } = panoramaSlice.actions;
export const panoramaReduser = panoramaSlice.reducer;
