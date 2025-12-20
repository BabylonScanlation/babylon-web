declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// Specifically for swiper
declare module 'swiper/css' {
  const content: any;
  export default content;
}

declare module 'swiper/css/pagination' {
  const content: any;
  export default content;
}
