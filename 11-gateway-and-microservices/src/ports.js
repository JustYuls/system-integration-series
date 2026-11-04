// One port for each service. The gateway (a later episode) listens on 4000.
export const PORTS = { gateway: 4000, studentAffairs: 4001, finance: 4002, facilities: 4003 };

export const baseUrl = (name, host = "http://localhost") => `${host}:${PORTS[name]}`;
