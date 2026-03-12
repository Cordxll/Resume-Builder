// Storage keys
const API_KEY_STORAGE_KEY = 'openai_api_key';
const SERVER_KEY_STATUS_KEY = 'server_api_key_status';

export const getStoredApiKey = (): string => {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
};

export const setStoredApiKey = (key: string): void => {
  if (key) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }
};

export const hasServerApiKey = (): boolean => {
  return localStorage.getItem(SERVER_KEY_STATUS_KEY) === 'true';
};

export const setServerApiKeyStatus = (hasKey: boolean): void => {
  localStorage.setItem(SERVER_KEY_STATUS_KEY, String(hasKey));
};

export const hasAnyApiKey = (): boolean => {
  return Boolean(getStoredApiKey()) || hasServerApiKey();
};
