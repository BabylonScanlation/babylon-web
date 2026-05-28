<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
  let { value = $bindable(''), options = [], placeholder = 'Escribir o elegir...', id = '', onchange } = $props<{
    value?: string;
    options: string[];
    placeholder?: string;
    id?: string;
    onchange?: (val: string) => void;
  }>();

  let isOpen = $state(false);
  let container: HTMLDivElement;
  
  function handleClickOutside(e: MouseEvent) {
    if (container && !container.contains(e.target as Node)) {
      isOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handleClickOutside);
    }
  });

  let filteredOptions = $derived(
    options.filter((opt: string) => opt.toLowerCase().includes(value.toLowerCase()))
  );

  function toggleOpen() {
    isOpen = !isOpen;
  }
  
  function selectOption(opt: string) {
    value = opt;
    isOpen = false;
    if (onchange) onchange(opt);
  }

  // Also call onchange if they type in the input directly
  function handleInput(e: Event) {
    isOpen = true;
    if (onchange) onchange((e.target as HTMLInputElement).value);
  }
</script>

<div class="combobox-container" bind:this={container}>
  <div class="input-wrapper">
    <input
      type="text"
      {id}
      bind:value
      {placeholder}
      autocomplete="off"
      onfocus={() => isOpen = true}
      oninput={handleInput}
    />
    <button type="button" class="arrow-btn" onclick={toggleOpen} aria-label="Abrir opciones">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
  </div>

  {#if isOpen && filteredOptions.length > 0}
    <ul class="dropdown">
      {#each filteredOptions as opt}
        <li>
          <button type="button" class="dropdown-item" onclick={() => selectOption(opt)}>
            {opt}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .combobox-container {
    position: relative;
    width: 100%;
  }

  .input-wrapper {
    position: relative;
    width: 100%;
  }

  input {
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #fff;
    padding: 0.8rem 2.5rem 0.8rem 1rem;
    border-radius: 14px;
    font-size: 0.9rem;
    font-weight: 500;
    outline: none;
    transition: all 0.3s;
  }

  input:focus {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--accent-color);
    box-shadow: 0 0 0 4px rgba(0, 191, 255, 0.1);
  }

  .arrow-btn {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: #fff;
    cursor: pointer;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .arrow-btn:hover {
    opacity: 1;
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 100%;
    max-height: 200px;
    overflow-y: auto;
    background: #111; /* Dark background */
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 0.4rem;
    margin: 0;
    list-style: none;
    z-index: 1000; /* Ensure it's above other elements */
    box-shadow: 0 10px 30px rgba(0,0,0,0.8);
  }

  .dropdown-item {
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0.6rem 1rem;
    cursor: pointer;
    border-radius: 8px;
    color: #fff;
    font-size: 0.9rem;
    transition: background 0.2s;
  }

  .dropdown-item:hover, .dropdown-item:focus {
    background: rgba(255, 255, 255, 0.1);
    outline: none;
  }

  /* Custom scrollbar for dropdown */
  .dropdown::-webkit-scrollbar {
    width: 6px;
  }
  .dropdown::-webkit-scrollbar-track {
    background: transparent;
  }
  .dropdown::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
</style>
