<template>
  <div
    class="Xuppy-select-files flex w-full -mt-2 bg-white rounded border-4 border-dashed border-gray-400 text-gray-500 transition-all duration-200 ease-in-out"
  >
    <p class="w-full self-center text-center text-2xl">
      <slot>
        Upload some images
      </slot>
    </p>
  </div>
</template>
<script>
export default {
  emits: ['reload-uppy'],
  mounted() {
    this.$emit('reload-uppy');
  }
};
</script>
