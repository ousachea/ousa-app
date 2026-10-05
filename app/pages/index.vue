<template>
  <main class="home">
    <RubikCube :size="72" />
    <h1>Ousa App</h1>
    <p>Scramble, solve, repeat.</p>
  </main>
</template>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3.5rem;
  padding: 1rem;
  background: radial-gradient(circle at 50% 40%, #1d2433 0%, #0b0d12 70%);
  color: #e8ecf3;
  font-family: system-ui, -apple-system, sans-serif;
  text-align: center;
  overflow: hidden;
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 6vw, 3.5rem);
  letter-spacing: -0.02em;
}

p {
  margin: -2.5rem 0 0;
  color: #9aa3b2;
}

@media (max-width: 480px) {
  .home :deep(.scene) {
    scale: 0.72;
  }
}
</style>
