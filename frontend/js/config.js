// Address of the API: the engine serves the interface itself, so the API is on the same address
export const API_URL = '/api'
export const IS_DEV = location.port !== '4747'
export const IN_APP = new URLSearchParams(location.search).has('app') // inside the Windows app (not a browser)
