/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the HVAC-Sim API, e.g. https://hvac-api.example.com/api. Defaults to /api. */
  readonly VITE_API_BASE?: string;
}
