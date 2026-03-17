<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-brand">
        <span class="brand-label">COCHING</span>
        <span class="brand-title">MyLab Studio</span>
      </div>
      <h2 class="auth-title">로그인</h2>

      <form @submit.prevent="onSubmit" class="auth-form">
        <div class="field">
          <label>이메일</label>
          <input v-model="email" type="email" placeholder="your@email.com" required autocomplete="email" />
        </div>
        <div class="field">
          <label>비밀번호</label>
          <input v-model="password" type="password" placeholder="••••••••" required autocomplete="current-password" />
        </div>
        <div v-if="errorMsg" class="auth-error">{{ errorMsg }}</div>
        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? '로그인 중…' : '로그인' }}
        </button>
      </form>

      <p class="auth-link">
        계정이 없으신가요?
        <router-link to="/register">회원가입</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore.js'

const router = useRouter()
const { login } = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function onSubmit() {
  loading.value = true
  errorMsg.value = ''
  try {
    await login(email.value, password.value)
    router.push('/')
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 24px;
}

.auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 36px 32px;
  box-shadow: var(--shadow);
}

.auth-brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 24px;
}
.brand-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--accent);
  letter-spacing: 3px;
  font-weight: 600;
}
.brand-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.auth-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 24px;
}

.auth-form { display: flex; flex-direction: column; gap: 16px; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; font-weight: 500; color: var(--text-sub); }
.field input {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}
.field input:focus { border-color: var(--accent); }

.auth-error {
  padding: 10px 12px;
  background: var(--red-bg);
  color: var(--red);
  border-radius: 8px;
  font-size: 12px;
}

.btn-submit {
  padding: 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  margin-top: 4px;
}
.btn-submit:hover:not(:disabled) { background: #a68350; }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

.auth-link {
  text-align: center;
  margin: 20px 0 0;
  font-size: 12px;
  color: var(--text-dim);
}
.auth-link a { color: var(--accent); text-decoration: none; font-weight: 500; }
.auth-link a:hover { text-decoration: underline; }
</style>
