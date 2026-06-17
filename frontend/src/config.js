const API_PORT = import.meta.env.VITE_API_PORT !== undefined ? import.meta.env.VITE_API_PORT : '8000'
const portSuffix = API_PORT ? `:${API_PORT}` : ''

export const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}${portSuffix}`

export const WS_BASE_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}${portSuffix}`
