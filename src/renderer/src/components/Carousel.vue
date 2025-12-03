<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

interface Props {
  // number of items to scroll per click
  scrollAmount?: number
  // gap between items in pixels
  gap?: number
  // whether to show navigation arrows
  showArrows?: boolean
  // whether to auto-hide arrows when not hoverable
  autoHideArrows?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  scrollAmount: 3,
  gap: 16,
  showArrows: true,
  autoHideArrows: true
})

const containerRef = ref<HTMLElement | null>(null)
const scrollerRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const isHovered = ref(false)

// calculate the scroll distance based on visible item width
const getScrollDistance = (): number => {
  if (!scrollerRef.value) return 200

  // find the first child element to determine item width
  const firstChild = scrollerRef.value.firstElementChild as HTMLElement
  if (!firstChild) return 200

  const itemWidth = firstChild.offsetWidth + props.gap
  return itemWidth * props.scrollAmount
}

const updateScrollState = (): void => {
  if (!scrollerRef.value) return

  const { scrollLeft, scrollWidth, clientWidth } = scrollerRef.value
  canScrollLeft.value = scrollLeft > 1
  canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 1
}

const scrollTo = (direction: 'left' | 'right'): void => {
  if (!scrollerRef.value) return

  const distance = getScrollDistance()
  const newPosition = scrollerRef.value.scrollLeft + (direction === 'left' ? -distance : distance)

  scrollerRef.value.scrollTo({
    left: newPosition,
    behavior: 'smooth'
  })
}

const handleMouseEnter = (): void => {
  isHovered.value = true
}

const handleMouseLeave = (): void => {
  isHovered.value = false
}

const showLeftArrow = computed(() => {
  if (!props.showArrows) return false
  if (props.autoHideArrows && !isHovered.value) return false
  return canScrollLeft.value
})

const showRightArrow = computed(() => {
  if (!props.showArrows) return false
  if (props.autoHideArrows && !isHovered.value) return false
  return canScrollRight.value
})

// set up resize observer to handle container resize
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  updateScrollState()

  if (scrollerRef.value) {
    scrollerRef.value.addEventListener('scroll', updateScrollState, { passive: true })

    resizeObserver = new ResizeObserver(() => {
      updateScrollState()
    })
    resizeObserver.observe(scrollerRef.value)
  }
})

onUnmounted(() => {
  if (scrollerRef.value) {
    scrollerRef.value.removeEventListener('scroll', updateScrollState)
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// update scroll state when slot content changes
watch(
  () => scrollerRef.value?.children.length,
  () => {
    nextTick(() => {
      updateScrollState()
    })
  }
)

defineExpose({
  scrollTo,
  updateScrollState
})
</script>

<template>
  <div
    ref="containerRef"
    class="carousel"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- left nav arrow -->
    <Transition name="fade">
      <button
        v-if="showLeftArrow"
        class="carousel-arrow carousel-arrow-left"
        aria-label="Scroll left"
        @click="scrollTo('left')"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>
    </Transition>

    <!-- scrollable content area -->
    <div ref="scrollerRef" class="carousel-scroller" :style="{ gap: `${gap}px` }">
      <slot />
    </div>

    <!-- right nav arrow -->
    <Transition name="fade">
      <button
        v-if="showRightArrow"
        class="carousel-arrow carousel-arrow-right"
        aria-label="Scroll right"
        @click="scrollTo('right')"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
        </svg>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.carousel {
  position: relative;
  width: 100%;
}

.carousel-scroller {
  display: flex;
  overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.carousel-scroller::-webkit-scrollbar {
  display: none;
}

.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-surface);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-on-surface);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition:
    background-color 0.15s ease,
    transform 0.15s ease;
}

.carousel-arrow:hover {
  background-color: var(--color-surface-variant);
  transform: translateY(-50%) scale(1.05);
}

.carousel-arrow:active {
  transform: translateY(-50%) scale(0.95);
}

.carousel-arrow svg {
  width: 24px;
  height: 24px;
}

.carousel-arrow-left {
  left: 0;
}

.carousel-arrow-right {
  right: 0;
}

/* fade transition for arrows */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
