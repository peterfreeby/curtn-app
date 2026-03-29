import "../src/app/globals.css";

/** @type { import('@storybook/nextjs-vite').Preview } */
const preview = {
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
  },
};

export default preview;
