export const API_BASE_URL = import.meta.env.PROD 
  ? 'http://gallery.aura.thehulls.com'
  : 'http://localhost:3001';

export const IMAGE_BASE_URL = import.meta.env.PROD
  ? 'http://gallery.aura.thehulls.com/images'
  : 'http://localhost:3001/images';