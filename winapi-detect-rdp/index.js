import{ createRequire  } from "module";

const winapiHandler = createRequire(import.meta.url)("./prebuild.node");

export const { isCurrentSessionRemoteable, getActiveProcessesInfo, getActiveSessionInfo } = winapiHandler;

export default winapiHandler;
