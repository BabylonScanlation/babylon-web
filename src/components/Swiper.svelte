<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Swiper from 'swiper';
  import { Navigation, Pagination, Autoplay, FreeMode, Mousewheel, Scrollbar } from 'swiper/modules';
  import type { SwiperOptions } from 'swiper/types';
  
  // Import Swiper styles
  import 'swiper/css';
  import 'swiper/css/navigation';
  import 'swiper/css/pagination';
  import 'swiper/css/free-mode';
  import 'swiper/css/scrollbar';

  // This component is a generic wrapper for Swiper.js
  
  export let options: SwiperOptions = {};

  let swiperContainer: HTMLElement;
  let swiperInstance: Swiper | null = null;

  onMount(() => {
    if (swiperContainer) {
      // Initialize Swiper
      swiperInstance = new Swiper(swiperContainer, {
        // Explicitly pass modules here to ensure they are attached to this instance
        modules: [Navigation, Pagination, Autoplay, FreeMode, Mousewheel, Scrollbar],
        ...options,
      });

      // Force autoplay start if enabled in options
      if (options.autoplay && swiperInstance.autoplay) {
        swiperInstance.autoplay.start();
      }
    }
  });

  onDestroy(() => {
    // Destroy Swiper instance to prevent memory leaks
    if (swiperInstance) {
      swiperInstance.destroy(true, true);
    }
  });
</script>

<style>
  /* Ensure Swiper wrapper is always flex to allow horizontal movement */
  :global(.swiper-wrapper) {
    display: flex !important;
    flex-direction: row !important;
  }
</style>

<!-- The HTML structure that Swiper expects -->
<div class="swiper" bind:this={swiperContainer}>
  <div class="swiper-wrapper">
    <!-- Slides will be passed into this slot from the parent Astro component -->
    <slot />
  </div>

  <!-- Optional: Add elements for pagination, navigation, etc. -->
  <!-- These can be conditionally rendered based on the options passed in -->
  {#if options.pagination}
    <div class="swiper-pagination"></div>
  {/if}

  {#if options.navigation}
    <div class="swiper-button-prev"></div>
    <div class="swiper-button-next"></div>
  {/if}

  {#if options.scrollbar}
    <div class="swiper-scrollbar"></div>
  {/if}
</div>
