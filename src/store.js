import { useSyncExternalStore } from "react";
import { users } from "./data/users";
import { equipment as initialEquipment } from "./data/equipment";
import { requests as initialRequests } from "./data/requests";
import { reports as initialReports } from "./data/reports";

let state = {
  currentUser: null,
  employees: users,
  equipment: initialEquipment,
  requests: initialRequests,
  reports: initialReports,
  departments: [
    { id: 1, name: "Finance" },
    { id: 2, name: "Human Resources" },
    { id: 3, name: "ICT" },
    { id: 4, name: "Engineering" },
  ],
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
  update({ currentUser });
}

export function setEmployees(updater) {
  const employees =
    typeof updater === "function" ? updater(state.employees) : updater;
  update({ employees });
}

export function setEquipment(updater) {
  const equipment =
    typeof updater === "function" ? updater(state.equipment) : updater;
  update({ equipment });
}

export function setRequests(updater) {
  const requests =
    typeof updater === "function" ? updater(state.requests) : updater;
  update({ requests });
}

export function setReports(updater) {
  const reports =
    typeof updater === "function" ? updater(state.reports) : updater;
  update({ reports });
}

export function setDepartments(updater) {
  const departments =
    typeof updater === "function" ? updater(state.departments) : updater;
  update({ departments });
}

export function useStore() {
  const data = useSyncExternalStore(subscribe, getState);
  return {
    ...data,
    setCurrentUser,
    setEmployees,
    setEquipment,
    setRequests,
    setReports,
    setDepartments,
  };
}
