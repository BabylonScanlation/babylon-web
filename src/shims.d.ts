declare module '@squoosh/lib/webp/decode' {
  export function decode(data: Uint8Array): ImageData;
}

declare module '@squoosh/lib/jpeg/decode' {
  export function decode(data: Uint8Array): ImageData;
}

declare module '@squoosh/lib/png/decode' {
  export function decode(data: Uint8Array): ImageData;
}

declare module '@squoosh/lib/resize' {
  export function resize(
    image: ImageData,
    options: { width: number; height: number; fitMethod: string }
  ): Promise<ImageData>;
}

declare module '@squoosh/lib/jpeg/encode' {
  export function encode(
    image: ImageData,
    options: { quality: number }
  ): Promise<{ binary: Uint8Array }>;
}

declare module '@squoosh/lib/webp/encode' {
  interface WebPEncodeOptions {
    quality: number;
    target_size?: number;
    target_PSNR?: number;
    method?: number;
    sns_strength?: number;
    filter_strength?: number;
    filter_sharpness?: number;
    filter_type?: number;
    partitions?: number;
    segments?: number;
    pass?: number;
    show_compressed?: number;
    preprocessing?: number;
    autofilter?: number;
    partition_limit?: number;
    alpha_compression?: number;
    alpha_filtering?: number;
    alpha_quality?: number;
    lossless?: number;
    exact?: number;
    image_hint?: number;
    emulate_jpeg_size?: number;
    thread_level?: number;
    low_memory?: number;
    near_lossless?: number;
    exact_psnr?: number;
    qmin?: number;
    qmax?: number;
    alpha_q?: number;
    m_level?: number;
    l_alpha?: number;
    trim_alpha?: number;
    kfilter?: number;
    strong?: number;
    autocrop?: number;
    reduce_near_lossless?: number;
    use_delta_palette?: number;
    use_sharp_yuv?: number;
  }

  interface WebPEncodeResult {
    binary: Uint8Array;
  }

  export function encode(
    image: ImageData,
    options: WebPEncodeOptions
  ): Promise<WebPEncodeResult>;
}
