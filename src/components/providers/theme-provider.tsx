"use client";
import {createContext,useContext,useEffect,useSyncExternalStore,type ReactNode} from 'react';
import {useBrowserPreference} from '@/lib/browser/use-browser-preference';
export type Theme='light'|'dark'|'system';
const choices:readonly Theme[]=['light','dark','system'];
const subscribe=(notify:()=>void)=>{const query=window.matchMedia('(prefers-color-scheme: dark)');query.addEventListener('change',notify);return()=>query.removeEventListener('change',notify);};
const darkSnapshot=()=>window.matchMedia('(prefers-color-scheme: dark)').matches;
const ThemeContext=createContext<{theme:Theme;resolvedTheme:'light'|'dark';setTheme:(theme:Theme)=>void}|null>(null);
export function ThemeProvider({children}:{children:ReactNode}){
 const [theme,setTheme]=useBrowserPreference<Theme>('pharmacy.theme','light',choices);
 const systemDark=useSyncExternalStore(subscribe,darkSnapshot,()=>false);
 const resolvedTheme=theme==='system'?(systemDark?'dark':'light'):theme;
 useEffect(()=>{document.documentElement.dataset.theme=resolvedTheme;document.documentElement.style.colorScheme=resolvedTheme;},[resolvedTheme]);
 return <ThemeContext.Provider value={{theme,resolvedTheme,setTheme}}>{children}</ThemeContext.Provider>;
}
export function useTheme(){const value=useContext(ThemeContext);if(!value)throw new Error('useTheme requires ThemeProvider');return value;}
