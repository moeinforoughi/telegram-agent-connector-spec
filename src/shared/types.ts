export type DataPaths = {
  readonly root: string;
  readonly config: string;
  readonly profiles: string;
  readonly logs: string;
  readonly cache: string;
  readonly backups: string;
};

export type AppInfo = {
  readonly appName: string;
  readonly appVersion: string;
  readonly platform: string;
};
