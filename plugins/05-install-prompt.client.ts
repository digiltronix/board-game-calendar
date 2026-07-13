// Attaches the beforeinstallprompt/appinstalled listeners as early as
// possible — Chrome fires beforeinstallprompt once per qualifying page load,
// so waiting until the user navigates to /profile to start listening would
// miss it. See composables/useInstallPrompt.ts.
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    attachInstallPromptListeners()
  }
})
