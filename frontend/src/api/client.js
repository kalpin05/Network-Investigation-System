import axios from 'axios'
import { API_BASE_URL } from '../config'

axios.defaults.baseURL = API_BASE_URL

axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const api = axios
