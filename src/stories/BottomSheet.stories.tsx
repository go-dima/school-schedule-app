import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button, Input, List } from "antd";
import { BottomSheet } from "../components/BottomSheet";
import { mockClasses } from "./fixtures/scheduleFixtures";

// Sunday's classes from the shared schedule fixtures, as a long list the
// sheet body scrolls through.
const sundayClasses = mockClasses.filter(c =>
  c.slots.some(slot => slot.dayOfWeek === 0)
);

const Demo = ({ withSearch }: { withSearch: boolean }) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>פתח</Button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={withSearch ? <Input placeholder="חיפוש" /> : "יום ראשון"}>
        <List
          dataSource={sundayClasses}
          renderItem={c => (
            <List.Item>
              <List.Item.Meta title={c.title} description={c.room} />
            </List.Item>
          )}
        />
      </BottomSheet>
    </>
  );
};

const meta: Meta<typeof Demo> = {
  title: "Components/BottomSheet",
  component: Demo,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
};
export default meta;
type Story = StoryObj<typeof Demo>;

export const Default: Story = { args: { withSearch: false } };

/** A search field in the header stays at 16px, so iOS doesn't zoom. */
export const WithSearchInTitle: Story = { args: { withSearch: true } };
