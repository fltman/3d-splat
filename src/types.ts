export type PhotoSource = {
  file: File | null;
  url: string;
  width: number;
  height: number;
  name: string;
};

export type TrackingState = "off" | "loading" | "active" | "fallback" | "error";
