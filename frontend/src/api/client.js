import axios from 'axios'

const apiBase = window.location.protocol + '//' + window.location.hostname + ':8000'
axios.defaults.baseURL = apiBase

axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const api = axios
