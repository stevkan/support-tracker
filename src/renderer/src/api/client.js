async function getBaseUrl() {
  if (window.electronAPI?.getApiBaseUrl) {
    return await window.electronAPI.getApiBaseUrl();
  }
  return 'http://127.0.0.1:3000';
}

async function apiFetch(path, options = {}) {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// Settings API
export function getSettings() {
  return apiFetch('/api/settings');
}

export function updateSettings(updates) {
  return apiFetch('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// Secrets API
export function checkSecret(key) {
  return apiFetch(`/api/secrets/${encodeURIComponent(key)}`);
}

export function getSecret(key) {
  return apiFetch(`/api/secrets/${encodeURIComponent(key)}?reveal=true`);
}

export function setSecret(key, value) {
  return apiFetch(`/api/secrets/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export async function deleteSecret(key) {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/secrets/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export function checkSecrets(keys) {
  return apiFetch('/api/secrets/check', {
    method: 'POST',
    body: JSON.stringify({ keys }),
  });
}

// Query API
export function startQuery(enabledServices, params) {
  return apiFetch('/api/queries', {
    method: 'POST',
    body: JSON.stringify({ enabledServices, params }),
  });
}

export function getQueryStatus(jobId) {
  return apiFetch(`/api/queries/${encodeURIComponent(jobId)}`);
}

export function cancelQuery(jobId) {
  return apiFetch(`/api/queries/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// Validation API
export function validateAzureDevOpsPat(org, username, pat, apiVersion) {
  return apiFetch('/api/validate/azure-devops', {
    method: 'POST',
    body: JSON.stringify({ org, username, pat, apiVersion }),
  });
}

export function checkAzureDevOpsStatus() {
  return apiFetch('/api/validate/azure-devops');
}

export function validateGitHubToken(token) {
  return apiFetch('/api/validate/github', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function checkGitHubStatus() {
  return apiFetch('/api/validate/github');
}

export function validateStackOverflowKey(apiKey) {
  return apiFetch('/api/validate/stackoverflow', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

export function checkStackOverflowStatus() {
  return apiFetch('/api/validate/stackoverflow');
}
