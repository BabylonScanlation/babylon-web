<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Swiper from 'swiper';
  import type { SwiperOptions } from 'swiper/types';

  // This component is a generic wrapper for Swiper.js
  
  export let options: SwiperOptions = {};

  let swiperContainer: HTMLElement;
  let swiperInstance: Swiper | null = null;

  onMount(() => {
    if (swiperContainer) {
      // Initialize Swiper
      swiperInstance = new Swiper(swiperContainer, {
        // Default options can go here, they will be overridden by the props
        ...options,
      });
    }
  });

  onDestroy(() => {
    // Destroy Swiper instance to prevent memory leaks
    if (swiperInstance) {
      swiperInstance.destroy(true, true);
    }
  });
</script>

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
