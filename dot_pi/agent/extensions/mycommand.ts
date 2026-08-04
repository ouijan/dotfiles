import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("mycommand", {
    description: "Does a thing",
    handler: async (args, ctx) => {
      // TODO: implement your logic here
      ctx.ui.notify(`Running with args: ${args}`, "info");
    },
  });
}
