import { createContext, useContext } from 'react'

export const ThemeContext = createContext(false)

export function useTheme() {
  return useContext(ThemeContext)
}
