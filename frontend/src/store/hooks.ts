/**
 * Typed Redux hooks.
 *
 * react-redux ships `useDispatch` and `useSelector` with generic types you
 * have to supply at every call site. Pre-binding them to *our* RootState and
 * AppDispatch is the official RTK recommendation — components import these
 * instead of the raw react-redux hooks.
 *
 *   const dispatch = useAppDispatch();           // typed as AppDispatch
 *   const present = useAppSelector((s) => s.resume.present);  // s is RootState
 *
 * If you ever see a component calling `useDispatch()` or `useSelector()`
 * directly, that's a smell — change it to the typed hook.
 */
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './index';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
