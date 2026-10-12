// Nombre del negocio. Para demos y videos: VITE_BRAND=demo (marca ficticia).
const isDemo = (import.meta.env.VITE_BRAND || '').toLowerCase() === 'demo';

export const BRAND = isDemo
  ? { first: 'Almacén', second: 'La Esquina' }
  : { first: 'Granja y Kiosco', second: 'Don Ramón' };
