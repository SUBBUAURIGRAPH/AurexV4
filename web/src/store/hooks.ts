/**
 * Redux Hooks
 * Custom hooks for Redux store access
 * @version 1.0.0
 */

import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from './index';

/**
 * Custom hook for dispatching actions
 * Use throughout your app instead of plain `useDispatch`
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/**
 * Custom hook for selecting state
 * Use throughout your app instead of plain `useSelector`
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
