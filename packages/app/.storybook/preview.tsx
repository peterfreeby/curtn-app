import "../src/app/globals.css";
import type { Preview } from "@storybook/react";
import { withProviders } from "./decorators";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "curtn-deep",
      values: [
        { name: "curtn-deep", value: "#161316" },
        { name: "curtn-surface", value: "#1E1B1E" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: ["Atoms", "Molecules", "Organisms", "Forms"],
      },
    },
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/" },
    },
  },
  decorators: [withProviders],
};

export default preview;
