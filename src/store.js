import { useSyncExternalStore } from "react";
import { apiClient } from "./api/client.js";

function readStoredUser() {
  try {
    const raw = localStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem('currentUser');
    return null;
  }
}

let state = {
  currentUser: readStoredUser(),
};

const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

function getState() {
  return state;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(partial) {
  state = { ...state, ...partial };
  emit();
}

export function setCurrentUser(currentUser) {
  if (currentUser) {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  } else {
    localStorage.removeItem('currentUser');
  }
  update({ currentUser });
}

export function logout() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('token');
  apiClient.setToken(null);
  update({ currentUser: null });
}

export function useStore() {
  const data = useSyncExternalStore(subscribe, getState);
  return {
    ...data,
    setCurrentUser,
    logout,
  };
}
