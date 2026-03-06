export type WebEnv = {
  API_BASE_URL: string;
  NODE_ENV: "development" | "test" | "production";
};

let cachedEnv: WebEnv | null = null;

export function getWebEnv(): WebEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

  let nodeEnv: WebEnv["NODE_ENV"] = "development";
  if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "production") {
    nodeEnv = process.env.NODE_ENV;
  }

  cachedEnv = {
    API_BASE_URL: apiBaseUrl,
    NODE_ENV: nodeEnv
  };

  return cachedEnv;
}
